import os
import json
import httpx
from typing import Dict, List, Optional
from datetime import datetime, timezone
from dotenv import load_dotenv

from schemas import CameraAction

load_dotenv()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
MODEL = os.getenv("MODEL", "minimax-m2.7")

FALLBACK_MODELS = [
    MODEL,
    "meta/llama-3.1-8b-instruct",
    "mistralai/mistral-7b-instruct-v0.3",
    "google/gemma-2-9b-it",
    "microsoft/phi-3-mini-128k-instruct",
]

BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {NVIDIA_API_KEY}",
    "Content-Type": "application/json"
}

BODY_NAME_MAP = {
    "sun": "Sun",
    "mercury": "Mercury",
    "venus": "Venus",
    "earth": "Earth",
    "moon": "Moon",
    "mars": "Mars",
    "jupiter": "Jupiter",
    "saturn": "Saturn",
    "uranus": "Uranus",
    "neptune": "Neptune",
}
QUIZ_BODIES = list(BODY_NAME_MAP.keys())
NAVIGATION_BODIES = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]
NAVIGATE_KEYWORDS = ["go to", "take me", "navigate to", "travel to", "fly to", "visit", "show me", "zoom to"]
QUIZ_KEYWORDS = ["quiz", "test me", "question", "mcq", "multiple choice", "ask me"]

# ── Planet Database ──────────────────────────────────────────────────────────
PLANET_DB: dict[str, dict] = {
    "Mercury": { "radius": 2440, "mass": "3.30e23 kg", "gravity": "3.7 m/s²", "day": "58.6 Earth days", "year": "88 Earth days", "moons": 0, "temp": "-180 to 430°C", "fun_fact": "A year on Mercury is just 88 Earth days!" },
    "Venus":   { "radius": 6052, "mass": "4.87e24 kg", "gravity": "8.9 m/s²", "day": "243 Earth days", "year": "225 Earth days", "moons": 0, "temp": "465°C avg", "fun_fact": "Venus rotates backwards — the Sun rises in the west!" },
    "Earth":   { "radius": 6371, "mass": "5.97e24 kg", "gravity": "9.8 m/s²", "day": "24 hours", "year": "365.25 days", "moons": 1, "temp": "-89 to 57°C", "fun_fact": "Earth is the only known planet with liquid water on its surface." },
    "Mars":    { "radius": 3390, "mass": "6.42e23 kg", "gravity": "3.7 m/s²", "day": "24.6 hours", "year": "687 Earth days", "moons": 2, "temp": "-140 to 20°C", "fun_fact": "Olympus Mons on Mars is 2.5x taller than Mount Everest!" },
    "Jupiter": { "radius": 69911, "mass": "1.90e27 kg", "gravity": "24.8 m/s²", "day": "9.9 hours", "year": "11.9 Earth years", "moons": "95+", "temp": "-110°C (cloud top)", "fun_fact": "Jupiter's four Galilean moons — Io, Europa, Ganymede, and Callisto — were discovered by Galileo in 1610." },
    "Saturn":  { "radius": 58232, "mass": "5.68e26 kg", "gravity": "10.4 m/s²", "day": "10.7 hours", "year": "29.5 Earth years", "moons": "140+", "temp": "-140°C", "fun_fact": "Titan is the only moon in the solar system with a thick atmosphere." },
    "Uranus":  { "radius": 25362, "mass": "8.68e25 kg", "gravity": "8.9 m/s²", "day": "17.2 hours", "year": "84 Earth years", "moons": 27, "temp": "-195°C", "fun_fact": "Uranus rotates on its side — axial tilt of 98 degrees!" },
    "Neptune": { "radius": 24622, "mass": "1.02e26 kg", "gravity": "11.2 m/s²", "day": "16.1 hours", "year": "165 Earth years", "moons": 14, "temp": "-200°C", "fun_fact": "Triton, Neptune's largest moon, orbits in the opposite direction of all other large moons — a retrograde orbit!" },
    "Sun":     { "radius": 695508, "mass": "1.99e30 kg", "gravity": "274 m/s²", "day": "25 days", "year": "N/A", "moons": 0, "temp": "5500°C surface / 15M°C core", "fun_fact": "The Sun contains 99.86% of all mass in the solar system!" },
    "Moon":    { "radius": 1737, "mass": "7.35e22 kg", "gravity": "1.6 m/s²", "day": "27.3 days", "year": "27.3 days", "moons": 0, "temp": "-233 to 123°C", "fun_fact": "The Moon is slowly drifting away from Earth — about 3.8 cm per year!" },
}

