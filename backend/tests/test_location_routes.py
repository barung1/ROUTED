from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.auth.jwt import create_access_token
from backend.config.db import get_db_session
from backend.main import app
import backend.routes.location as location_routes


class _ScalarResult:
	def __init__(self, value):
		self._value = value

	def all(self):
		if self._value is None:
			return []
		if isinstance(self._value, list):
			return self._value
		return [self._value]

	def first(self):
		if isinstance(self._value, list):
			return self._value[0] if self._value else None
		return self._value


class _Result:
	def __init__(self, value):
		self._value = value

	def scalars(self):
		return _ScalarResult(self._value)


class FakeSession:
	def __init__(self, value=None):
		self._value = value

	def execute(self, *_args, **_kwargs):
		return _Result(self._value)


@pytest.fixture
def client():
	return TestClient(app)


def _override_db_session(fake_session):
	def _override():
		yield fake_session
	return _override


def _auth_header(user_id):
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1),
	)
	return {"Authorization": f"Bearer {token}"}


def _fake_to_shape(position):
	return SimpleNamespace(x=position[0], y=position[1])


def test_get_locations_success(client, monkeypatch):
	monkeypatch.setattr(location_routes, "to_shape", _fake_to_shape)

	location_id = uuid4()
	tag_id = uuid4()
	location = SimpleNamespace(
		id=location_id,
		name="Trailhead",
		description="Start of the trail",
		position=(-120.5, 35.2),
		tags=[SimpleNamespace(id=tag_id)],
	)
	fake_session = FakeSession([location])
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	response = client.get("/locations", headers=_auth_header(uuid4()))
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert len(body) == 1
	assert body[0]["id"] == str(location_id)
	assert body[0]["name"] == "Trailhead"
	assert body[0]["description"] == "Start of the trail"
	assert body[0]["latitude"] == 35.2
	assert body[0]["longitude"] == -120.5
	assert body[0]["tags"] == [str(tag_id)]


def test_get_location_by_id_success(client, monkeypatch):
	monkeypatch.setattr(location_routes, "to_shape", _fake_to_shape)

	location_id = uuid4()
	tag_id = uuid4()
	location = SimpleNamespace(
		id=location_id,
		name="Scenic Overlook",
		description="Great view",
		position=(10.1, 20.2),
		tags=[SimpleNamespace(id=tag_id)],
	)
	fake_session = FakeSession(location)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	response = client.get(f"/locations/{location_id}", headers=_auth_header(uuid4()))
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["id"] == str(location_id)
	assert body["name"] == "Scenic Overlook"
	assert body["description"] == "Great view"
	assert body["latitude"] == 20.2
	assert body["longitude"] == 10.1
	assert body["tags"] == [str(tag_id)]


def test_get_location_by_id_not_found(client):
	fake_session = FakeSession(None)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	response = client.get(f"/locations/{uuid4()}", headers=_auth_header(uuid4()))
	app.dependency_overrides.clear()

	assert response.status_code == 404
	assert response.json()["detail"] == "Location not found"


def test_get_locations_unauthorized(client):
	response = client.get("/locations")
	assert response.status_code == 401
