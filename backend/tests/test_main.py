from fastapi.testclient import TestClient

import agents
import main
from agents import curriculum, memory


client = TestClient(main.app)


def clear_state(session_id: str):
    memory.clear(session_id)
    curriculum.clear(session_id)


def test_clear_session_resets_memory_and_curriculum():
    session_id = "clear_api"
    clear_state(session_id)
    memory.add_message(session_id, "user", "hello")
    curriculum.complete_lesson(session_id, "intro")

    response = client.post("/api/session/clear", params={"session_id": session_id})

    assert response.status_code == 200
    assert response.json()["status"] == "cleared"
    assert memory.get_history(session_id) == []
    assert curriculum.get_user_level(session_id) == "beginner"


def test_quiz_result_endpoint_advances_matching_lesson():
    session_id = "quiz_result_api"
    clear_state(session_id)

    response = client.post(
        "/api/curriculum/quiz-result",
        json={"session_id": session_id, "planet": "Earth", "correct": True},
    )

    data = response.json()
    assert response.status_code == 200
    assert data["lesson_completed"] is True
    assert data["completed_lesson"]["id"] == "intro"
    assert data["next_lesson"]["id"] == "inner"


def test_chat_navigate_returns_json(monkeypatch):
    session_id = "chat_nav_api"
    clear_state(session_id)

    async def fake_orchestrate_intent(message: str, current_planet: str, history: str):
        return "navigate", "Mars"

    monkeypatch.setattr(agents, "orchestrate_intent", fake_orchestrate_intent)

    response = client.post(
        "/api/chat",
        json={
            "message": "Take me to Mars",
            "selected_planet": "Earth",
            "session_id": session_id,
            "history": [],
        },
    )

    assert response.status_code == 200
    assert response.json()["intent"] == "navigate"
    assert response.json()["target"] == "Mars"


def test_chat_explain_uses_precomputed_response_without_second_stream_call(monkeypatch):
    session_id = "chat_explain_api"
    clear_state(session_id)

    async def fake_orchestrate_intent(message: str, current_planet: str, history: str):
        return "explain", "Mars"

    async def fake_agent_with_tools(prompt: str, planet: str, level: str, history: str):
        return [{"role": "assistant", "content": "Direct answer from first pass."}], ""

    async def fail_if_stream_called(*args, **kwargs):
        raise AssertionError("call_llm_stream should not run for precomputed direct responses")
        yield ""

    monkeypatch.setattr(agents, "orchestrate_intent", fake_orchestrate_intent)
    monkeypatch.setattr(main, "agent_with_tools", fake_agent_with_tools)
    monkeypatch.setattr(agents, "call_llm_stream", fail_if_stream_called)

    response = client.post(
        "/api/chat",
        json={
            "message": "Tell me about Mars",
            "selected_planet": "Earth",
            "session_id": session_id,
            "history": [],
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "Direct answer from first pass." in response.text
