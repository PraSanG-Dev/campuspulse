"""
JWT authentication dependency.

Usage in any router:
    from app.auth import get_current_user_id

    @router.post("/something")
    async def my_route(user_id: str = Depends(get_current_user_id)):
        ...

Why forward the user's JWT instead of using the service-role key?
  Supabase Row-Level Security (RLS) only fires for the authenticated user.
  If we used the service-role key, RLS would be bypassed and any user
  could theoretically read another user's data. By forwarding the user's
  own JWT, Supabase enforces RLS automatically.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.config import settings

bearer_scheme = HTTPBearer()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    Validates the Supabase JWT from the Authorization header.
    Returns the user's UUID (sub claim) on success.
    Raises HTTP 401 on any failure.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            # Supabase tokens have audience "authenticated"
            options={"verify_aud": False},
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has no subject claim.",
            )
        return user_id
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc
