"""
Swappable LLM wrapper.

This is the ONLY file in the project that knows which LLM provider is used.
To switch providers, change LLM_PROVIDER in your .env — no other file changes.

Currently supported: openai, google, anthropic (stubs — fleshed out in Phase 6).

Anti-hallucination contract (enforced here, not in callers):
- The model receives ONLY the retrieved chunks as context.
- The model is NEVER given tools or internet access.
- Structured output is requested so the server can validate citations.
- The model must NOT write page numbers — the server resolves chunk_id → page.
"""

import json
from app.config import settings


async def call_llm(system_prompt: str, user_message: str) -> str:
    """
    Sends a prompt to the configured LLM and returns the raw response string.
    Raises RuntimeError on provider errors so callers can surface a friendly message.
    """
    provider = settings.llm_provider.lower()

    if provider == "openai":
        return await _call_openai(system_prompt, user_message)
    elif provider == "google":
        return await _call_google(system_prompt, user_message)
    elif provider == "anthropic":
        return await _call_anthropic(system_prompt, user_message)
    else:
        raise RuntimeError(
            f"Unknown LLM_PROVIDER '{provider}'. "
            "Set it to 'openai', 'google', or 'anthropic' in your .env."
        )


# ── Provider implementations ──────────────────────────────────────────────────
# These are filled out in Phase 6 when we add the AI Assistant.
# They are stubs here so the app starts without errors.

async def _call_openai(system_prompt: str, user_message: str) -> str:
    # Phase 6: import openai and call chat completions
    raise NotImplementedError("OpenAI integration added in Phase 6.")


async def _call_google(system_prompt: str, user_message: str) -> str:
    # Phase 6: import google.generativeai and call generate_content
    raise NotImplementedError("Google AI integration added in Phase 6.")


async def _call_anthropic(system_prompt: str, user_message: str) -> str:
    # Phase 6: import anthropic and call messages.create
    raise NotImplementedError("Anthropic integration added in Phase 6.")
