# CampusPulse 🎓

> **AI-powered college companion** — attendance tracking, PDF notice analysis, deadline management, and document Q&A with **verifiable source citations**.

Built for a 48-hour hackathon by a solo BCA student.  
Live demo: *add your Vercel URL here after deployment*

---

## ✨ Key Features

| Feature | What it does |
|---|---|
| **Attendance Tracker** | Mark present/absent per subject, see your live % and how many classes you can skip/must attend to hit 75%. |
| **Notice Analyzer** | Upload a PDF circular or paste text → get a simple-English summary + structured deadlines/eligibility with **verbatim source quotes**. |
| **Confirmation Queue** | Extracted deadlines sit in a "Needs Confirmation" queue — you confirm, edit, or reject before they sync to your reminders. |
| **AI Assistant (RAG)** | Ask anything about your uploaded documents. Every answer comes with verifiable citations (document name, page number, exact quote). |
| **Anti-Hallucination** | Model only sees abstract chunk IDs. The **server** maps them to document names/page numbers. No invented citations are possible. |
| **RLS Isolation** | Every Supabase row is scoped to `auth.uid()`. User B can never read User A's documents, attendance, or chat history. |

---

## 🗂 Monorepo Layout

```
campuspulse/
├── frontend/          React 18 + Vite + TypeScript + Tailwind CSS  → Vercel
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/    AppLayout, Sidebar, TopBar, ProtectedRoute
│   │   │   └── ui/        Button, Card, Badge, EmptyState, Spinner, Toast, NetworkErrorBoundary
│   │   ├── lib/
│   │   │   ├── api.ts         Typed FastAPI client (auth-injecting)
│   │   │   ├── attendance.ts  Pure attendance math (23 unit tests)
│   │   │   ├── AuthContext.tsx Supabase auth + profile state
│   │   │   └── supabase.ts    Typed Supabase client
│   │   ├── pages/
│   │   │   ├── Auth.tsx       Sign-up / Sign-in
│   │   │   ├── Dashboard.tsx  Live stats + overview
│   │   │   ├── Attendance.tsx Full tracker with optimistic UI
│   │   │   ├── Notices.tsx    PDF upload + analysis + confirmation queue
│   │   │   ├── Timetable.tsx  Timetable + deadline manager
│   │   │   └── Assistant.tsx  Chat UI with citation cards
│   │   └── types/index.ts     Shared database types
│   └── vercel.json            SPA rewrite + security headers
│
├── backend/           Python 3.11+ + FastAPI  → Render
│   ├── app/
│   │   ├── main.py            App factory, CORS, rate limiter, /health
│   │   ├── auth.py            JWT verification (Supabase HS256)
│   │   ├── config.py          Pydantic settings (env-driven)
│   │   ├── llm.py             Swappable LLM adapter (Google Gemini / OpenAI)
│   │   ├── routers/
│   │   │   ├── documents.py   POST /api/documents, DELETE /api/documents/{id}
│   │   │   ├── notices.py     POST /api/notices/analyze
│   │   │   └── assistant.py   POST /api/assistant/ask, GET/DELETE history
│   │   └── services/
│   │       ├── pdf_service.py       PDF validation + chunking (PyMuPDF + pure-Python fallback)
│   │       ├── supabase_service.py  Storage + Postgres calls (forwards student JWT)
│   │       ├── analyzer_service.py  Notice analysis with prompt-injection defense
│   │       └── assistant_service.py RAG pipeline + citation verification
│   ├── tests/                 19 unit tests (all pass)
│   └── render.yaml            One-click Render deployment
│
└── supabase/
    └── migrations/001_initial_schema.sql   All tables, RLS policies, triggers, storage
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- Node.js 18+
- Python 3.11+
- A free [Supabase](https://supabase.com) project

### 1. Database Setup
Run `supabase/migrations/001_initial_schema.sql` in your Supabase **SQL Editor** (Dashboard → SQL Editor → New query → paste → Run).

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
npm run dev          # http://localhost:5173
npm run test         # 23 unit tests
npm run build        # production build check
```

### 3. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# or: source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, LLM_API_KEY
uvicorn app.main:app --reload  # http://localhost:8000
python -m pytest               # 19 tests
```

---

## 🔑 Environment Variables

### `frontend/.env.local`
| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_API_BASE_URL` | FastAPI backend URL (e.g. `http://localhost:8000`) |

