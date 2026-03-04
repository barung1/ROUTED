from uuid import UUID, uuid4
from datetime import timedelta, date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from backend.config.db import get_db_session
from backend.main import app
from backend.models.user import User
from backend.routes.user.user import _hash_password
from backend.auth.jwt import create_access_token


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
		"password": "Secret1!",
		"firstName": "Test",
		"lastName": "User",
		"profilePicture": "https://cdn.example.com/avatar.png",
	}
	response = client.post("/users/register", json=payload)
	app.dependency_overrides.clear()

	assert response.status_code == 201
	body = response.json()
	assert body["username"] == payload["username"]
	assert body["email"] == payload["email"]
	assert body["firstName"] == payload["firstName"]
	assert body["lastName"] == payload["lastName"]
	assert body["profilePicture"] == payload["profilePicture"]
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
		"password": "Secret1!",
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
		"password": "Secret1!",
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

	# Create a JWT token for the user
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)
	
	response = client.delete("/users/me", headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 200
	assert fake_session.deleted == [existing_user]
	assert fake_session.committed is True


def test_delete_user_not_found(client):
	user_id = uuid4()
	fake_session = FakeSession(existing_user=None)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	# Create a JWT token
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)
	
	response = client.delete("/users/me", headers={"Authorization": f"Bearer {token}"})
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

	# Create a JWT token
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)
	
	response = client.delete("/users/me", headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 500
	assert response.json()["detail"] == "Failed to delete user"
	assert fake_session.rolled_back is True


def test_delete_user_unauthorized_no_token(client):
	"""Test that delete endpoint requires a valid JWT token"""
	fake_session = FakeSession()
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	response = client.delete("/users/me")
	app.dependency_overrides.clear()

	assert response.status_code == 401


def test_login_user_with_username_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	payload = {
		"usernameOrEmail": "tester",
		"password": "Secret1!",
	}
	response = client.post("/users/login", json=payload)
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["user"]["username"] == existing_user.username
	assert body["user"]["email"] == existing_user.email
	assert body["user"]["firstName"] == existing_user.first_name
	assert body["user"]["lastName"] == existing_user.last_name


def test_login_user_with_email_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	payload = {
		"usernameOrEmail": "tester@example.com",
		"password": "Secret1!",
	}
	response = client.post("/users/login", json=payload)
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["user"]["username"] == existing_user.username
	assert body["user"]["email"] == existing_user.email
	assert body["user"]["firstName"] == existing_user.first_name
	assert body["user"]["lastName"] == existing_user.last_name


def test_login_user_not_found(client):
	fake_session = FakeSession(existing_user=None)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	payload = {
		"usernameOrEmail": "missing",
		"password": "Secret1!",
	}
	response = client.post("/users/login", json=payload)
	app.dependency_overrides.clear()

	assert response.status_code == 401
	assert response.json()["detail"] == "Invalid username or email"


def test_login_user_invalid_password(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	payload = {
		"usernameOrEmail": "tester",
		"password": "Wrong1!",
	}
	response = client.post("/users/login", json=payload)
	app.dependency_overrides.clear()

	assert response.status_code == 401
	assert response.json()["detail"] == "Invalid username or password"


def test_login_user_missing_username_or_email(client):
	payload = {
		"password": "Secret1!",
	}
	response = client.post("/users/login", json=payload)

	assert response.status_code == 422
	assert any(
		item["loc"] == ["body", "usernameOrEmail"]
		and item["type"] == "missing"
		for item in response.json().get("detail", [])
	)


def test_login_user_missing_password(client):
	payload = {
		"usernameOrEmail": "tester",
	}
	response = client.post("/users/login", json=payload)

	assert response.status_code == 422
	assert any(
		item["loc"] == ["body", "password"]
		and item["type"] == "missing"
		for item in response.json().get("detail", [])
	)


def test_update_user_email_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	# Create a JWT token
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	payload = {
		"email": "newemail@example.com",
	}
	response = client.put("/users/me", json=payload, headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["email"] == "newemail@example.com"
	assert body["username"] == "tester"
	assert body["firstName"] == "Test"
	assert body["lastName"] == "User"
	assert fake_session.committed is True


def test_update_user_password_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	# Create a JWT token
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	payload = {
		"password": "NewSecret2@",
	}
	response = client.put("/users/me", json=payload, headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["username"] == "tester"
	assert fake_session.committed is True


def test_update_user_name_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	# Create a JWT token
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	payload = {
		"firstName": "Updated",
		"lastName": "Name",
	}
	response = client.put("/users/me", json=payload, headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["firstName"] == "Updated"
	assert body["lastName"] == "Name"
	assert body["username"] == "tester"
	assert fake_session.committed is True


def test_update_user_multiple_fields_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	# Create a JWT token
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	payload = {
		"email": "newemail@example.com",
		"firstName": "John",
		"lastName": "Doe",
		"password": "NewSecret2@",
		"profilePicture": "https://cdn.example.com/new-avatar.png",
	}
	response = client.put("/users/me", json=payload, headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["email"] == "newemail@example.com"
	assert body["firstName"] == "John"
	assert body["lastName"] == "Doe"
	assert body["profilePicture"] == "https://cdn.example.com/new-avatar.png"
	assert body["username"] == "tester"
	assert fake_session.committed is True


def test_update_user_invalid_password(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	# Create a JWT token
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	payload = {
		"password": "weak",  # Too short, missing requirements
	}
	response = client.put("/users/me", json=payload, headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 400
	assert "Password must be at least 8 characters" in response.json()["detail"]
	assert fake_session.committed is False


def test_update_user_not_found(client):
	user_id = uuid4()
	fake_session = FakeSession(existing_user=None)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	# Create a JWT token
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	payload = {
		"email": "newemail@example.com",
	}
	response = client.put("/users/me", json=payload, headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 404
	assert response.json()["detail"] == "User not found"


def test_update_user_commit_failure(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user, commit_exc=Exception("fail"))
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	# Create a JWT token
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	payload = {
		"email": "newemail@example.com",
	}
	response = client.put("/users/me", json=payload, headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 500
	assert response.json()["detail"] == "Failed to retrieve user for update"
	assert fake_session.rolled_back is True


def test_update_user_unauthorized_no_token(client):
	"""Test that update endpoint requires a valid JWT token"""
	fake_session = FakeSession()
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	payload = {
		"email": "newemail@example.com",
	}
	response = client.put("/users/me", json=payload)
	app.dependency_overrides.clear()

	assert response.status_code == 401


def test_update_profile_picture_upload_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	response = client.put(
		"/users/me/profile-picture",
		files={"profile_picture": ("avatar.jpg", b"fake-jpeg-bytes", "image/jpeg")},
		headers={"Authorization": f"Bearer {token}"},
	)
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["profilePicture"].startswith("data:image/jpeg;base64,")
	assert fake_session.committed is True


def test_update_profile_picture_upload_invalid_type(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	response = client.put(
		"/users/me/profile-picture",
		files={"profile_picture": ("avatar.png", b"not-jpeg", "image/png")},
		headers={"Authorization": f"Bearer {token}"},
	)
	app.dependency_overrides.clear()

	assert response.status_code == 400
	assert response.json()["detail"] == "Profile picture must be a JPEG/JPG image"
	assert fake_session.committed is False


def test_get_my_profile_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
		location="Pune",
		date_of_birth=date(1998, 5, 2),
		interests=["beaches", "food"],
		bio="Traveler",
		profile_picture="data:image/jpeg;base64,abc123",
		date_joined=date(2024, 1, 10),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["id"] == str(user_id)
	assert body["username"] == "tester"
	assert body["profilePicture"] == "data:image/jpeg;base64,abc123"
	assert body["tripsCount"] == 0


def test_get_my_profile_not_found(client):
	user_id = uuid4()
	fake_session = FakeSession(existing_user=None)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
	app.dependency_overrides.clear()

	assert response.status_code == 404
	assert response.json()["detail"] == "User not found"


def test_get_my_profile_unauthorized_no_token(client):
	response = client.get("/users/me")
	assert response.status_code == 401


def test_update_profile_picture_upload_jpg_content_type_success(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	response = client.put(
		"/users/me/profile-picture",
		files={"profile_picture": ("avatar.jpg", b"jpeg-bytes", "image/jpg")},
		headers={"Authorization": f"Bearer {token}"},
	)
	app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["profilePicture"].startswith("data:image/jpeg;base64,")
	assert fake_session.committed is True


def test_update_profile_picture_upload_empty_file(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	response = client.put(
		"/users/me/profile-picture",
		files={"profile_picture": ("avatar.jpg", b"", "image/jpeg")},
		headers={"Authorization": f"Bearer {token}"},
	)
	app.dependency_overrides.clear()

	assert response.status_code == 400
	assert response.json()["detail"] == "Profile picture file is empty"
	assert fake_session.committed is False


def test_update_profile_picture_upload_too_large(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	too_large = b"a" * (2 * 1024 * 1024 + 1)
	response = client.put(
		"/users/me/profile-picture",
		files={"profile_picture": ("avatar.jpg", too_large, "image/jpeg")},
		headers={"Authorization": f"Bearer {token}"},
	)
	app.dependency_overrides.clear()

	assert response.status_code == 400
	assert response.json()["detail"] == "Profile picture must be 2MB or smaller"
	assert fake_session.committed is False


def test_update_profile_picture_upload_user_not_found(client):
	user_id = uuid4()
	fake_session = FakeSession(existing_user=None)
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	response = client.put(
		"/users/me/profile-picture",
		files={"profile_picture": ("avatar.jpg", b"jpeg-bytes", "image/jpeg")},
		headers={"Authorization": f"Bearer {token}"},
	)
	app.dependency_overrides.clear()

	assert response.status_code == 404
	assert response.json()["detail"] == "User not found"


def test_update_profile_picture_upload_commit_failure(client):
	user_id = uuid4()
	existing_user = User(
		id=user_id,
		username="tester",
		email="tester@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("Secret1!"),
	)
	fake_session = FakeSession(existing_user=existing_user, commit_exc=Exception("fail"))
	app.dependency_overrides[get_db_session] = _override_db_session(fake_session)

	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1)
	)

	response = client.put(
		"/users/me/profile-picture",
		files={"profile_picture": ("avatar.jpg", b"jpeg-bytes", "image/jpeg")},
		headers={"Authorization": f"Bearer {token}"},
	)
	app.dependency_overrides.clear()

	assert response.status_code == 500
	assert response.json()["detail"] == "Failed to update profile picture"
	assert fake_session.rolled_back is True


def test_update_profile_picture_upload_unauthorized_no_token(client):
	response = client.put(
		"/users/me/profile-picture",
		files={"profile_picture": ("avatar.jpg", b"jpeg-bytes", "image/jpeg")},
	)
	assert response.status_code == 401
