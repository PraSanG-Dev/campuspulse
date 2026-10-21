"""
Phase 1 smoke test — verifies the FastAPI app starts and /health works.
Run with: pytest tests/test_health.py -v
"""
from fastapi.testclient import TestClient
import pytest


@pytest.fixture(scope="module")
def client():
    # We import inside the fixture so missing .env gives a clear error here,
    # not at module import time.
    from app.main import app
    return TestClient(app)


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
