"""
Notices router — Phase 5 will add real analysis logic.
"""
from fastapi import APIRouter, Depends
from app.auth import get_current_user_id

router = APIRouter(tags=["notices"])


@router.post("/notices/analyze")
async def analyze_notice(user_id: str = Depends(get_current_user_id)):
    return {"detail": "Notice analysis coming in Phase 5."}
