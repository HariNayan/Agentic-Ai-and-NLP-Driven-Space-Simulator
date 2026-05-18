import pytest
import json
from unittest.mock import AsyncMock, patch
from agents import (
    classify_intent, safe_json_parse, ConversationMemory, Curriculum,
    execute_tool, determine_navigation_fallback, quiz_agent,
    QUIZ_BANK, DEFAULT_QUIZ, PLANET_DB, CELESTIAL_BODIES, memory,
)

# ── classify_intent ───────────────────────────────────────────────────────────

class TestClassifyIntent:
    def test_navigate_keyword_detects_planet(self):
        intent, target = classify_intent("go to Mars", "Earth")
        assert intent == "navigate"
        assert target == "Mars"

    def test_navigate_falls_back_to_current_planet(self):
        intent, target = classify_intent("take me there", "Venus")
        assert intent == "navigate"
        assert target == "Venus"

    def test_quiz_keyword_detects_planet(self):
        intent, target = classify_intent("quiz me about Jupiter", "Earth")
        assert intent == "quiz"
        assert target == "Jupiter"

    def test_quiz_falls_back_to_current_planet(self):
        intent, target = classify_intent("test me", "Saturn")
        assert intent == "quiz"
        assert target == "Saturn"

    def test_explain_intent_with_planet_mention(self):
        intent, target = classify_intent("tell me about Neptune", "Earth")
        assert intent == "explain"
        assert target == "Earth"

    def test_explain_no_keywords(self):
        intent, target = classify_intent("why is the sky blue", "Mars")
        assert intent == "explain"
        assert target == "Mars"

    def test_quiz_takes_precedence_over_navigate(self):
        intent, target = classify_intent("quiz me and take me to Mars", "Earth")
        assert intent == "quiz"

    def test_sun_is_detected_in_navigate(self):
        intent, target = classify_intent("go to the sun", "Earth")
        assert intent == "navigate"
        assert target == "Sun"

    def test_moon_is_detected_in_quiz(self):
        intent, target = classify_intent("quiz me about the moon", "Earth")
        assert intent == "quiz"
        assert target == "Moon"

    def test_asteroid_belt_handling(self):
        intent, target = classify_intent("go to asteroid belt", "Earth")
        assert intent == "navigate"
        assert target == "Asteroid belt"

    def test_case_insensitivity(self):
        intent, target = classify_intent("TAKE ME TO MARS", "Earth")
        assert intent == "navigate"
        assert target == "Mars"


# ── safe_json_parse ───────────────────────────────────────────────────────────

class TestSafeJsonParse:
    def test_plain_json(self):
        result = safe_json_parse('{"intent": "navigate", "target": "Mars"}', {})
        assert result == {"intent": "navigate", "target": "Mars"}

    def test_json_with_code_fence(self):
        raw = '```json\n{"intent": "quiz"}\n```'
        result = safe_json_parse(raw, {})
        assert result["intent"] == "quiz"

    def test_json_with_unlabeled_fence(self):
        raw = '```\n{"intent": "explain"}\n```'
        result = safe_json_parse(raw, {})
        assert result["intent"] == "explain"

    def test_invalid_json_returns_fallback(self):
        result = safe_json_parse("not json", {"fallback": True})
        assert result == {"fallback": True}

    def test_empty_string_returns_fallback(self):
        result = safe_json_parse("", {"fallback": True})
        assert result == {"fallback": True}

    def test_whitespace_only_returns_fallback(self):
        result = safe_json_parse("   ", {"fallback": True})
        assert result == {"fallback": True}

    def test_json_with_extra_whitespace(self):
        result = safe_json_parse('  {"a": 1}  ', {})
        assert result == {"a": 1}


# ── ConversationMemory ────────────────────────────────────────────────────────

