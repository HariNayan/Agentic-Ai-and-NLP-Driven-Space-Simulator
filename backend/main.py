from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import json
import os
import traceback
import asyncio
from dotenv import load_dotenv

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


class ChatRequest(BaseModel):
    message: str
    selected_planet: str = "Earth"
    user_level: str = "beginner"
    session_id: str = "default"
    history: list = []


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Process user chat input - returns JSON for navigate/quiz, stream for explain."""
    try:
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        from agents import (
            orchestrator_agent,
            quiz_agent,
            call_openrouter_stream,
            SYSTEM_PROMPT_EXPLAINER_BEGINNER,
            SYSTEM_PROMPT_EXPLAINER_ADVANCED,
            memory
        )
        
        memory.add_message(request.session_id, "user", request.message)
        history = memory.format_history(request.session_id)
        current_planet = request.selected_planet
        
        intent_data = await orchestrator_agent(request.message, current_planet)
        intent = intent_data.get("intent", "explain")
        target = intent_data.get("target", current_planet)
        
        if intent == "rate_limited":
            return JSONResponse(content={
                "intent": "error",
                "message": "AI service is temporarily rate-limited. Please wait a moment and try again.",
                "error": "rate_limit"
            })
        
        if intent == "navigate":
            memory.add_message(request.session_id, "assistant", f"Navigating to {target}!")
            
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
            
            memory.add_message(request.session_id, "assistant", f"Quiz about {target}")
            
            return JSONResponse(content={
                "intent": "quiz",
                "quiz": quiz
            })
        
        system_prompt = SYSTEM_PROMPT_EXPLAINER_ADVANCED.format(planet=target) if request.user_level == "advanced" else SYSTEM_PROMPT_EXPLAINER_BEGINNER.format(planet=target)
        full_prompt = f"Conversation history:\n{history}\n\nCurrent question: {request.message}"
        
        async def token_stream():
            full_response = ""
            async for token in call_openrouter_stream(full_prompt, system_prompt):
                if token == "RATE_LIMITED":
                    yield f"data: {json.dumps({'token': 'AI is rate-limited. Please wait and try again.'})}\n\n"
                    return
                full_response += token
                yield f"data: {json.dumps({'token': token})}\n\n"
            
            memory.add_message(request.session_id, "assistant", full_response)
        
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
    """Clear session memory."""
    try:
        from agents import memory
        memory.clear(session_id)
        return {"status": "cleared", "session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing session: {str(e)}")


@app.get("/api/test")
async def test_ai():
    try:
        import httpx
        models_to_try = [
            "google/gemma-4-31b-it:free",
            "google/gemma-4-26b-a4b-it:free",
            "qwen/qwen3-next-80b-a3b-instruct:free",
            "minimax/minimax-m2.5:free"
        ]
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for model in models_to_try:
                try:
                    r = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                            "Content-Type": "application/json"
                        },
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
            
            return {"status": 429, "error": "All free models are rate-limited. Please try again later."}
    except Exception as e:
        return {"error": str(e)}


@app.get("/")
def root():
    return {"status": "running", "message": "Space Simulator Backend API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
