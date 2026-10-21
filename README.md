# CampusPulse 🎓

An AI-powered college companion — attendance tracking, notice analysis, deadline management, and document Q&A with full source citations.

## Monorepo Layout

```
campuspulse/
├── frontend/        React + Vite + TypeScript + Tailwind  → deploys to Vercel
├── backend/         Python + FastAPI                       → deploys to Render
└── supabase/        SQL migrations + RLS policies
```

## Quick Start (local dev)

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # fill in your Supabase keys
npm run dev                  # http://localhost:5173
```

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
cp .env.example .env         # fill in keys
uvicorn app.main:app --reload  # http://localhost:8000
```

## Environment Variables

See `frontend/.env.example` and `backend/.env.example` — **never commit real `.env` files.**

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Auth + DB | Supabase (Postgres + RLS) |
| File Storage | Supabase Storage (private bucket) |
| Backend API | Python 3.11+, FastAPI |
| PDF Parsing | PyMuPDF |
| Search | Postgres full-text search (tsv column) |
| LLM | Swappable via `backend/app/llm.py` |
| Deployment | Vercel (frontend), Render (backend) |

## Phases

- [x] Phase 1 — Repo setup
- [ ] Phase 2 — React shell + design system
- [ ] Phase 3 — Attendance tracker + timetable
- [ ] Phase 4 — Supabase auth + real data
- [ ] Phase 5 — PDF upload + Notice Analyzer
- [ ] Phase 6 — AI Assistant with citations
- [ ] Phase 7 — Integration + error handling
- [ ] Phase 8 — Testing + accessibility
- [ ] Phase 9 — Deployment + README
- [ ] Phase 10 — Pitch prep
