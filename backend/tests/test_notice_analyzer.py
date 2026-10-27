"""
Tests for Notice Analyzer: anti-hallucination, date normalization, and server-side quote verification.
"""

import json
from app.services.analyzer_service import _normalize_date, parse_and_verify_items


def test_date_normalization_unambiguous_iso():
    iso_date, conf = _normalize_date("2026-12-15")
    assert iso_date == "2026-12-15"
    assert conf == "high"


def test_date_normalization_unambiguous_day_greater_than_12():
    # Day is 25, so cannot be month
    date_val, conf = _normalize_date("25/11/2026")
    assert date_val == "2026-11-25"
    assert conf == "high"


def test_date_normalization_ambiguous_marked_low_confidence():
    # 04/05/2026 could be April 5 or May 4 -> MUST be marked low confidence!
    date_val, conf = _normalize_date("04/05/2026")
    assert conf == "low"


def test_server_maps_chunk_id_to_page_number():
    """
    CRITICAL RULE: The model sees chunk_ids and must never invent page numbers.
    The server maps chunk_ids to the authentic document page number.
    """
    chunk_map = {
        "chunk_3": {
            "page_number": 4,
            "content": "All students must submit project synopsis by 2026-11-20.",
            "document_name": "ExamNotice.pdf",
        }
    }

    mock_llm_json = json.dumps({
        "summary": "Project submission deadline notice.",
        "items": [
            {
                "kind": "deadline",
                "text": "Submit project synopsis",
                "item_date": "2026-11-20",
                "chunk_id": "chunk_3",
                "source_quote": "submit project synopsis by 2026-11-20",
                "confidence": "high",
            }
        ]
    })

    result = parse_and_verify_items(mock_llm_json, chunk_map)
    assert result["summary"] == "Project submission deadline notice."
    item = result["items"][0]
    assert item["page_number"] == 4  # Server mapped chunk_3 -> Page 4
    assert item["confidence"] == "high"
    assert item["status"] == "pending"


def test_server_verifies_quote_must_appear_in_chunk():
    """
    CRITICAL RULE: The server verifies that quoted text actually appears in the cited chunk.
    If the quote was hallucinated or altered, the server downgrades confidence to low.
    """
    chunk_map = {
        "chunk_1": {
            "page_number": 1,
            "content": "Carry two passport sized photographs to the exam hall.",
            "document_name": "AdmitCardNotice.pdf",
        }
    }

    # Model hallucinated a quote not present in chunk_1
    hallucinated_json = json.dumps({
        "summary": "Notice details",
        "items": [
            {
                "kind": "document_required",
                "text": "Bring passport photos",
                "item_date": None,
                "chunk_id": "chunk_1",
                "source_quote": "Carry three colored ID certificates",  # Not in chunk_1
                "confidence": "high",
            }
        ]
    })

    result = parse_and_verify_items(hallucinated_json, chunk_map)
    item = result["items"][0]
    # Quote failed server verification -> confidence must be downgraded to low!
    assert item["confidence"] == "low"
