"""
Supabase REST & Storage client service.

CRITICAL SECURITY RULE:
All requests strictly forward the authenticated student's JWT token.
This guarantees that Supabase Row-Level Security (RLS) and storage folder
isolation (`storage.foldername(name)[1] = auth.uid()`) are enforced at the database level.
The service-role key is never used here.
"""

import urllib.parse
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


async def get_documents(token: str) -> list[dict]:
    """Retrieves all documents belonging to the authenticated student."""
    url = f"{settings.supabase_url}/rest/v1/documents?order=created_at.desc"
    headers = _headers(token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            return []
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
            if data and isinstance(data, list) and data:
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


async def search_document_chunks(
    token: str,
    query: str,
    document_ids: list[str] | None = None,
    limit: int = 8,
) -> list[dict]:
    """
    Performs Postgres Full-Text Search on document_chunks via Supabase REST.
    Uses PostgREST's `wfts` or `plfts` operator on the `tsv` column.
    Joins the parent document to fetch `file_name`.
    If full-text search yields no matches, falls back to keyword matching.
    """
    clean_q = query.strip()
    if not clean_q:
        return []

    # Map document IDs filter if provided
    doc_filter = ""
    if document_ids and len(document_ids) > 0:
        ids_str = ",".join(document_ids)
        doc_filter = f"&document_id=in.({ids_str})"

    # Select fields including parent document file_name
    select_fields = "id,document_id,page_number,content,documents(file_name)"

    # 1. Primary retrieval: Postgres full-text search using websearch_to_tsquery (wfts) or plainto_tsquery (plfts)
    encoded_query = urllib.parse.quote(clean_q)
    url_fts = (
        f"{settings.supabase_url}/rest/v1/document_chunks"
        f"?select={select_fields}&tsv=wfts.{encoded_query}{doc_filter}&limit={limit}"
    )

    headers = _headers(token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url_fts, headers=headers)
        chunks = []
        if res.status_code == 200:
            chunks = res.json()

        # If wfts found nothing, try plain-text tsquery (plfts)
        if not chunks:
            url_plfts = (
                f"{settings.supabase_url}/rest/v1/document_chunks"
                f"?select={select_fields}&tsv=plfts.{encoded_query}{doc_filter}&limit={limit}"
            )
            res2 = await client.get(url_plfts, headers=headers)
            if res2.status_code == 200:
                chunks = res2.json()

        # If still nothing, try keyword ilike match on individual significant words
        if not chunks:
            keywords = [w for w in re_words(clean_q) if len(w) > 3][:3]
            for kw in keywords:
                encoded_kw = urllib.parse.quote(f"%{kw}%")
                url_kw = (
                    f"{settings.supabase_url}/rest/v1/document_chunks"
                    f"?select={select_fields}&content=ilike.{encoded_kw}{doc_filter}&limit={limit}"
                )
                res_kw = await client.get(url_kw, headers=headers)
                if res_kw.status_code == 200:
                    found = res_kw.json()
                    for f in found:
                        if not any(c["id"] == f["id"] for c in chunks):
                            chunks.append(f)
                if len(chunks) >= limit:
                    break

        # Format output chunks
        results = []
        for c in chunks:
            doc_info = c.get("documents") or {}
            doc_name = doc_info.get("file_name") if isinstance(doc_info, dict) else "Document"
            results.append({
                "chunk_id": str(c["id"]),
                "document_id": str(c["document_id"]),
                "document_name": doc_name or "Document",
                "page_number": int(c.get("page_number", 1)),
                "content": c.get("content", ""),
            })

        return results


def re_words(text: str) -> list[str]:
    import re
    return re.findall(r"\b[a-zA-Z0-9]+\b", text)


async def insert_chat_message(token: str, message: dict) -> dict:
    """Inserts a user or assistant message into `chat_messages` table."""
    url = f"{settings.supabase_url}/rest/v1/chat_messages"
    headers = _headers(token, {"Content-Type": "application/json", "Prefer": "return=representation"})

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, json=message, headers=headers)
        if response.status_code in (200, 201):
            data = response.json()
            return data[0] if isinstance(data, list) and data else message
        return message


async def get_chat_history(token: str, limit: int = 50) -> list[dict]:
    """Retrieves student's previous conversation history."""
    url = f"{settings.supabase_url}/rest/v1/chat_messages?order=created_at.asc&limit={limit}"
    headers = _headers(token)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        return []


async def delete_chat_history(token: str) -> None:
    """Deletes student's chat messages."""
    url = f"{settings.supabase_url}/rest/v1/chat_messages"
    headers = _headers(token)

    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.delete(url, headers=headers)