class TestConversationMemory:
    def test_empty_session_returns_empty_history(self):
        mem = ConversationMemory()
        assert mem.get_history("s1") == []

    def test_add_message(self):
        mem = ConversationMemory()
        mem.add_message("s1", "user", "hello")
        assert len(mem.get_history("s1")) == 1
        assert mem.get_history("s1")[0] == {"role": "user", "content": "hello"}

    def test_sliding_window(self):
        mem = ConversationMemory(max_turns=3)
        for i in range(5):
            mem.add_message("s1", "user", f"msg{i}")
        history = mem.get_history("s1")
        assert len(history) == 3
        assert history[0]["content"] == "msg2"
        assert history[-1]["content"] == "msg4"

    def test_session_isolation(self):
        mem = ConversationMemory()
        mem.add_message("s1", "user", "hello")
        mem.add_message("s2", "user", "world")
        assert len(mem.get_history("s1")) == 1
        assert len(mem.get_history("s2")) == 1
        assert mem.get_history("s1")[0]["content"] == "hello"
        assert mem.get_history("s2")[0]["content"] == "world"

    def test_clear_session(self):
        mem = ConversationMemory()
        mem.add_message("s1", "user", "hello")
        mem.clear("s1")
        assert mem.get_history("s1") == []

    def test_clear_nonexistent_session(self):
        mem = ConversationMemory()
        mem.clear("nonexistent")
        assert mem.get_history("nonexistent") == []

    def test_format_history_empty(self):
        mem = ConversationMemory()
        assert mem.format_history("s1") == ""

    def test_format_history_user_assistant(self):
        mem = ConversationMemory()
        mem.add_message("s1", "user", "hello")
        mem.add_message("s1", "assistant", "hi there")
        formatted = mem.format_history("s1")
        assert "User: hello" in formatted
        assert "Assistant: hi there" in formatted

    def test_format_history_tool(self):
        mem = ConversationMemory()
        mem.add_tool_result("s1", "get_planet_data", '{"mass": "1e24"}')
        formatted = mem.format_history("s1")
        assert "[Data] [get_planet_data]" in formatted or "[get_planet_data]" in formatted
        assert "1e24" in formatted

    def test_add_tool_result(self):
        mem = ConversationMemory()
        mem.add_tool_result("s1", "get_planet_data", '{"mass": "1e24"}')
        history = mem.get_history("s1")
        assert len(history) == 1
        assert "[get_planet_data]" in history[0]["content"]


# ── Curriculum ────────────────────────────────────────────────────────────────

class TestCurriculum:
    def test_new_user_starts_at_beginner(self):
        c = Curriculum()
        assert c.get_user_level("new") == "beginner"

    def test_complete_all_beginner_unlocks_intermediate(self):
        c = Curriculum()
        c.complete_lesson("s1", "intro")
        c.complete_lesson("s1", "inner")
        c.complete_lesson("s1", "outer")
        assert c.get_user_level("s1") == "intermediate"

    def test_complete_all_intermediate_unlocks_advanced(self):
        c = Curriculum()
        for lesson in ["intro", "inner", "outer", "orbits", "moons", "extremes"]:
            c.complete_lesson("s1", lesson)
        assert c.get_user_level("s1") == "advanced"

    def test_get_next_lesson_returns_first_incomplete(self):
        c = Curriculum()
        lesson = c.get_next_lesson("s1")
        assert lesson["id"] == "intro"

    def test_no_next_lesson_when_all_done(self):
        c = Curriculum()
        for level in ["beginner", "intermediate", "advanced"]:
            from agents import LESSONS
            for lesson in LESSONS[level]:
                c.complete_lesson("s1", lesson["id"])
        assert c.get_next_lesson("s1") is None

    def test_get_current_lessons_returns_level_lessons(self):
        c = Curriculum()
        lessons = c.get_current_lessons("s1")
        assert len(lessons) == 3

    def test_get_current_lessons_updates_with_level(self):
        c = Curriculum()
        c.complete_lesson("s1", "intro")
        c.complete_lesson("s1", "inner")
        c.complete_lesson("s1", "outer")
        lessons = c.get_current_lessons("s1")
        # Should now be intermediate lessons
        ids = [l["id"] for l in lessons]
        assert "orbits" in ids


# ── execute_tool ──────────────────────────────────────────────────────────────

