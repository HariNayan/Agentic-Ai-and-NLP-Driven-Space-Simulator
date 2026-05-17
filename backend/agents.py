import os
import json
import asyncio
import httpx
from typing import Dict, List, Optional
from dotenv import load_dotenv
from pydantic import ValidationError

from schemas import CameraAction, SimulatorResponse

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
MODEL = os.getenv("MODEL", "google/gemma-2-9b-it:free")

FALLBACK_MODELS = [
    MODEL,
    "qwen/qwen-2.5-72b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "mistralai/mistral-7b-instruct:free"
]

HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json"
}


class ConversationMemory:
    def __init__(self, max_turns: int = 10):
        self.max_turns = max_turns
        self.sessions: Dict[str, List[dict]] = {}
    
    def get_history(self, session_id: str) -> List[dict]:
        return self.sessions.get(session_id, [])
    
    def add_message(self, session_id: str, role: str, content: str):
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        
        self.sessions[session_id].append({"role": role, "content": content})
        
        if len(self.sessions[session_id]) > self.max_turns:
            self.sessions[session_id] = self.sessions[session_id][-self.max_turns:]
    
    def format_history(self, session_id: str) -> str:
        history = self.get_history(session_id)
        if not history:
            return ""
        
        formatted = []
        for msg in history:
            role = "User" if msg["role"] == "user" else "Assistant"
            formatted.append(f"{role}: {msg['content']}")
        
        return "\n".join(formatted)
    
    def clear(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id] = []


memory = ConversationMemory(max_turns=10)


SYSTEM_PROMPT_ORCHESTRATOR = """Classify the user message into one intent: explain | quiz | navigate.
If user asks to go to a planet or travel somewhere, it is navigate intent.
If user asks a question, it is explain intent.
If user wants a quiz or test, it is quiz intent.
Return ONLY raw JSON. No markdown. No code fences. No explanation.
Just the JSON object, nothing else.
Example: {{"intent": "navigate", "target": "mars"}}"""

SYSTEM_PROMPT_EXPLAINER_BEGINNER = """You are an enthusiastic space guide. Use simple language,
fun analogies, short sentences. Current planet: {planet}.
Keep response under 120 words."""

SYSTEM_PROMPT_EXPLAINER_ADVANCED = """You are a scientific space educator. Use precise terminology,
real measurements, technical depth. Current planet: {planet}.
Keep response under 150 words."""

SYSTEM_PROMPT_NAVIGATION = """Extract the celestial body name from this message: {message}
Valid targets: Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter,
Saturn, Uranus, Neptune
Return ONLY raw JSON. No markdown. No code fences.
Example: {{"target": "jupiter"}}"""

SYSTEM_PROMPT_QUIZ = """Generate 1 multiple choice question about {planet}.
Return ONLY raw JSON. No markdown. No code fences.
Example: {{"question": "...", "options": ["A","B","C","D"],
"correct": "B", "explanation": "..."}}"""

USER_LEVELS = ["beginner", "intermediate", "advanced"]


def safe_json_parse(raw: str, fallback: dict) -> dict:
    """Safely parse JSON, stripping markdown code fences."""
    try:
        raw = raw.strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        elif raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        return json.loads(raw)
    except (json.JSONDecodeError, AttributeError, KeyError):
        return fallback


async def call_openrouter(prompt: str, system_prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> str:
    """Async call to OpenRouter API using httpx."""
    if not OPENROUTER_API_KEY:
        return "API key not configured. Please add OPENROUTER_API_KEY to .env file."
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in FALLBACK_MODELS:
            try:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=HEADERS,
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": max_tokens,
                        "temperature": temperature
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
            except Exception:
                continue
    return "RATE_LIMITED"


async def call_openrouter_stream(prompt: str, system_prompt: str, max_tokens: int = 512, temperature: float = 0.8):
    """Async streaming call to OpenRouter API using httpx."""
    if not OPENROUTER_API_KEY:
        yield "API key not configured."
        return
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        for model in FALLBACK_MODELS:
            try:
                success = False
                async with client.stream(
                    "POST",
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=HEADERS,
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ],
                        "stream": True,
                        "max_tokens": max_tokens,
                        "temperature": temperature
                    }
                ) as r:
                    if r.status_code == 200:
                        success = True
                        async for line in r.aiter_lines():
                            if line.startswith("data: "):
                                chunk = line[6:]
                                if chunk.strip() == "[DONE]":
                                    break
                                try:
                                    obj = json.loads(chunk)
                                    token = obj["choices"][0]["delta"].get("content", "")
                                    if token:
                                        yield token
                                except Exception:
                                    pass
                        break
                
                if success:
                    return
            except Exception:
                continue
                
    yield "RATE_LIMITED"


async def orchestrator_agent(message: str, planet: str = "Earth", session_id: str = "default") -> dict:
    """Classify user intent."""
    prompt = f"User message: {message}\nCurrently viewing: {planet}"
    
    try:
        content = await call_openrouter(prompt, SYSTEM_PROMPT_ORCHESTRATOR.format(message=message, planet=planet), max_tokens=100)
        if content == "RATE_LIMITED":
            fallback = determine_navigation_fallback(message, session_id)
            msg_lower = message.lower()
            if any(w in msg_lower for w in ["go", "take", "travel", "navigate", "visit"]) or fallback.target.lower() != planet.lower():
                return {"intent": "navigate", "target": fallback.target}
            return {"intent": "rate_limited", "target": planet}
        return safe_json_parse(content, {"intent": "explain", "target": planet})
    except Exception:
        return {"intent": "explain", "target": planet}


