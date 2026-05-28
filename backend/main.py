from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Literal
import json
import os
import traceback
from dotenv import load_dotenv

from agents import memory, curriculum, agent_with_tools, build_tool_context_prompt, record_quiz_result

load_dotenv()

app = FastAPI()

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGIN",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    selected_planet: str = "Earth"
    user_level: str = "beginner"
    session_id: str = "default"
    history: list[ChatHistoryItem] = Field(default_factory=list)


class QuizResultRequest(BaseModel):
    session_id: str = "default"
    planet: str
    correct: bool


def format_request_history(history: list[ChatHistoryItem], max_turns: int = 10) -> str:
    """Format browser-supplied history so each chat call is self-contained."""
    formatted = []
    for item in history[-max_turns:]:
        content = item.content.strip()
        if not content:
            continue
        role = "User" if item.role == "user" else "Assistant"
        formatted.append(f"{role}: {content[:2000]}")
    return "\n".join(formatted)


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Process user chat input - returns JSON for navigate/quiz, stream for explain."""
    try:
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        from agents import (
            orchestrate_intent,
            quiz_agent,
            call_llm_stream,
            SYSTEM_PROMPT_EXPLAINER_BEGINNER,
            SYSTEM_PROMPT_EXPLAINER_ADVANCED,
        )

        sid = request.session_id
        history = format_request_history(request.history)
        intent, target = await orchestrate_intent(request.message, request.selected_planet, history)

        # Store user message in session
        memory.add_message(sid, "user", request.message)

        # Get curriculum level
        user_level = curriculum.get_user_level(sid)

        if intent == "navigate":
            memory.add_message(sid, "assistant", f"Navigating to {target}")
            return JSONResponse(content={
                "intent": "navigate",
                "target": target,
                "message": f"Navigating to {target}!"
            })

        if intent == "quiz":
            try:
                quiz = await quiz_agent(target)
            except Exception:
                quiz = {
                    "question": f"What is unique about {target}?",
                    "options": ["Mercury", "Venus", "Earth", "Mars"],
                    "correct": "Mercury",
                    "explanation": "Quiz generation failed. Try again!"
                }
            memory.add_message(sid, "assistant", f"Quiz about {target}")
            return JSONResponse(content={
                "intent": "quiz",
                "target": target,
                "quiz": quiz
            })

        # Explain intent — use tool-aware agent
        system_prompt = SYSTEM_PROMPT_EXPLAINER_ADVANCED.format(planet=target) if user_level == "advanced" else SYSTEM_PROMPT_EXPLAINER_BEGINNER.format(planet=target)
        messages, tool_used = await agent_with_tools(request.message, target, user_level, history)

        direct_response = ""
        if tool_used:
            memory.add_tool_result(sid, tool_used, messages[-1]["content"])
            explain_prompt = build_tool_context_prompt(history, request.message, [tool_used], [messages[-1]["content"]])
        else:
            direct_response = messages[-1]["content"]
            explain_prompt = ""

        async def token_stream():
            full_response = ""
            if direct_response:
                full_response = direct_response
                yield f"data: {json.dumps({'token': direct_response})}\n\n"
                memory.add_message(sid, "assistant", full_response)
                return

            async for token in call_llm_stream(explain_prompt, system_prompt):
                if token == "RATE_LIMITED":
                    yield f"data: {json.dumps({'token': 'AI is rate-limited. Please wait and try again.'})}\n\n"
                    return
                full_response += token
                yield f"data: {json.dumps({'token': token})}\n\n"
            memory.add_message(sid, "assistant", full_response)

        return StreamingResponse(
            token_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "type": type(e).__name__}
        )


@app.post("/api/session/clear")
async def clear_session(session_id: str = "default"):
    """Clear session memory and curriculum progress for a browser session."""
    memory.clear(session_id)
    curriculum.clear(session_id)
    return {"status": "cleared", "session_id": session_id}


@app.post("/api/curriculum/quiz-result")
async def submit_quiz_result(request: QuizResultRequest):
    return record_quiz_result(request.session_id, request.planet, request.correct)


@app.get("/api/test")
async def test_ai():
    try:
        import httpx
        from agents import FALLBACK_MODELS, BASE_URL, HEADERS
        async with httpx.AsyncClient(timeout=15.0) as client:
            for model in FALLBACK_MODELS:
                try:
                    r = await client.post(
                        BASE_URL,
                        headers=HEADERS,
                        json={
                            "model": model,
                            "messages": [{"role": "user", "content": "Say hi"}],
                            "max_tokens": 10
                        }
                    )
                    if r.status_code == 200:
                        return {"status": 200, "model": model, "response": r.json()}
                except Exception:
                    continue
            
            return {"status": 429, "error": "All models are rate-limited. Please try again later."}
    except Exception as e:
        return {"error": str(e)}


@app.get("/")
def root():
    return {"status": "running", "message": "Space Simulator Backend API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
