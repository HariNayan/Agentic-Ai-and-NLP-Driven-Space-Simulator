# Space Monitor

## First-Time Setup

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NASA_API_KEY=your-nasa-api-key-here
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Backend

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
# source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` from `backend/.env.example`:

```env
NVIDIA_API_KEY=nvapi-your-key-here
MODEL=minimax-m2.7
FRONTEND_ORIGIN=http://localhost:3000
```

Use `backend\venv`, not the repo-level `.venv`, when running the FastAPI server.

---

## Running the Application

1. **Start Backend**: In `backend/`, activate `venv` and run `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
2. **Start Frontend**: In `frontend/`, run `npm run dev`
3. Open `http://localhost:3000` in your browser