async def explanation_agent_stream(prompt: str, planet: str, user_level: str, history: str = ""):
    """Generate explanation with streaming."""
    if user_level not in USER_LEVELS:
        user_level = "beginner"
    
    system_prompt = SYSTEM_PROMPT_EXPLAINER_ADVANCED.format(planet=planet) if user_level == "advanced" else SYSTEM_PROMPT_EXPLAINER_BEGINNER.format(planet=planet)
    
    full_prompt = f"Conversation history:\n{history}\n\nCurrent question: {prompt}"
    
    full_response = ""
    async for token in call_openrouter_stream(full_prompt, system_prompt):
        full_response = token
        yield full_response


async def quiz_agent(planet: str) -> dict:
    """Generate quiz question."""
    try:
        content = await call_openrouter(planet, SYSTEM_PROMPT_QUIZ.format(planet=planet), max_tokens=200)
        fallback = {
            "question": f"What is unique about {planet}?",
            "options": ["Mercury", "Venus", "Earth", "Mars"],
            "correct": "Mercury",
            "explanation": "Mercury orbits closest to the Sun at 57.9 million km."
        }
        return safe_json_parse(content, fallback)
    except Exception:
        return {
            "question": f"What is unique about {planet}?",
            "options": ["Mercury", "Venus", "Earth", "Mars"],
            "correct": "Mercury",
            "explanation": "Quiz generation failed. Try again!"
        }


def determine_navigation_fallback(prompt: str, session_id: str = "default") -> CameraAction:
    """Fallback rule-based navigation if LLM fails."""
    celestial_bodies = ["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "asteroid belt"]
    
    prompt_lower = prompt.lower()
    detected_body = None
    detected_action = "focus"
    
    pronouns = ["it", "its", "them", "they", "that"]
    
    if any(p in prompt_lower for p in pronouns):
        history = memory.get_history(session_id)
        for msg in reversed(history):
            if msg["role"] == "assistant":
                for body in celestial_bodies:
                    if body in msg["content"].lower():
                        detected_body = body.capitalize()
                        break
                break
    
    if not detected_body:
        for body in celestial_bodies:
            if body in prompt_lower:
                detected_body = body.capitalize() if body != "asteroid belt" else "Asteroid Belt"
                break
    
    if "zoom" in prompt_lower or "closer" in prompt_lower:
        detected_action = "zoom"
    elif "orbit" in prompt_lower or "around" in prompt_lower:
        detected_action = "orbit"
    elif "reset" in prompt_lower:
        detected_action = "reset"
    
    if not detected_body:
        detected_body = "Earth"
    
    return CameraAction(target=detected_body, action=detected_action)


async def generate_response(prompt: str, user_level: str = "beginner", session_id: str = "default") -> SimulatorResponse:
    memory.add_message(session_id, "user", prompt)
    
    history = memory.format_history(session_id)
    current_planet = "Earth"
    
    try:
        intent_data = await orchestrator_agent(prompt, current_planet)
        intent = intent_data.get("intent", "explain")
        target = intent_data.get("target", current_planet)
    except Exception:
        intent = "explain"
        target = current_planet
    
    if intent == "quiz":
        try:
            quiz = await quiz_agent(target)
            chat_response = f"Quiz about {target}: {quiz.get('question', 'No question')}"
        except Exception:
            chat_response = "Failed to generate quiz. Try again!"
        
        memory.add_message(session_id, "assistant", chat_response)
        
        return SimulatorResponse(
            camera_action=CameraAction(target=target, action="focus"),
            chat_response=chat_response,
            session_id=session_id
        )
    
    camera_action = CameraAction(target=target, action="focus")
    
    try:
        chat_response = await call_openrouter(
            f"Conversation history:\n{history}\n\nCurrent question: {prompt}",
            SYSTEM_PROMPT_EXPLAINER_BEGINNER.format(planet=target) if user_level != "advanced" else SYSTEM_PROMPT_EXPLAINER_ADVANCED.format(planet=target),
            max_tokens=500
        )
    except Exception as e:
        chat_response = f"I encountered an error: {str(e)}"
    
    memory.add_message(session_id, "assistant", chat_response)
    
    return SimulatorResponse(
        camera_action=camera_action,
        chat_response=chat_response,
        session_id=session_id
    )


async def generate_response_stream(prompt: str, user_level: str = "beginner", session_id: str = "default"):
    """Generate response with streaming for SSE."""
    memory.add_message(session_id, "user", prompt)
    
    history = memory.format_history(session_id)
    current_planet = "Earth"
    
    try:
        intent_data = await orchestrator_agent(prompt, current_planet)
        intent = intent_data.get("intent", "explain")
        target = intent_data.get("target", current_planet)
    except Exception:
        intent = "explain"
        target = current_planet
    
    if intent == "quiz":
        try:
            quiz = await quiz_agent(target)
            yield f"data: {json.dumps({'intent': 'quiz', 'quiz': quiz})}\n\n"
            memory.add_message(session_id, "assistant", f"Quiz about {target}")
        except Exception:
            pass
        return
    
    system_prompt = SYSTEM_PROMPT_EXPLAINER_BEGINNER.format(planet=target) if user_level != "advanced" else SYSTEM_PROMPT_EXPLAINER_ADVANCED.format(planet=target)
    full_prompt = f"Conversation history:\n{history}\n\nCurrent question: {prompt}"
    
    full_response = ""
    async for token in call_openrouter_stream(full_prompt, system_prompt):
        full_response += token
        yield f"data: {json.dumps({'token': token})}\n\n"
    
    memory.add_message(session_id, "assistant", full_response)
