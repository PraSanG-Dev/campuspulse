"""
Tests for Supabase JWT verification on the FastAPI backend.
Verifies that:
1. Missing credentials return 401/403.
2. Invalid token returns 401.
3. Valid Supabase JWT returns 200 with user_id.
"""
import pytest
from jose import jwt
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)


def test_auth_me_missing_token():
    response = client.get("/api/auth/me")
    assert response.status_code in (401, 403)


def test_auth_me_invalid_token():
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.payload"},
    )
    assert response.status_code == 401
    assert "Invalid or expired token" in response.json()["detail"]


def test_auth_me_valid_jwt():
    # Mint a mock Supabase token signed with SUPABASE_JWT_SECRET
    user_id = "d3b07384-d113-40e1-bbd5-91122dd4bb1a"
    claims = {
        "sub": user_id,
        "aud": "authenticated",
        "role": "authenticated",
        "email": "student@college.edu",
    }
    valid_token = jwt.encode(claims, settings.supabase_jwt_secret, algorithm="HS256")

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == user_id
    assert data["status"] == "authenticated"
