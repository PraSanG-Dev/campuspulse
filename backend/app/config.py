"""
Centralised settings loaded from environment variables.

Why pydantic-settings?
  It reads from a .env file automatically and raises a clear error
  if a required variable is missing — so you never silently get None.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_jwt_secret: str

    # LLM
    llm_provider: str = "google"
    llm_api_key: str
    llm_model: str = "gemini-1.5-flash"

    # App
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:4173",  # Vite preview
    ]
    max_upload_bytes: int = 10 * 1024 * 1024   # 10 MB
    max_pdf_pages: int = 50


# Single shared instance — import this everywhere instead of re-creating it.
settings = Settings()  # type: ignore[call-arg]
