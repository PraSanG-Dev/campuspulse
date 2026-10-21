"""
AI Assistant router — Phase 6 will add RAG + citation logic.
"""
from fastapi import APIRouter, Depends
from app.auth import get_current_user_id

router = APIRouter(tags=["assistant"])


@router.post("/assistant/ask")
async def ask(user_id: str = Depends(get_current_user_id)):
    return {"detail": "AI Assistant coming in Phase 6."}
