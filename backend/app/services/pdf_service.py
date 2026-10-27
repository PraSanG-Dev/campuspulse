"""
PDF parsing, validation, and chunking service.

Primary engine: PyMuPDF (fitz) - high-speed page-aware text extraction.
Fallback engine: Pure-Python stream extractor (activated if native DLLs are restricted by OS security policy).

Enforces:
1. Extension check (.pdf)
2. Magic bytes check (%PDF-)
3. Max file size (default 10 MB)
4. Max page count (default 50 pages)
5. Extractable text requirement (rejects scanned image PDFs without OCR)
6. Clean page-aware chunking
"""

import re
import zlib
from fastapi import HTTPException, status
from app.config import settings

# Attempt to load PyMuPDF
HAS_PYMUPDF = False
try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except (ImportError, Exception):
    HAS_PYMUPDF = False


class PDFValidationError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def validate_and_extract_pdf(filename: str, file_bytes: bytes) -> dict:
    """
    Validates PDF format, size, and page limits, then extracts text per page.
    Returns:
        {
            "page_count": int,
            "total_chars": int,
            "pages": list[dict(page_number=int, text=str)],
            "chunks": list[dict(page_number=int, content=str)],
        }
    """
    # 1. File extension validation
    if not filename.lower().endswith(".pdf"):
        raise PDFValidationError("Invalid file extension. Only .pdf files are accepted.")

    # 2. Magic header validation (%PDF-)
    if not file_bytes.startswith(b"%PDF-"):
        raise PDFValidationError(
            "Invalid file content. The uploaded file does not have a valid PDF header (%PDF-)."
        )

    # 3. File size validation
    if len(file_bytes) > settings.max_upload_bytes:
        max_mb = settings.max_upload_bytes // (1024 * 1024)
        raise PDFValidationError(f"File size exceeds the {max_mb} MB limit.")

    if HAS_PYMUPDF:
        try:
            return _extract_with_pymupdf(file_bytes)
        except PDFValidationError:
            raise
        except Exception:
            # If PyMuPDF fails unexpectedly, try the fallback
            return _extract_with_fallback(file_bytes)
    else:
        return _extract_with_fallback(file_bytes)


def _extract_with_pymupdf(file_bytes: bytes) -> dict:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        page_count = len(doc)
        if page_count == 0:
            raise PDFValidationError("The PDF file contains 0 pages.")

        if page_count > settings.max_pdf_pages:
            raise PDFValidationError(
                f"PDF has {page_count} pages, which exceeds the maximum limit of {settings.max_pdf_pages} pages."
            )

        pages = []
        chunks = []
        total_text_len = 0

        for page_idx in range(page_count):
            page_num = page_idx + 1
            page = doc[page_idx]
            page_text = page.get_text("text").strip()

            pages.append({"page_number": page_num, "text": page_text})
            total_text_len += len(page_text)

            if not page_text:
                continue

            page_chunks = _chunk_page_text(page_text, page_num)
            chunks.extend(page_chunks)

        if total_text_len < 10:
            raise PDFValidationError(
                "PDF contains no extractable text. Scanned image-only PDFs or empty files are not supported."
            )

        return {
            "page_count": page_count,
            "total_chars": total_text_len,
            "pages": pages,
            "chunks": chunks,
        }
    finally:
        doc.close()


def _extract_with_fallback(file_bytes: bytes) -> dict:
    """Pure-Python stream decompression fallback when native DLLs cannot load."""
    # Approximate page count by counting '/Type /Page' or '/Page\b'
    page_matches = len(re.findall(rb"/Type\s*/Page\b", file_bytes))
    page_count = max(1, page_matches)

    if page_count > settings.max_pdf_pages:
        raise PDFValidationError(
            f"PDF has {page_count} pages, which exceeds the maximum limit of {settings.max_pdf_pages} pages."
        )

    # Extract all FlateDecode streams
    streams = re.findall(rb"stream\r?\n(.*?)\r?\nendstream", file_bytes, re.DOTALL)
    extracted_text_parts = []

    for s in streams:
        decomp = None
        try:
            decomp = zlib.decompress(s)
        except Exception:
            try:
                # Raw inflate without header
                decomp = zlib.decompress(s, -15)
            except Exception:
                pass

        if decomp:
            # Extract text from PDF operators: (text) Tj or [(text)] TJ
            tj_matches = re.findall(rb"\((.*?)\)\s*T[jJ]", decomp)
            for m in tj_matches:
                t = m.decode("latin1", errors="ignore").strip()
                if t:
                    extracted_text_parts.append(t)

            # Also check text array operands: [(t1) 10 (t2)] TJ
            array_matches = re.findall(rb"\[(.*?)\]\s*TJ", decomp)
            for arr in array_matches:
                sub_matches = re.findall(rb"\((.*?)\)", arr)
                for sm in sub_matches:
                    t = sm.decode("latin1", errors="ignore").strip()
                    if t:
                        extracted_text_parts.append(t)

    full_text = " ".join(extracted_text_parts).strip()
    if len(full_text) < 10:
        raise PDFValidationError(
            "PDF contains no extractable text. Scanned image-only PDFs or empty files are not supported."
        )

    pages = [{"page_number": 1, "text": full_text}]
    chunks = _chunk_page_text(full_text, 1)

    return {
        "page_count": page_count,
        "total_chars": len(full_text),
        "pages": pages,
        "chunks": chunks,
    }


def _chunk_page_text(text: str, page_number: int, target_chunk_size: int = 800) -> list[dict]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks = []
    current_content = []
    current_len = 0

    for para in paragraphs:
        para_len = len(para)
        if current_len + para_len > target_chunk_size and current_content:
            chunk_str = "\n\n".join(current_content).strip()
            if chunk_str:
                chunks.append({"page_number": page_number, "content": chunk_str})
            current_content = [para]
            current_len = para_len
        else:
            current_content.append(para)
            current_len += para_len + 2

    if current_content:
        chunk_str = "\n\n".join(current_content).strip()
        if chunk_str:
            chunks.append({"page_number": page_number, "content": chunk_str})

    return chunks