### `backend/.env`
| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_JWT_SECRET` | Found in Supabase Dashboard → Settings → API → JWT Secret |
| `LLM_PROVIDER` | `google` (Gemini) or `openai` |
| `LLM_API_KEY` | Your Google AI Studio or OpenAI API key |
| `LLM_MODEL` | e.g. `gemini-1.5-flash` or `gpt-4o-mini` |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins for CORS |

---

## ☁️ Deployment

### Frontend → Vercel
1. Push this repo to GitHub.
2. Import in Vercel, set **Root Directory** to `frontend`.
3. Add environment variables from the table above.
4. Vercel auto-detects Vite. The `vercel.json` handles SPA routing.

### Backend → Render
1. In Render → New Web Service → connect your repo.
2. Set **Root Directory** to `backend`, **Build Command** to `pip install -r requirements.txt`, **Start Command** to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Add environment variables. Set `ALLOWED_ORIGINS` to your Vercel deployment URL.
4. Alternatively, use the included `render.yaml` for one-click deployment.

---

## 🏗 Architecture

```
┌─────────────────────────────┐         ┌────────────────────────────────┐
│         React (Vercel)       │         │       FastAPI (Render)          │
│                             │◄───────►│                                │
│  Auth / Attendance /        │  JWT    │  POST /api/documents           │
│  Timetable — direct         │         │  POST /api/notices/analyze     │
│  Supabase (RLS-protected)   │         │  POST /api/assistant/ask       │
└────────────┬────────────────┘         └───────────────┬────────────────┘
             │                                          │
             │  Supabase JS SDK                         │  httpx (forwards JWT)
             ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Supabase (Postgres + Storage)                  │
│                                                                        │
│  subjects  attendance_records  reminders  extracted_items              │
│  documents  document_chunks  chat_messages  profiles                   │
│  Storage bucket: "documents" (private, RLS-scoped)                     │
└────────────────────────────────────────────────────────────────────────┘
```

### Anti-Hallucination Pipeline

```
Student question
      │
      ▼
Postgres full-text search (tsv GIN index) → top K chunks
      │
      ├─ 0 results → return {status: "not_found"} — LLM never called
      │
      ▼
Build prompt with chunk IDs only (chunk_0, chunk_1 …)
      │
      ▼
LLM returns {status, answer, citations: [{chunk_id, snippet}]}
      │
      ▼
Server maps chunk_id → real document_name + page_number
Server verifies snippet appears verbatim in chunk text
      │
      ▼
Student sees: answer + [Doc Name · Page N · "exact quote"]
```

---

## 🛡 Security

- **JWT Auth**: Every backend call validates the Supabase HS256 JWT. No anonymous access.
- **RLS Isolation**: Every Postgres table has `auth.uid()` policies. Tested to confirm cross-user reads are blocked.
- **PDF Validation**: Magic bytes check (`%PDF-` header), extension check, size limit (10 MB), page limit (50), extractable-text check.
- **Prompt Injection Defense**: Notice content is wrapped in `<document_data>…</document_data>` tags before being injected into the LLM prompt.
- **Rate Limiting**: `slowapi` enforces 10 req/min on uploads, 20/min on analysis, 30/min on assistant.
- **No Secrets in Code**: All keys are in `.env` files excluded by `.gitignore`.

---

## 🧪 Testing

```bash
# Frontend — 23 pure-math attendance tests
cd frontend && npm run test

# Backend — 19 unit tests (anti-hallucination, PDF, notice analyzer, auth)
cd backend && python -m pytest -v
```

---

## 🧰 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS | Fast, type-safe, hackathon-friendly |
| Auth + DB | Supabase (Postgres + RLS) | Real multi-tenant security out of the box |
| File Storage | Supabase Storage (private bucket) | Scoped per user, no public URLs |
| Backend API | Python 3.11+, FastAPI | Async, fast, excellent OpenAPI docs |
| PDF Parsing | PyMuPDF (+ pure-Python fallback) | Reliable text extraction, Windows-compatible |
| Search | Postgres full-text search (GIN index) | No separate vector DB needed |
| LLM | Google Gemini (`gemini-1.5-flash`) | Swappable via `backend/app/llm.py` |
| Rate Limiting | slowapi | Protects LLM cost and prevents abuse |
| Deployment | Vercel (frontend) + Render (backend) | Free-tier hackathon-ready |

---

## 📁 Database Schema (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Student name, auto-created on sign-up via trigger |
| `subjects` | Courses a student tracks attendance for |
| `attendance_records` | Per-class present/absent entries |
| `reminders` | Confirmed deadline/reminder entries |
| `documents` | PDF metadata (file_name, page_count, status) |
| `document_chunks` | Per-page text with `tsv` full-text search vector |
| `extracted_items` | Items from Notice Analyzer (pending → confirmed/rejected) |
| `chat_messages` | AI assistant conversation history |

Full schema: [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)

---

*Built with ❤️ for the hackathon. No LangChain. No Docker. No hallucinations.*
