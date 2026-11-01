"""
Notices router.

Endpoints:
- POST /api/notices/analyze: Analyzes either an uploaded document_id OR pasted text.
  Extracts simple-English summary, deadlines, eligibility criteria, required documents, and next steps.
  Enforces server-side citation validation, saves extracted items as 'pending',
  and returns verified structured items with source quotes and page numbers.
"""

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.auth import get_current_user, AuthUser
from app.services.supabase_service import get_document_chunks, insert_extracted_items
from app.services.analyzer_service import analyze_notice_chunks

router = APIRouter(tags=["notices"])
limiter = Limiter(key_func=get_remote_address)


class NoticeAnalyzeRequest(BaseModel):
    document_id: str | None = Field(default=None, description="UUID of an uploaded document")
    text: str | None = Field(default=None, description="Raw pasted notice text")


@router.post("/notices/analyze")
@limiter.limit("20/minute")
async def analyze_notice(
    req: NoticeAnalyzeRequest,
    request: Request,
    user: AuthUser = Depends(get_current_user),
):
    """
    Analyzes college notice content.
    Accepts either an uploaded `document_id` or raw `text`.
    Returns simple-English summary and structured items (deadlines, eligibility, etc.)
    with page numbers, verbatim source quotes, and confidence levels.
    """
    if not req.document_id and (not req.text or not req.text.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either document_id or non-empty text must be provided for notice analysis.",
        )

    chunks = []
    doc_name = "College Notice"

    # 1. Fetch chunks if document_id is provided
    if req.document_id:
        db_chunks = await get_document_chunks(user.token, req.document_id)
        if not db_chunks:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No document chunks found for ID {req.document_id}. Ensure document processing is complete.",
            )
        chunks = [
            {
                "chunk_id": f"chunk_{c.get('id') or idx}",
                "page_number": c.get("page_number", 1),
                "content": c.get("content", ""),
            }
            for idx, c in enumerate(db_chunks)
        ]
        doc_name = f"Document {req.document_id[:8]}"
    else:
        # 2. If pasted text is provided, wrap into chunks
        clean_text = req.text.strip()
        # Split into paragraph chunks for the analyzer
        paras = [p.strip() for p in clean_text.split("\n\n") if p.strip()]
        if not paras:
            paras = [clean_text]

        chunks = [
            {
                "chunk_id": f"chunk_{idx}",
                "page_number": 1,
                "content": p,
            }
            for idx, p in enumerate(paras)
        ]

    # 3. Analyze chunks with anti-hallucination guardrails & server citation checks
    analysis_result = await analyze_notice_chunks(chunks, doc_name)

    # 4. Save extracted items to Supabase extracted_items table in 'pending' status
    saved_items = []
    if analysis_result["items"]:
        items_payload = [
            {
                "user_id": user.user_id,
                "document_id": req.document_id,
                "kind": item["kind"],
                "text": item["text"],
                "item_date": item["item_date"],
                "page_number": item["page_number"],
                "source_quote": item["source_quote"],
                "confidence": item["confidence"],
                "status": "pending",
            }
            for item in analysis_result["items"]
        ]
        try:
            saved_items = await insert_extracted_items(user.token, items_payload)
        except Exception as exc:
            print(f"[Warning] Could not persist extracted items to Supabase: {exc}")
            # Fallback to in-memory items with mock IDs if database insert failed
            saved_items = [
                {**it, "id": f"local_{idx}"}
                for idx, it in enumerate(analysis_result["items"])
            ]

    return {
        "summary": analysis_result["summary"],
        "items": saved_items or analysis_result["items"],
    }
