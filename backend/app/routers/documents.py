"""
Documents router.

Endpoints:
- POST   /api/documents: Validates PDF header, size, pages, extracts text, chunks, stores in Supabase
- DELETE /api/documents/{doc_id}: Deletes document metadata, chunks, and storage file
"""

import uuid
import re
from fastapi import APIRouter, Depends, UploadFile, File, Request, HTTPException, status
from app.auth import get_current_user, AuthUser
from app.services.pdf_service import validate_and_extract_pdf
from app.services.supabase_service import (
    upload_file_to_storage,
    insert_document,
    update_document_status,
    insert_document_chunks,
    delete_document as delete_doc_from_supabase,
)
from app.config import settings

router = APIRouter(tags=["documents"])


def _sanitize_filename(filename: str) -> str:
    """Sanitizes filename for storage paths."""
    base = re.sub(r"[^a-zA-Z0-9_\.-]", "_", filename)
    return base[:80] if base else "document.pdf"


@router.post("/documents")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
):
    """
    Uploads a college PDF document.
    Validates:
    - Real %PDF- magic bytes header
    - File extension (.pdf)
    - File size (max 10 MB)
    - Page count (max 50 pages)
    - Extractable text availability (rejects blank/image scans)
    Extracts text per page, chunks, and saves to Supabase Storage and Postgres.
    """
    # 1. Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    # 2. Validate PDF format and extract page chunks
    filename = file.filename or "document.pdf"
    extraction_result = validate_and_extract_pdf(filename, file_bytes)

    doc_id = str(uuid.uuid4())
    safe_name = _sanitize_filename(filename)
    file_path = f"{user.user_id}/{doc_id}_{safe_name}"

    try:
        # 3. Upload file bytes to private Supabase Storage bucket
        await upload_file_to_storage(user.token, file_path, file_bytes)

        # 4. Insert row into documents table with status 'processing'
        doc_payload = {
            "id": doc_id,
            "user_id": user.user_id,
            "file_name": filename,
            "file_path": file_path,
            "page_count": extraction_result["page_count"],
            "status": "processing",
        }
        await insert_document(user.token, doc_payload)

        # 5. Insert document chunks
        db_chunks = [
            {
                "document_id": doc_id,
                "user_id": user.user_id,
                "page_number": c["page_number"],
                "content": c["content"],
            }
            for c in extraction_result["chunks"]
        ]
        await insert_document_chunks(user.token, db_chunks)

        # 6. Mark document as 'ready'
        await update_document_status(user.token, doc_id, "ready")

        return {
            "id": doc_id,
            "file_name": filename,
            "page_count": extraction_result["page_count"],
            "chunk_count": len(db_chunks),
            "status": "ready",
            "message": f"Successfully processed {extraction_result['page_count']} pages into {len(db_chunks)} chunks.",
        }

    except Exception as exc:
        # On failure, attempt to mark status as 'failed'
        try:
            await update_document_status(user.token, doc_id, "failed")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing failed: {exc}",
        )


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Deletes a document, its database chunks, and its file in storage.
    RLS ensures only the owning student can delete their own documents.
    """
    await delete_doc_from_supabase(user.token, doc_id)
    return {"status": "deleted", "id": doc_id}
