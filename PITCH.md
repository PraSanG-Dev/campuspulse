# CampusPulse — Hackathon Pitch & Judge Q&A Guide

## 🎤 3-Minute Pitch Structure

### Hook (20 seconds)
> "Every college student has faced this: a PDF circular buried in a WhatsApp group, a deadline they missed, attendance they couldn't track. CampusPulse is the AI companion that solves all three — and unlike every other AI tool, it **proves** every answer it gives you."

### Problem (30 seconds)
- Students miss deadlines hidden in long PDF circulars
- Attendance spreadsheets are manual and error-prone
- AI chatbots hallucinate exam dates and fee amounts — creating trust problems

### Solution Demo (90 seconds)
1. **Upload a PDF circular** → AI extracts "Scholarship deadline: Nov 15" → appears in Confirmation Queue
2. **Student clicks Confirm** → deadline syncs to reminders with a verified source quote
3. **Ask the AI assistant**: "What is the minimum CGPA for the scholarship?" → Answer + citation card: `Scholarship_Notice.pdf · Page 2 · "8.5 CGPA"`
4. **Attendance tracker**: "I have 14/20 classes. Can I skip any?" → live math answer

### Core Differentiator (20 seconds)
> "Other AI tools give you answers. CampusPulse gives you **verifiable** answers. Every citation is server-verified against the actual document text. The model cannot hallucinate a page number — the server maps it."

### Closing (20 seconds)
> "Built with React, FastAPI, Supabase, and Google Gemini in 48 hours. No LangChain. No Docker. No invented facts. CampusPulse — your college companion, built on trust."

---

## 🧑‍⚖️ Anticipated Judge Questions & Answers

### Architecture & AI

**Q: Why not use LangChain or LlamaIndex?**
> Those are powerful but add significant black-box complexity. For a trust-first product, I needed complete control over the prompt structure, citation verification, and fallback logic. Writing the RAG pipeline from scratch — ~200 lines — let me enforce the anti-hallucination rules I needed.

**Q: How do you prevent the AI from hallucinating page numbers?**
> The model never sees document names or page numbers. It only receives abstract chunk IDs like `chunk_0`. The *server* maps chunk IDs to their authenticated metadata (document name, page number). After the model responds, the server re-checks that every cited snippet appears verbatim in the cited chunk text. If it doesn't, the snippet is replaced with a real sentence from that chunk. If no valid chunks are cited, the answer is downgraded to `not_found`.

**Q: What happens when no relevant chunks are found?**
> The RAG pipeline short-circuits *before* calling the LLM. If full-text search returns zero results, the backend returns `{status: "not_found"}` directly. The LLM is never invoked, saving cost and preventing invented answers.

**Q: How does prompt injection defense work?**
> Student document content is wrapped in `<document_data>…</document_data>` tags in the system prompt. The model is instructed to treat anything inside those tags as data to analyze, not as instructions to follow. This prevents a malicious PDF from containing text like "Ignore all previous instructions."

**Q: How scalable is Postgres full-text search vs a vector DB?**
> Postgres FTS with a GIN index handles tens of thousands of document chunks efficiently. For a college-scale deployment (one institution, hundreds of students), it's more than sufficient. The architecture is designed so a pgvector column can be added to `document_chunks` later without changing the API contracts.

---

### Database & Security

**Q: How does RLS multi-tenancy work? Can User B see User A's documents?**
> Every table has a Row-Level Security policy enforcing `auth.uid() = user_id`. The backend forwards the student's Supabase JWT in every database and storage request. Supabase evaluates `auth.uid()` from that JWT server-side — not from any client-supplied value. Tested manually: querying another user's documents returns an empty result set.

**Q: Why does the frontend talk directly to Supabase for some things?**
> Attendance and timetable operations are pure CRUD with RLS protecting them — no AI processing needed. Running these through the FastAPI backend would add latency with no benefit. The FastAPI backend only handles work that requires server-side trust: PDF validation, chunking, LLM calls, and citation verification.

**Q: How are secrets managed?**
> All secrets are in `.env` files excluded by `.gitignore`. The Supabase JWT secret only lives in the backend — the frontend never sees it. Rate limiting (slowapi) protects LLM endpoints from cost abuse.

---

### Product & Edge Cases

**Q: What if the PDF is scanned (image-only)?**
> PDF validation checks that the extracted text length is above a minimum threshold. Image-only PDFs are rejected with a clear error: "This PDF appears to be a scanned image without extractable text. Please use a text-based PDF."

**Q: What about the Confirmation Queue? Why not auto-confirm deadlines?**
> AI date extraction is fallible, especially for ambiguous formats like "15/11" (is that Nov 15 or Jan 15?). Every extracted deadline has a confidence score (`high/medium/low`). Low-confidence items are flagged. The student must explicitly confirm before a deadline enters their reminders. This is the trust model.

**Q: What would you build next if you had more time?**
> 1. **pgvector semantic search** — for conceptual questions not answered by keyword matches
> 2. **OCR fallback** for image-only PDFs using Google Cloud Vision
> 3. **Push notifications** for upcoming confirmed deadlines
> 4. **Multi-institution support** — partition by `college_id` for SaaS scaling

---

## 🏆 Judging Criteria Checklist

| Criterion | How CampusPulse addresses it |
|---|---|
| **Innovation** | Server-verified citation model; anti-hallucination by design, not by prompt |
| **Technical Depth** | Custom RAG pipeline, RLS multi-tenancy, PyMuPDF + fallback, full-text GIN index |
| **Real-world Impact** | Solves daily student pain: missed deadlines, wrong attendance, unreliable AI |
| **Code Quality** | 42 unit tests, typed TypeScript + Pydantic, modular services, documented architecture |
| **Completeness** | Full-stack: auth, database, storage, backend API, AI, frontend, deployment configs |
| **Presentation** | Live demo-able, clear differentiator pitch, honest about limitations |
