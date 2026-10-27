"""
JWT authentication dependency.

Validates incoming Supabase JWTs and extracts user information.
Provides both `get_current_user_id` and `get_current_user` (which includes the raw JWT)
so the backend can forward the user's token to Supabase for RLS enforcement.
"""

from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.config import settings

bearer_scheme = HTTPBearer()


@dataclass
class AuthUser:
    user_id: str
    token: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthUser:
    """
    Validates the Supabase JWT from the Authorization header.
    Returns AuthUser(user_id, token) on success.
    Raises HTTP 401 on any failure.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has no subject claim.",
            )
        return AuthUser(user_id=user_id, token=token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc


def get_current_user_id(
    user: AuthUser = Depends(get_current_user),
) -> str:
    """Convenience dependency returning just the user_id."""
    return user.user_id