class TestExecuteTool:
    @pytest.mark.asyncio
    async def test_get_planet_data_found(self):
        result = await execute_tool("get_planet_data", {"planet": "Mars"})
        data = json.loads(result)
        assert data["mass"] == "6.42e23 kg"
        assert data["gravity"] == "3.7 m/s²"

    @pytest.mark.asyncio
    async def test_get_planet_data_not_found(self):
        result = await execute_tool("get_planet_data", {"planet": "Pluto"})
        data = json.loads(result)
        assert "error" in data

    @pytest.mark.asyncio
    async def test_get_planet_data_case(self):
        result = await execute_tool("get_planet_data", {"planet": "mars"})
        data = json.loads(result)
        assert "mass" in data

    @pytest.mark.asyncio
    async def test_get_orbital_position_earth(self):
        result = await execute_tool("get_orbital_position", {"planet": "Earth"})
        data = json.loads(result)
        assert data["planet"] == "Earth"
        assert "mean_longitude_deg" in data
        assert data["semi_major_axis_au"] == 1.0

    @pytest.mark.asyncio
    async def test_get_orbital_position_not_found(self):
        result = await execute_tool("get_orbital_position", {"planet": "Pluto"})
        data = json.loads(result)
        assert "error" in data

    @pytest.mark.asyncio
    async def test_unknown_tool(self):
        result = await execute_tool("nonexistent", {})
        data = json.loads(result)
        assert "error" in data
        assert "nonexistent" in data["error"]


# ── determine_navigation_fallback ─────────────────────────────────────────────

class TestDetermineNavigationFallback:
    def test_direct_planet_name(self):
        result = determine_navigation_fallback("go to Mars")
        assert result.target == "Mars"
        assert result.action == "focus"

    def test_zoom_action(self):
        result = determine_navigation_fallback("zoom to Jupiter")
        assert result.target == "Jupiter"
        assert result.action == "zoom"

    def test_orbit_action(self):
        result = determine_navigation_fallback("orbit Saturn")
        assert result.target == "Saturn"
        assert result.action == "orbit"

    def test_reset_action(self):
        result = determine_navigation_fallback("reset view")
        assert result.action == "reset"

    def test_default_to_earth(self):
        result = determine_navigation_fallback("show me something")
        assert result.target == "Earth"

    def test_asteroid_belt(self):
        result = determine_navigation_fallback("go to asteroid belt")
        assert result.target == "Asteroid Belt"

    def test_pronoun_fallback_uses_history(self):
        memory.clear("pronoun_test")
        memory.add_message("pronoun_test", "assistant", "Let me tell you about Mars")
        result = determine_navigation_fallback("tell me about it", "pronoun_test")
        assert result.target == "Mars"
        memory.clear("pronoun_test")


# ── quiz_agent ────────────────────────────────────────────────────────────────

class TestQuizAgent:
    @pytest.mark.asyncio
    async def test_quiz_falls_back_to_bank_when_llm_fails(self):
        # When NVIDIA_API_KEY is empty, call_llm returns error
        quiz = await quiz_agent("Mars")
        assert "question" in quiz
        assert "options" in quiz
        assert "correct" in quiz
        assert "explanation" in quiz

    @pytest.mark.asyncio
    async def test_quiz_default_fallback_for_unknown_planet(self):
        quiz = await quiz_agent("Pluto")
        assert quiz == DEFAULT_QUIZ

    @pytest.mark.asyncio
    async def test_quiz_bank_has_entries_for_all_planets(self):
        for planet in ["Sun", "Mercury", "Venus", "Earth", "Moon", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]:
            assert planet in QUIZ_BANK, f"Missing quiz for {planet}"


# ── PLANET_DB integrity ───────────────────────────────────────────────────────

class TestPlanetDB:
    def test_all_planets_have_required_fields(self):
        required = ["radius", "mass", "gravity", "day", "year", "moons", "temp", "fun_fact"]
        for name, data in PLANET_DB.items():
            for field in required:
                assert field in data, f"{name} missing field: {field}"