# ── Tool Definitions (OpenAI function-calling schema) ──────────────────────────
FUNCTIONS = [
    {
        "name": "get_planet_data",
        "description": "Get physical data about a planet or celestial body (radius, mass, gravity, temperature, fun facts)",
        "parameters": {
            "type": "object",
            "properties": {
                "planet": {"type": "string", "description": "Name of the planet (e.g. Mars, Jupiter, Saturn)"}
            },
            "required": ["planet"]
        }
    },
    {
        "name": "get_space_news",
        "description": "Get the latest space news headlines",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_orbital_position",
        "description": "Get current orbital position of a planet based on real Keplerian elements",
        "parameters": {
            "type": "object",
            "properties": {
                "planet": {"type": "string", "description": "Name of the planet"}
            },
            "required": ["planet"]
        }
    },
    {
        "name": "get_upcoming_launches",
        "description": "Get upcoming space launches",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
]

# ── Curriculum System ────────────────────────────────────────────────────────
LESSONS = {
    "beginner": [
        {"id": "intro", "title": "Welcome to the Solar System", "topics": ["planets", "sun", "order from sun"], "quiz_planet": "Earth"},
        {"id": "inner", "title": "The Inner Planets", "topics": ["mercury", "venus", "earth", "mars", "terrestrial planets"], "quiz_planet": "Mars"},
        {"id": "outer", "title": "The Outer Planets", "topics": ["jupiter", "saturn", "uranus", "neptune", "gas giants"], "quiz_planet": "Jupiter"},
    ],
    "intermediate": [
        {"id": "orbits", "title": "Orbital Mechanics", "topics": ["elliptical orbits", "gravity", "kepler's laws", "eccentricity"], "quiz_planet": "Saturn"},
        {"id": "moons", "title": "Moons of the Solar System", "topics": ["earth's moon", "titan", "europa", "enceladus", "phobos"], "quiz_planet": "Saturn"},
        {"id": "extremes", "title": "Planetary Extremes", "topics": ["tallest mountain", "deepest canyon", "hottest planet", "coldest planet"], "quiz_planet": "Neptune"},
    ],
    "advanced": [
        {"id": "exoplanets", "title": "Exoplanets & Habitability", "topics": ["exoplanets", "habitable zone", "trappist-1", "kepler mission"], "quiz_planet": "Earth"},
        {"id": "space_weather", "title": "Space Weather & Solar Activity", "topics": ["solar flares", "coronal mass ejections", "aurora", "magnetosphere"], "quiz_planet": "Sun"},
        {"id": "missions", "title": "Deep Space Missions", "topics": ["voyager", "perseverance", "juno", "jwst", "artemis"], "quiz_planet": "Mars"},
    ],
}

class Curriculum:
    def __init__(self):
        self.progress: Dict[str, dict] = {}

    def get_user_level(self, session_id: str) -> str:
        p = self.progress.get(session_id, {"level": "beginner", "completed": []})
        completed = set(p["completed"])
        if all(l["id"] in completed for l in LESSONS["intermediate"]):
            return "advanced"
        if all(l["id"] in completed for l in LESSONS["beginner"]):
            return "intermediate"
        return "beginner"

    def complete_lesson(self, session_id: str, lesson_id: str):
        if session_id not in self.progress:
            self.progress[session_id] = {"level": "beginner", "completed": []}
        if lesson_id not in self.progress[session_id]["completed"]:
            self.progress[session_id]["completed"].append(lesson_id)
        self.progress[session_id]["level"] = self.get_user_level(session_id)

    def get_next_lesson(self, session_id: str) -> Optional[dict]:
        level = self.get_user_level(session_id)
        completed = set(self.progress.get(session_id, {}).get("completed", []))
        for lesson in LESSONS[level]:
            if lesson["id"] not in completed:
                return lesson
        return None

    def get_current_lessons(self, session_id: str) -> list:
        level = self.get_user_level(session_id)
        return LESSONS.get(level, [])

    def clear(self, session_id: str):
        if session_id in self.progress:
            del self.progress[session_id]

curriculum = Curriculum()

# ── Tool Execution ───────────────────────────────────────────────────────────
async def execute_tool(name: str, args: dict) -> str:
    if name == "get_planet_data":
        planet = args.get("planet", "").capitalize()
        if planet in PLANET_DB:
            d = PLANET_DB[planet]
            return json.dumps(d)
        return json.dumps({"error": f"No data for {planet}"})

    if name == "get_space_news":
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get("https://api.spaceflightnewsapi.net/v4/articles/?limit=5")
                if r.status_code == 200:
                    articles = r.json().get("results", [])
                    headlines = [a["title"] for a in articles[:5]]
                    return json.dumps({"headlines": headlines})
        except Exception:
            pass
        return json.dumps({"headlines": ["Space news temporarily unavailable"]})

    if name == "get_orbital_position":
        planet = args.get("planet", "").capitalize()
        j2000 = datetime(2000, 1, 1, 12, 0, tzinfo=timezone.utc).timestamp() * 1000
        days = (datetime.now(timezone.utc).timestamp() * 1000 - j2000) / 86400000
        orbital_data = {
            "Mercury": {"l0": 252.25, "daily": 4.092, "e": 0.2056, "a": 0.387},
            "Venus":   {"l0": 181.98, "daily": 1.602, "e": 0.0068, "a": 0.723},
            "Earth":   {"l0": 100.46, "daily": 0.986, "e": 0.0167, "a": 1.000},
            "Mars":    {"l0": 355.45, "daily": 0.524, "e": 0.0934, "a": 1.524},
            "Jupiter": {"l0": 34.35,  "daily": 0.083, "e": 0.0484, "a": 5.203},
            "Saturn":  {"l0": 50.08,  "daily": 0.033, "e": 0.0542, "a": 9.537},
            "Uranus":  {"l0": 314.06, "daily": 0.012, "e": 0.0472, "a": 19.191},
            "Neptune": {"l0": 304.35, "daily": 0.006, "e": 0.0086, "a": 30.069},
        }
        if planet not in orbital_data:
            return json.dumps({"error": f"No orbital data for {planet}"})
        o = orbital_data[planet]
        angle = ((o["l0"] + o["daily"] * days) % 360 + 360) % 360
        return json.dumps({"planet": planet, "mean_longitude_deg": round(angle, 2), "eccentricity": o["e"], "semi_major_axis_au": o["a"]})

    if name == "get_upcoming_launches":
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=5&format=json")
                if r.status_code == 200:
                    launches = r.json().get("results", [])
                    result = [{"name": l["name"], "date": l.get("net", "")[:10], "provider": l.get("launch_service_provider", {}).get("name", "Unknown")} for l in launches[:5]]
                    return json.dumps({"launches": result})
        except Exception:
            pass
        return json.dumps({"launches": ["Launch data temporarily unavailable"]})

    return json.dumps({"error": f"Unknown tool: {name}"})

# ── Intent Classification ────────────────────────────────────────────────────
def classify_intent(message: str, current_planet: str) -> tuple[str, str]:
    msg_lower = message.lower()
    for kw in QUIZ_KEYWORDS:
        if kw in msg_lower:
            for body in QUIZ_BODIES:
                if body in msg_lower:
                    return "quiz", BODY_NAME_MAP[body]
            return "quiz", current_planet
    for kw in NAVIGATE_KEYWORDS:
        if kw in msg_lower:
            for body in NAVIGATION_BODIES:
                if body in msg_lower:
                    return "navigate", BODY_NAME_MAP[body]
            return "navigate", current_planet
    return "explain", current_planet


async def orchestrate_intent(message: str, current_planet: str, history: str) -> tuple[str, str]:
    prompt = f"""Current planet: {current_planet}
Conversation history:
{history}

User message: {message}

Classify intent and extract target. Return ONLY JSON. No markdown.
{{"intent": "explain"|"navigate"|"quiz", "target": "planet_name"}}"""
    try:
        llm_result = await call_llm(prompt, SYSTEM_PROMPT_ORCHESTRATOR, max_tokens=100, temperature=0.1)
        content = llm_result["content"]
        if content == "RATE_LIMITED" or content.startswith("API key"):
            return classify_intent(message, current_planet)
        parsed = safe_json_parse(content, {})
        intent = parsed.get("intent", "explain")
        if intent not in ("explain", "navigate", "quiz"):
            intent = "explain"
        raw_target = str(parsed.get("target", current_planet)).strip().lower()
        if intent == "navigate":
            target = BODY_NAME_MAP.get(raw_target, current_planet)
            if raw_target not in NAVIGATION_BODIES:
                target = current_planet
        elif intent == "quiz":
            target = BODY_NAME_MAP.get(raw_target, current_planet)
        else:
            target = BODY_NAME_MAP.get(raw_target, parsed.get("target", current_planet).capitalize())
        return intent, target
    except Exception:
        return classify_intent(message, current_planet)


# ── Agent Loop (Tool-Using) ──────────────────────────────────────────────────
TOOL_SYSTEM_PROMPT = """You are an AI space educator with access to real-time space data tools.
When the user asks something that could benefit from live data, call a function.

Available functions:
- get_planet_data(planet): physical data about any planet
- get_space_news(): latest space news headlines
- get_orbital_position(planet): current orbital position
- get_upcoming_launches(): upcoming space launches

Use the function you need by name with the required parameters.
If no tool is needed, respond normally.
Current planet context: {{planet}}
User level: {{level}}
Keep responses engaging and educational."""

async def agent_with_tools(prompt: str, planet: str, level: str, history: str) -> tuple[list[dict], str]:
    system = TOOL_SYSTEM_PROMPT.replace("{{planet}}", planet).replace("{{level}}", level)
    full_prompt = f"Conversation history:\n{history}\n\nUser: {prompt}"
    llm_result = await call_llm(full_prompt, system, max_tokens=300, temperature=0.7, functions=FUNCTIONS)
    func_call = llm_result.get("function_call")
    if func_call:
        try:
            name = func_call["name"]
            args = json.loads(func_call["arguments"]) if func_call.get("arguments") else {}
            result = await execute_tool(name, args)
            return [{"role": "assistant", "content": f"I'll look that up for you."}, {"role": "function", "name": name, "content": result}], name
        except Exception:
            pass
    return [{"role": "assistant", "content": llm_result["content"]}], ""


def build_tool_context_prompt(history: str, prompt: str, tool_calls: list, tool_results: list) -> str:
    ctx = f"Conversation history:\n{history}\n\n"
    for tc, tr in zip(tool_calls, tool_results):
        ctx += f"Tool used: {tc}\nTool result: {tr}\n\n"
    ctx += f"Now respond to the user's question incorporating the tool data above: {prompt}"
    return ctx

# ── Quiz Bank ────────────────────────────────────────────────────────────────
QUIZ_BANK: dict[str, dict] = {
    "Sun": { "question": "What is the Sun primarily made of?", "options": ["Oxygen and Carbon", "Hydrogen and Helium", "Iron and Nickel", "Nitrogen and Argon"], "correct": "Hydrogen and Helium", "explanation": "The Sun is about 73% hydrogen and 25% helium by mass." },
    "Mercury": { "question": "Why is Mercury difficult to observe from Earth?", "options": ["It's too small and too close to the Sun", "It has no atmosphere", "It's always cloudy", "It orbits backwards"], "correct": "It's too small and too close to the Sun", "explanation": "Mercury never strays far from the Sun in the sky." },
    "Venus": { "question": "Why is Venus hotter than Mercury?", "options": ["Active volcanoes", "Runaway greenhouse effect", "Its core is hotter", "Closer to Earth"], "correct": "Runaway greenhouse effect", "explanation": "Venus's thick CO₂ atmosphere traps heat, reaching 465°C." },
    "Earth": { "question": "What protects Earth from solar radiation?", "options": ["Ozone layer", "Magnetic field", "Atmosphere", "All of the above"], "correct": "All of the above", "explanation": "Earth's magnetic field, atmosphere, and ozone layer work together." },
    "Moon": { "question": "How long to orbit Earth?", "options": ["24 hours", "7 days", "27.3 days", "365 days"], "correct": "27.3 days", "explanation": "The Moon's sidereal period is 27.3 days." },
    "Mars": { "question": "Tallest mountain on Mars?", "options": ["Mount Everest", "Olympus Mons", "Mons Huygens", "Pavonis Mons"], "correct": "Olympus Mons", "explanation": "Olympus Mons stands 21.9 km tall." },
    "Jupiter": { "question": "How long observed Great Red Spot?", "options": ["50 years", "Over 350 years", "Since 2000", "100 years"], "correct": "Over 350 years", "explanation": "Observed since the 1600s, larger than Earth." },
    "Saturn": { "question": "Which moon has thick atmosphere?", "options": ["Enceladus", "Titan", "Mimas", "Rhea"], "correct": "Titan", "explanation": "Titan has a nitrogen atmosphere thicker than Earth's." },
    "Uranus": { "question": "What makes Uranus unique?", "options": ["Rotates backwards", "Rotates on its side", "No moons", "Coldest planet"], "correct": "Rotates on its side", "explanation": "Uranus has a 97.77° axial tilt." },
    "Neptune": { "question": "Fastest wind speed on Neptune?", "options": ["500 km/h", "1,200 km/h", "2,100 km/h", "3,000 km/h"], "correct": "2,100 km/h", "explanation": "Fastest winds in the solar system." },
}
DEFAULT_QUIZ = { "question": "Which planet is known as the Red Planet?", "options": ["Venus", "Mars", "Jupiter", "Saturn"], "correct": "Mars", "explanation": "Mars appears red due to iron oxide." }

# ── Session Memory ───────────────────────────────────────────────────────────
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

    def add_tool_result(self, session_id: str, tool: str, result: str):
        self.add_message(session_id, "tool", f"[{tool}] {result}")

    def format_history(self, session_id: str) -> str:
        history = self.get_history(session_id)
        if not history:
            return ""
        formatted = []
        for msg in history:
            role = "User" if msg["role"] == "user" else "Assistant" if msg["role"] == "assistant" else "System"
            if msg["role"] == "tool":
                formatted.append(f"[Data] {msg['content']}")
            else:
                formatted.append(f"{role}: {msg['content']}")
        return "\n".join(formatted)

    def clear(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id] = []

memory = ConversationMemory(max_turns=10)

# ── Prompts ──────────────────────────────────────────────────────────────────
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

SYSTEM_PROMPT_QUIZ = """Generate 1 multiple choice question about {planet}.
Return ONLY raw JSON. No markdown. No code fences.
Example: {{"question": "...", "options": ["A","B","C","D"],
"correct": "B", "explanation": "..."}}"""

USER_LEVELS = ["beginner", "intermediate", "advanced"]

# ── Utility Functions ────────────────────────────────────────────────────────
def safe_json_parse(raw: str, fallback: dict) -> dict:
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


async def call_llm(prompt: str, system_prompt: str, max_tokens: int = 500, temperature: float = 0.7, functions: Optional[list] = None) -> dict:
    if not NVIDIA_API_KEY:
        return {"content": "API key not configured. Please add NVIDIA_API_KEY to .env file.", "function_call": None}
    async with httpx.AsyncClient(timeout=15.0) as client:
        for model in FALLBACK_MODELS:
            try:
                body = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature
                }
                if functions:
                    body["functions"] = functions
                    body["function_call"] = "auto"
                response = await client.post(BASE_URL, headers=HEADERS, json=body)
                if response.status_code == 200:
                    data = response.json()
                    msg = data["choices"][0]["message"]
                    return {"content": msg.get("content", ""), "function_call": msg.get("function_call")}
            except Exception:
                continue
    return {"content": "RATE_LIMITED", "function_call": None}


