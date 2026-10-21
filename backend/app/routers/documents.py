"""
Documents router — Phase 5 will add real upload logic.
Stub keeps the app importable right now.
"""
from fastapi import APIRouter, Depends
from app.auth import get_current_user_id

router = APIRouter(tags=["documents"])


@router.post("/documents")
async def upload_document(user_id: str = Depends(get_current_user_id)):
    # Full implementation in Phase 5
    return {"detail": "Document upload coming in Phase 5."}


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user_id: str = Depends(get_current_user_id)):
    # Full implementation in Phase 5
    return {"detail": "Document delete coming in Phase 5."}
