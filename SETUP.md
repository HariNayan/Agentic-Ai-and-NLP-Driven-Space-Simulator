# Agentic AI Interactive Space Simulator

## First-Time Setup

### Frontend

```bash
cd D:/Coding/Space
cd frontend
npm install
```

### Backend

```bash
cd D:/Coding/Space
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Use `backend\venv`, not the repo-level `.venv`, when running the FastAPI server.

---

## Running the Application

1. **Start Backend**: In `backend/`, activate `venv` and run `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
2. **Start Frontend**: In `frontend/`, run `npm run dev`
3. Open `http://localhost:3000` in your browser
