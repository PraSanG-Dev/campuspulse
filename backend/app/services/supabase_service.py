"""
Supabase REST & Storage client service.

CRITICAL SECURITY RULE:
All requests strictly forward the authenticated student's JWT token.
This guarantees that Supabase Row-Level Security (RLS) and storage folder
isolation (`storage.foldername(name)[1] = auth.uid()`) are enforced at the database level.
The service-role key is never used here.
"""

import httpx
from fastapi import HTTPException, status
from app.config import settings


def _headers(token: str, extra: dict | None = None) -> dict:
    h = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {token}",
    }
    if extra:
        h.update(extra)
    return h


async def upload_file_to_storage(token: str, file_path: str, file_bytes: bytes) -> str:
    """
    Uploads a file to the private 'documents' storage bucket.
    Path must start with <user_id>/ to satisfy the bucket RLS policy.
    """
    url = f"{settings.supabase_url}/storage/v1/object/documents/{file_path}"
    headers = _headers(token, {"Content-Type": "application/pdf"})

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, content=file_bytes, headers=headers)
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Storage upload failed ({response.status_code}): {response.text}",
            )
        return file_path


async def delete_file_from_storage(token: str, file_path: str) -> None:
    """Deletes a file from the 'documents' storage bucket."""
    url = f"{settings.supabase_url}/storage/v1/object/documents/{file_path}"
    headers = _headers(token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        await client.delete(url, headers=headers)


async def insert_document(token: str, doc_data: dict) -> dict:
    """Inserts a new document row into the `documents` table."""
    url = f"{settings.supabase_url}/rest/v1/documents"
    headers = _headers(token, {"Content-Type": "application/json", "Prefer": "return=representation"})

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=doc_data, headers=headers)
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to record document metadata: {response.text}",
            )
        rows = response.json()
        return rows[0] if isinstance(rows, list) and rows else doc_data


async def update_document_status(token: str, doc_id: str, status_str: str) -> None:
    """Updates the processing status of a document."""
    url = f"{settings.supabase_url}/rest/v1/documents?id=eq.{doc_id}"
    headers = _headers(token, {"Content-Type": "application/json"})

    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.patch(url, json={"status": status_str}, headers=headers)


async def insert_document_chunks(token: str, chunks_data: list[dict]) -> None:
    """Bulk inserts text chunks into `document_chunks` table."""
    if not chunks_data:
        return
    url = f"{settings.supabase_url}/rest/v1/document_chunks"
    headers = _headers(token, {"Content-Type": "application/json"})

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=chunks_data, headers=headers)
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to save document chunks: {response.text}",
            )


async def get_document_chunks(token: str, doc_id: str) -> list[dict]:
    """Retrieves all chunks for a document belonging to the user."""
    url = f"{settings.supabase_url}/rest/v1/document_chunks?document_id=eq.{doc_id}&order=page_number.asc,id.asc"
    headers = _headers(token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Could not retrieve chunks for document: {response.text}",
            )
        return response.json()


async def delete_document(token: str, doc_id: str) -> None:
    """Deletes a document from the database (cascade deletes chunks)."""
    # 1. Fetch document file_path to delete from storage
    url_get = f"{settings.supabase_url}/rest/v1/documents?id=eq.{doc_id}&select=file_path"
    headers = _headers(token)

    file_path = None
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url_get, headers=headers)
        if r.status_code == 200:
            data = r.json()
            if data and isinstance(data, list):
                file_path = data[0].get("file_path")

        # 2. Delete database record
        url_del = f"{settings.supabase_url}/rest/v1/documents?id=eq.{doc_id}"
        await client.delete(url_del, headers=headers)

    # 3. Clean up storage file if path was found
    if file_path:
        await delete_file_from_storage(token, file_path)


async def insert_extracted_items(token: str, items: list[dict]) -> list[dict]:
    """Inserts extracted notice items into the `extracted_items` table."""
    if not items:
        return []
    url = f"{settings.supabase_url}/rest/v1/extracted_items"
    headers = _headers(token, {"Content-Type": "application/json", "Prefer": "return=representation"})

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=items, headers=headers)
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to record extracted items: {response.text}",
            )
        return response.json()
