"""
AI Assistant Router.

Endpoints:
- POST   /api/assistant/ask: RAG over student's uploaded documents with verifiable page citations.
- GET    /api/assistant/history: Fetches previous chat messages.
- DELETE /api/assistant/history: Clears student conversation history.
- GET    /api/assistant/documents: Lists uploaded documents available for querying.
"""

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.auth import get_current_user, AuthUser
from app.services.assistant_service import answer_student_question
from app.services.supabase_service import (
    insert_chat_message,
    get_chat_history,
    delete_chat_history,
    get_documents,
)

router = APIRouter(tags=["assistant"])
limiter = Limiter(key_func=get_remote_address)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000, description="Question about college documents")
    document_ids: list[str] | None = Field(default=None, description="Optional list of document UUIDs to filter")


@router.post("/assistant/ask")
@limiter.limit("30/minute")
async def ask_question(
    req: AskRequest,
    request: Request,
    user: AuthUser = Depends(get_current_user),
):
    """
    RAG endpoint answering student questions over their uploaded college documents.
    
    Guarantees:
    - If retrieval finds no relevant chunks, returns status 'not_found' WITHOUT calling LLM.
    - Model only sees chunk IDs. Server maps chunk ID to genuine document name and page number.
    - Server verifies that all cited snippets actually appear in the cited chunk.
    - Persists conversation message pair to Supabase chat_messages table with student RLS.
    """
    clean_q = req.question.strip()
    if not clean_q:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    # 1. Execute RAG pipeline
    result = await answer_student_question(
        token=user.token,
        question=clean_q,
        document_ids=req.document_ids,
    )

    # 2. Persist to chat_messages table
    try:
        # Save user question
        await insert_chat_message(
            user.token,
            {
                "user_id": user.user_id,
                "role": "user",
                "content": clean_q,
            },
        )

        # Save assistant answer
        await insert_chat_message(
            user.token,
            {
                "user_id": user.user_id,
                "role": "assistant",
                "content": result["answer"],
                "answer_status": result["status"],
                "citations": result.get("citations", []),
            },
        )
    except Exception as exc:
        # Do not fail the student's request if history persistence had an issue
        print(f"[Warning] Could not persist chat message: {exc}")

    return result


@router.get("/assistant/history")
async def get_history(
    user: AuthUser = Depends(get_current_user),
):
    """Retrieves conversation history for the student."""
    messages = await get_chat_history(user.token, limit=50)
    return {"messages": messages}


@router.delete("/assistant/history")
async def clear_history(
    user: AuthUser = Depends(get_current_user),
):
    """Clears conversation history for the student."""
    await delete_chat_history(user.token)
    return {"status": "cleared"}


@router.get("/assistant/documents")
async def list_documents(
    user: AuthUser = Depends(get_current_user),
):
    """Lists student's uploaded documents available for RAG."""
    docs = await get_documents(user.token)
    return {"documents": docs}
