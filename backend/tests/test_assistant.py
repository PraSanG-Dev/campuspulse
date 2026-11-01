"""
Unit tests for AI Assistant: RAG pipeline, anti-hallucination rules, and citation verification.
"""

import json
import pytest
from app.services.assistant_service import (
    verify_and_map_citations,
    parse_assistant_response,
)


def test_server_maps_chunk_id_to_document_name_and_page():
    """
    ANTI-HALLUCINATION RULE:
    The model returns only abstract chunk IDs (chunk_0, chunk_1).
    The server maps them to the authentic document name and page number.
    """
    chunk_map = {
        "chunk_0": {
            "document_name": "Hostel_Rules_2026.pdf",
            "page_number": 7,
            "content": "Hostel entry curfew time is strictly 9:30 PM for all undergraduate students.",
        }
    }

    raw_citations = [
        {
            "chunk_id": "chunk_0",
            "snippet": "Hostel entry curfew time is strictly 9:30 PM",
        }
    ]

    verified = verify_and_map_citations(raw_citations, chunk_map)
    assert len(verified) == 1
    assert verified[0]["document_name"] == "Hostel_Rules_2026.pdf"
    assert verified[0]["page_number"] == 7
    assert "9:30 PM" in verified[0]["snippet"]


def test_server_rejects_hallucinated_quote():
    """
    ANTI-HALLUCINATION RULE:
    If the model hallucinates a snippet that does not appear in the chunk text,
    the server detects it and ensures only genuine chunk sentences are used.
    """
    chunk_map = {
        "chunk_1": {
            "document_name": "Scholarship_Notice.pdf",
            "page_number": 2,
            "content": "Eligible candidates must have scored at least 8.5 CGPA in the previous academic year.",
        }
    }

    raw_citations = [
        {
            "chunk_id": "chunk_1",
            "snippet": "The scholarship amount is 50000 rupees per semester",  # completely made up
        }
    ]

    verified = verify_and_map_citations(raw_citations, chunk_map)
    # The server replaces the false quote with an authentic sentence from chunk_1
    assert len(verified) == 1
    assert "8.5 CGPA" in verified[0]["snippet"]
    assert "50000" not in verified[0]["snippet"]


def test_parse_assistant_response_grounded():
    chunk_map = {
        "chunk_0": {
            "document_name": "Attendance_Policy.pdf",
            "page_number": 3,
            "content": "Students with attendance below 75% will not be permitted to sit for final semester examinations.",
        }
    }

    model_response = json.dumps({
        "status": "grounded",
        "answer": "Minimum 75% attendance is required to sit for the final examinations.",
        "citations": [
            {
                "chunk_id": "chunk_0",
                "snippet": "attendance below 75% will not be permitted",
            }
        ],
    })

    parsed = parse_assistant_response(model_response, chunk_map)
    assert parsed["status"] == "grounded"
    assert "75%" in parsed["answer"]
    assert len(parsed["citations"]) == 1
    assert parsed["citations"][0]["document_name"] == "Attendance_Policy.pdf"
    assert parsed["citations"][0]["page_number"] == 3


def test_parse_assistant_response_not_found():
    """
    TRUST RULE:
    When the answer is not present in the documents, status is not_found
    and citations must be empty.
    """
    chunk_map = {
        "chunk_0": {
            "document_name": "Sports_Schedule.pdf",
            "page_number": 1,
            "content": "Cricket tournament starts on Friday at the main sports ground.",
        }
    }

    model_response = json.dumps({
        "status": "not_found",
        "answer": "This could not be verified in your uploaded documents.",
        "citations": [],
    })

    parsed = parse_assistant_response(model_response, chunk_map)
    assert parsed["status"] == "not_found"
    assert "could not be verified" in parsed["answer"].lower()
    assert len(parsed["citations"]) == 0


def test_grounded_claim_with_zero_valid_citations_downgraded_to_not_found():
    """
    ANTI-HALLUCINATION ENFORCEMENT:
    If the model claimed an answer was grounded, but provided an invalid chunk_id,
    the server downgrades status to not_found.
    """
    chunk_map = {
        "chunk_0": {
            "document_name": "Circular.pdf",
            "page_number": 1,
            "content": "College will remain closed on Monday.",
        }
    }

    # Model cited a phantom chunk_id 'chunk_99'
    hallucinated_response = json.dumps({
        "status": "grounded",
        "answer": "The fee is 25000.",
        "citations": [
            {
                "chunk_id": "chunk_99",
                "snippet": "fee is 25000",
            }
        ],
    })

    parsed = parse_assistant_response(hallucinated_response, chunk_map)
    assert parsed["status"] == "not_found"
    assert "could not be verified" in parsed["answer"].lower()
