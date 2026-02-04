from urllib import response
import pytest
from fastapi.testclient import TestClient
from backend.main import app


@pytest.fixture
def client():
	return TestClient(app)


def test_health_endpoint(client):
	"""Test that the /health endpoint returns a 200 status with 'ok' status."""
	response = client.get("/health")
	assert response.status_code == 200
	assert response.json()['status'] ==  "ok"
	assert response.json()['database'] == "connected"
