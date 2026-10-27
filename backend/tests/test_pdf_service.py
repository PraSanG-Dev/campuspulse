"""
Tests for PDF extraction, validation, and chunking.
"""

import zlib
import pytest
from fastapi import HTTPException
from app.services.pdf_service import validate_and_extract_pdf, _chunk_page_text


def _build_minimal_pdf_bytes(text: str) -> bytes:
    """Builds a valid minimal PDF with a compressed FlateDecode text stream."""
    stream_data = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET".encode("latin1")
    compressed = zlib.compress(stream_data)

    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n"
        b"4 0 obj\n<< /Length " + str(len(compressed)).encode() + b" /Filter /FlateDecode >>\n"
        b"stream\n" + compressed + b"\nendstream\nendobj\n"
        b"trailer\n<< /Root 1 0 R >>\n%%EOF"
    )
    return pdf


def test_valid_pdf_extraction():
    sample_text = "Mid-term exam registration deadline is 2026-11-25."
    pdf_bytes = _build_minimal_pdf_bytes(sample_text)

    result = validate_and_extract_pdf("notice.pdf", pdf_bytes)
    assert result["page_count"] >= 1
    assert "2026-11-25" in result["pages"][0]["text"]
    assert len(result["chunks"]) >= 1
    assert result["chunks"][0]["page_number"] == 1


def test_invalid_extension():
    with pytest.raises(HTTPException) as exc_info:
        validate_and_extract_pdf("notice.docx", b"%PDF-dummy")
    assert exc_info.value.status_code == 400
    assert "extension" in exc_info.value.detail.lower()


def test_invalid_magic_header():
    with pytest.raises(HTTPException) as exc_info:
        validate_and_extract_pdf("notice.pdf", b"NOT_A_PDF_HEADER_123456")
    assert exc_info.value.status_code == 400
    assert "pdf header" in exc_info.value.detail.lower()


def test_empty_text_pdf_rejected():
    # PDF with a page containing no text stream
    stream_data = b"q 1 0 0 1 50 50 cm Q"
    compressed = zlib.compress(stream_data)
    empty_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n"
        b"4 0 obj\n<< /Length " + str(len(compressed)).encode() + b" /Filter /FlateDecode >>\n"
        b"stream\n" + compressed + b"\nendstream\nendobj\n"
        b"trailer\n<< /Root 1 0 R >>\n%%EOF"
    )
    with pytest.raises(HTTPException) as exc_info:
        validate_and_extract_pdf("empty.pdf", empty_pdf)
    assert exc_info.value.status_code == 400
    assert "extractable text" in exc_info.value.detail.lower()


def test_chunking_preserves_page_numbers():
    text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
    chunks = _chunk_page_text(text, page_number=5, target_chunk_size=30)
    assert len(chunks) >= 2
    for c in chunks:
        assert c["page_number"] == 5
        assert len(c["content"]) > 0
