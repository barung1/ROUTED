from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.auth.jwt import create_access_token, verify_access_token
from backend.config.db import SessionLocal
from backend.main import app
from backend.models.user import User


client = TestClient(app)


def _delete_user(username: str, email: str) -> None:
	session = SessionLocal()
	try:
		user = session.execute(
			select(User).where((User.username == username) | (User.email == email))
		).scalars().first()
		if user:
			session.delete(user)
			session.commit()
	finally:
		session.close()


class TestJWTAuth:
	"""Test JWT token creation and verification"""
	
	def test_create_access_token(self):
		"""Test JWT token creation"""
		data = {"sub": "test-user-id", "username": "testuser"}
		expires_delta = timedelta(hours=1)
		token = create_access_token(data, expires_delta)
		
		assert isinstance(token, str)
		assert len(token) > 0
	
	def test_verify_access_token(self):
		"""Test JWT token verification"""
		data = {"sub": "test-user-id", "username": "testuser"}
		expires_delta = timedelta(hours=1)
		token = create_access_token(data, expires_delta)
		
		decoded = verify_access_token(token)
		assert decoded["sub"] == "test-user-id"
		assert decoded["username"] == "testuser"
		assert "exp" in decoded
	
	def test_verify_invalid_token(self):
		"""Test verification of invalid token"""
		with pytest.raises(Exception):
			verify_access_token("invalid.token.here")
	
	def test_login_returns_token(self):
		"""Test that login endpoint returns a token"""
		# First register a user
		unique_id = uuid4().hex[:8]
		registration_data = {
			"username": f"jwtuser{unique_id}",
			"email": f"jwtuser{unique_id}@example.com",
			"password": "SecurePass123!",
			"firstName": "JWT",
			"lastName": "User"
		}
		try:
			register_response = client.post("/users/register", json=registration_data)
			assert register_response.status_code == 201
			
			# Now login
			login_data = {
				"usernameOrEmail": registration_data["username"],
				"password": "SecurePass123!"
			}
			login_response = client.post("/users/login", json=login_data)
			assert login_response.status_code == 200
			
			response_data = login_response.json()
			assert "access_token" in response_data
			assert response_data["token_type"] == "bearer"
			assert "user" in response_data
			assert response_data["user"]["username"] == registration_data["username"]
		finally:
			_delete_user(registration_data["username"], registration_data["email"])
	
	def test_login_with_email_returns_token(self):
		"""Test that login with email endpoint returns a token"""
		# First register a user
		unique_id = uuid4().hex[:8]
		registration_data = {
			"username": f"emailuser{unique_id}",
			"email": f"emailjwtuser{unique_id}@example.com",
			"password": "SecurePass123!",
			"firstName": "Email",
			"lastName": "User"
		}
		try:
			register_response = client.post("/users/register", json=registration_data)
			assert register_response.status_code == 201
			
			# Now login with email
			login_data = {
				"usernameOrEmail": registration_data["email"],
				"password": "SecurePass123!"
			}
			login_response = client.post("/users/login", json=login_data)
			assert login_response.status_code == 200
			
			response_data = login_response.json()
			assert "access_token" in response_data
			assert response_data["token_type"] == "bearer"
		finally:
			_delete_user(registration_data["username"], registration_data["email"])
