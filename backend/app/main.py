"""
CampusPulse backend — FastAPI application entry point.

What lives here:
- App creation and CORS configuration
- Router registration
- Rate limiter setup
- /health endpoint (no auth required)

Everything else (documents, notices, assistant) lives in app/routers/.
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.auth import get_current_user_id
from app.routers import documents, notices, assistant

# ── Rate limiter ──────────────────────────────────────────────────────────────
# Uses the caller's IP address as the key.
# Individual route limits are set with @limiter.limit("N/minute") decorators.
limiter = Limiter(key_func=get_remote_address)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CampusPulse API",
    version="0.1.0",
    # Disable the default /docs in production later; fine for dev now.
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(documents.router, prefix="/api")
app.include_router(notices.router,   prefix="/api")
app.include_router(assistant.router, prefix="/api")


# ── Health check & Auth verification ─────────────────────────────────────────
@app.get("/health", tags=["health"])
def health():
    """No auth required. Used by Render and monitoring tools."""
    return {"status": "ok", "version": app.version}


@app.get("/api/auth/me", tags=["auth"])
def auth_me(user_id: str = Depends(get_current_user_id)):
    """Verifies that the Supabase JWT forwarded from the frontend is valid."""
    return {"user_id": user_id, "status": "authenticated"}
