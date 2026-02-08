from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from backend.config.db import get_db_session
from backend.main import app
from backend.models.user import User


class _ScalarResult:
	def __init__(self, value):
		self._value = value

	def first(self):
		return self._value


class _Result:
	def __init__(self, value):
		self._value = value

	def scalars(self):
		return _ScalarResult(self._value)


class FakeSession:
	def __init__(self, existing_user=None, commit_exc=None):
		self._existing_user = existing_user
		self._commit_exc = commit_exc
		self.added = []
		self.deleted = []
		self.committed = False
		self.rolled_back = False

	def execute(self, *_args, **_kwargs):
		return _Result(self._existing_user)

	def add(self, obj):
		self.added.append(obj)

	def delete(self, obj):
		self.deleted.append(obj)

	def commit(self):
		if self._commit_exc is not None:
			raise self._commit_exc
		self.committed = True

	def refresh(self, obj):
		if getattr(obj, "id", None) is None:
			obj.id = uuid4()

	def rollback(self):
		self.rolled_back = True


@pytest.fixture
def client():
	return TestClient(app)


def _override_db_session(fake_session):
	def _override():
		yield fake_session
	return _override


def test_register_user_success(client):
	fake_session = FakeSession(existing_user=None)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	payload = {
		"username": "tester",
		"email": "tester@example.com",
		"password": "secret",
		"firstName": "Test",
		"lastName": "User",
	}
	response = client.post("/users/register", json=payload)
	app.dependency_overrides.clear()

	assert response.status_code == 201
	body = response.json()
	assert body["username"] == payload["username"]
	assert body["email"] == payload["email"]
	assert body["firstName"] == payload["firstName"]
	assert body["lastName"] == payload["lastName"]
	assert UUID(body["id"])
	assert len(fake_session.added) == 1
	assert fake_session.committed is True


def test_register_user_duplicate_short_circuit(client):
	existing_user = User(
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password="hash",
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	payload = {
		"username": "tester",
		"email": "tester@example.com",
		"password": "secret",
		"firstName": "Test",
		"lastName": "User",
	}
	response = client.post("/users/register", json=payload)
	app.dependency_overrides.clear()

	assert response.status_code == 400
	assert response.json()["detail"] == "Username or email already registered"
	assert fake_session.committed is False


def test_register_user_duplicate_on_commit(client):
	commit_exc = IntegrityError("stmt", {}, Exception("unique"))
	fake_session = FakeSession(existing_user=None, commit_exc=commit_exc)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	payload = {
		"username": "tester",
		"email": "tester@example.com",
		"password": "secret",
		"firstName": "Test",
		"lastName": "User",
	}
	response = client.post("/users/register", json=payload)
	app.dependency_overrides.clear()

	assert response.status_code == 409
	assert response.json()["detail"] == "Username or email already registered"
	assert fake_session.rolled_back is True


def test_get_user_by_id_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password="hash",
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	response = client.get(f"/users/{user_id}")
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["id"] == str(user_id)
	assert body["username"] == existing_user.username
	assert body["email"] == existing_user.email


def test_get_user_by_id_not_found(client):
	fake_session = FakeSession(existing_user=None)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	response = client.get(f"/users/{uuid4()}")
	app.dependency_overrides.clear()

	assert response.status_code == 404
	assert response.json()["detail"] == "User not found"


def test_delete_user_success(client):	
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password="hash",
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	response = client.delete(f"/users/{user_id}")
	app.dependency_overrides.clear()

	assert response.status_code == 200
	assert fake_session.deleted == [existing_user]
	assert fake_session.committed is True


def test_delete_user_not_found(client):
	fake_session = FakeSession(existing_user=None)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	response = client.delete(f"/users/{uuid4()}")
	app.dependency_overrides.clear()

	assert response.status_code == 404
	assert response.json()["detail"] == "User not found"


def test_delete_user_commit_failure(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password="hash",
	)
	fake_session = FakeSession(existing_user=existing_user, commit_exc=Exception("fail"))
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	response = client.delete(f"/users/{user_id}")
	app.dependency_overrides.clear()

	assert response.status_code == 500
	assert response.json()["detail"] == "Failed to delete user"
	assert fake_session.rolled_back is True
