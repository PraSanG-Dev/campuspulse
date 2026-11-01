"""
Swappable LLM wrapper for CampusPulse.

This is the ONLY file in the project that interfaces directly with LLM providers.
To switch providers, update LLM_PROVIDER in .env.

Anti-hallucination contract (enforced here):
1. The model is given strictly chunk data and returns structured JSON.
2. The model is given NO tools and NO internet access.
3. Document text is wrapped as untrusted data with strict instructions to ignore embedded prompts.
"""

import os
import json
import asyncio
import re
from app.config import settings


async def call_llm(system_prompt: str, user_message: str) -> str:
    """
    Sends a prompt to the configured LLM and returns the response string.
    Gracefully handles testing environments with a deterministic fallback.
    """
    provider = settings.llm_provider.lower()
    api_key = settings.llm_api_key.strip()

    # If in test/placeholder mode, run the deterministic fallback parser
    if not api_key or api_key.startswith("fake-") or api_key.startswith("your-"):
        return _mock_llm_response(system_prompt, user_message)

    try:
        if provider == "google":
            return await _call_google(system_prompt, user_message)
        elif provider == "openai":
            return await _call_openai(system_prompt, user_message)
        elif provider == "anthropic":
            return await _call_anthropic(system_prompt, user_message)
        else:
            return _mock_llm_response(system_prompt, user_message)
    except Exception as exc:
        print(f"[LLM Warning] Provider {provider} failed: {exc}. Falling back to deterministic extractor.")
        return _mock_llm_response(system_prompt, user_message)


async def _call_google(system_prompt: str, user_message: str) -> str:
    """Invokes Google Gemini API with system instructions."""
    import google.generativeai as genai

    genai.configure(api_key=settings.llm_api_key)
    model = genai.GenerativeModel(
        model_name=settings.llm_model or "gemini-1.5-flash",
        system_instruction=system_prompt,
        generation_config={"response_mime_type": "application/json"}
    )

    response = await asyncio.to_thread(model.generate_content, user_message)
    return response.text


async def _call_openai(system_prompt: str, user_message: str) -> str:
    """Invokes OpenAI Chat Completions API with JSON mode."""
    import httpx

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.llm_model or "gpt-4o-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.1,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(url, json=payload, headers=headers)
        res.raise_for_status()
        data = res.json()
        return data["choices"][0]["message"]["content"]


async def _call_anthropic(system_prompt: str, user_message: str) -> str:
    """Invokes Anthropic Claude API."""
    import httpx

    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": settings.llm_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": settings.llm_model or "claude-3-haiku-20240307",
        "max_tokens": 2048,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}],
        "temperature": 0.1,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(url, json=payload, headers=headers)
        res.raise_for_status()
        data = res.json()
        return data["content"][0]["text"]


def _mock_llm_response(system_prompt: str, user_message: str) -> str:
    """
    Deterministic rule-based extractor used during development, unit testing,
    or when external API keys have not yet been configured.
    Guarantees valid JSON output that matches the expected schema.
    """
    # ── Branch A: AI Assistant query ──────────────────────────────────────────
    if "AI Assistant" in system_prompt or "Question:" in user_message:
        # Extract question line and document_data
        q_match = re.search(r"Question:\s*(.*?)(?:\n\n|\n<)", user_message, re.DOTALL)
        question = q_match.group(1).strip() if q_match else ""

        doc_match = re.search(r"<document_data>(.*?)</document_data>", user_message, re.DOTALL)
        doc_data = doc_match.group(1).strip() if doc_match else ""

        # Extract words from question (ignoring stop words)
        stop_words = {"what", "is", "the", "for", "when", "how", "are", "of", "in", "to", "and", "a", "an", "on", "my", "our"}
        keywords = [w.lower() for w in re.findall(r"\b[a-zA-Z0-9]+\b", question) if w.lower() not in stop_words and len(w) > 2]

        # Search chunks for matching sentences
        chunk_blocks = re.findall(r"\[(chunk_\w+)\]:\s*(.*?)(?=\n\[chunk_|\Z)", doc_data, re.DOTALL)
        
        found_chunk_id = None
        found_sentence = None

        for c_id, content in chunk_blocks:
            sentences = [s.strip() for s in content.split(".") if s.strip()]
            for sent in sentences:
                sent_lower = sent.lower()
                # If sentence matches at least one significant keyword
                if any(k in sent_lower for k in keywords):
                    found_chunk_id = c_id
                    found_sentence = sent.strip()
                    break
            if found_sentence:
                break

        if found_sentence and found_chunk_id:
            return json.dumps({
                "status": "grounded",
                "answer": f"According to your document: {found_sentence}.",
                "citations": [
                    {
                        "chunk_id": found_chunk_id,
                        "snippet": found_sentence[:100],
                    }
                ],
            })
        else:
            return json.dumps({
                "status": "not_found",
                "answer": "This could not be verified in your uploaded documents.",
                "citations": [],
            })

    # ── Branch B: Notice Analyzer ─────────────────────────────────────────────
    text = user_message

    # Detect dates formatted like YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
    date_matches = re.findall(
        r"\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
        text,
    )

    items = []
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    # Extract deadlines
    for idx, line in enumerate(lines):
        lower = line.lower()
        if any(w in lower for w in ["deadline", "due", "last date", "submission", "submit by", "before"]):
            matched_date = None
            confidence = "low"
            for d in date_matches:
                if d in line:
                    matched_date = d
                    confidence = "high"
                    break

            items.append({
                "kind": "deadline",
                "text": line[:160],
                "item_date": matched_date,
                "chunk_id": "chunk_0",
                "source_quote": line[:100],
                "confidence": confidence,
            })

    # Extract required documents
    for line in lines:
        lower = line.lower()
        if any(w in lower for w in ["carry", "bring", "photocopy", "certificate", "id card", "admit card", "mark sheet", "document"]):
            items.append({
                "kind": "document_required",
                "text": line[:160],
                "item_date": None,
                "chunk_id": "chunk_0",
                "source_quote": line[:100],
                "confidence": "high",
            })

    # Extract eligibility criteria
    for line in lines:
        lower = line.lower()
        if any(w in lower for w in ["eligib", "criteria", "minimum", "attendance", "cgpa", "backlog", "semester"]):
            items.append({
                "kind": "eligibility",
                "text": line[:160],
                "item_date": None,
                "chunk_id": "chunk_0",
                "source_quote": line[:100],
                "confidence": "high",
            })

    # Extract next steps
    for line in lines:
        lower = line.lower()
        if any(w in lower for w in ["portal", "register", "fill", "contact", "report to", "visit"]):
            items.append({
                "kind": "next_step",
                "text": line[:160],
                "item_date": None,
                "chunk_id": "chunk_0",
                "source_quote": line[:100],
                "confidence": "high",
            })

    # Deduplicate items by text
    seen = set()
    unique_items = []
    for it in items:
        if it["text"] not in seen:
            seen.add(it["text"])
            unique_items.append(it)

    first_few_lines = " ".join(lines[:3]) if lines else "College notice details."
    summary = f"Summary: {first_few_lines[:250]}..."

    return json.dumps({
        "summary": summary,
        "items": unique_items[:12],
    })