async def call_llm_stream(prompt: str, system_prompt: str, max_tokens: int = 512, temperature: float = 0.8):
    if not NVIDIA_API_KEY:
        yield "API key not configured."
        return
    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in FALLBACK_MODELS:
            try:
                success = False
                async with client.stream(
                    "POST",
                    BASE_URL,
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


async def quiz_agent(planet: str) -> dict:
    try:
        llm_result = await call_llm(planet, SYSTEM_PROMPT_QUIZ.format(planet=planet), max_tokens=200)
        return safe_json_parse(llm_result["content"], QUIZ_BANK.get(planet, DEFAULT_QUIZ))
    except Exception:
        return QUIZ_BANK.get(planet, DEFAULT_QUIZ)


def record_quiz_result(session_id: str, planet: str, correct: bool) -> dict:
    current_level = curriculum.get_user_level(session_id)
    next_lesson = curriculum.get_next_lesson(session_id)

    if not correct:
        return {
            "correct": False,
            "lesson_completed": False,
            "level": current_level,
            "next_lesson": next_lesson,
        }

    if not next_lesson or next_lesson["quiz_planet"] != planet:
        return {
            "correct": True,
            "lesson_completed": False,
            "level": current_level,
            "next_lesson": next_lesson,
        }

    completed_lesson = next_lesson
    curriculum.complete_lesson(session_id, completed_lesson["id"])
    new_level = curriculum.get_user_level(session_id)

    return {
        "correct": True,
        "lesson_completed": True,
        "completed_lesson": completed_lesson,
        "level": new_level,
        "next_lesson": curriculum.get_next_lesson(session_id),
    }


def determine_navigation_fallback(prompt: str, session_id: str = "default") -> CameraAction:
    prompt_lower = prompt.lower()
    detected_body = None
    detected_action = "focus"
    pronouns = ["it", "its", "them", "they", "that"]
    if any(p in prompt_lower for p in pronouns):
        history = memory.get_history(session_id)
        for msg in reversed(history):
            if msg["role"] == "assistant":
                for body in NAVIGATION_BODIES:
                    if body in msg["content"].lower():
                        detected_body = BODY_NAME_MAP[body]
                        break
                break
    if not detected_body:
        for body in NAVIGATION_BODIES:
            if body in prompt_lower:
                detected_body = BODY_NAME_MAP[body]
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
