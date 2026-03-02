"""
Tests for Match API endpoints.

Run with: pytest tests/test_match_api.py -v
"""

import pytest
from uuid import UUID
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session

from backend.models.match import Match, MatchStatus
from backend.models.user import User
from backend.models.trip import Trip, TripStatus
from backend.models.location import Location
from backend.api_models.match import MatchStatus as MatchStatusEnum


@pytest.fixture
def user_a(db: Session):
	"""Create first test user."""
	user = User(
		username="test_user_a",
		email="user_a@test.com",
		first_name="Test",
		last_name="UserA",
	)
	user.set_password("TestPass123!")
	db.add(user)
	db.commit()
	db.refresh(user)
	return user


@pytest.fixture
def user_b(db: Session):
	"""Create second test user."""
	user = User(
		username="test_user_b",
		email="user_b@test.com",
		first_name="Test",
		last_name="UserB",
	)
	user.set_password("TestPass123!")
	db.add(user)
	db.commit()
	db.refresh(user)
	return user


@pytest.fixture
def location(db: Session):
	"""Create test location."""
	from geoalchemy2.shape import from_shape
	from shapely.geometry import Point
	location = Location(
		name="Paris",
		description="The City of Light",
		position=from_shape(Point(2.3522, 48.8566), srid=4326),
	)
	db.add(location)
	db.commit()
	db.refresh(location)
	return location


@pytest.fixture
def trip_a(user_a: User, location: Location, db: Session):
	"""Create first test trip."""
	trip = Trip(
		location_id=location.id,
		start_date=date(2026, 5, 10),
		end_date=date(2026, 5, 15),
		status=TripStatus.PLANNED,
		from_place="Toronto",
		to_place="Paris",
		description="Spring trip to Paris",
	)
	trip.user = user_a
	db.add(trip)
	db.commit()
	db.refresh(trip)
	return trip


@pytest.fixture
def trip_b(user_b: User, location: Location, db: Session):
	"""Create second test trip (overlapping with trip_a)."""
	trip = Trip(
		location_id=location.id,
		start_date=date(2026, 5, 12),
		end_date=date(2026, 5, 18),
		status=TripStatus.PLANNED,
		from_place="Montreal",
		to_place="Paris",
		description="Spring vacation in Paris",
	)
	trip.user = user_b
	db.add(trip)
	db.commit()
	db.refresh(trip)
	return trip


@pytest.fixture
def match(trip_a: Trip, trip_b: Trip, location: Location, user_a: User, user_b: User, db: Session):
	"""Create test match between two trips."""
	match = Match(
		user_a_id=user_a.id,
		user_b_id=user_b.id,
		trip_a_id=trip_a.id,
		trip_b_id=trip_b.id,
		location_id=location.id,
		match_start=date(2026, 5, 12),
		match_end=date(2026, 5, 15),
		status=MatchStatus.PENDING,
		score=85.0,
	)
	db.add(match)
	db.commit()
	db.refresh(match)
	return match


class TestMatchListingAndFiltering:
	"""Test match listing and filtering endpoints."""
	
	def test_get_all_matches(self, client, match):
		"""Test GET /matches endpoint."""
		response = client.get("/matches")
		assert response.status_code == 401  # Needs auth
	
	def test_get_all_matches_with_auth(self, client, match, user_a):
		"""Test GET /matches with authentication."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.get(
			"/matches",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 200
		data = response.json()
		assert isinstance(data, list)
		assert len(data) > 0
		assert data[0]["id"] == str(match.id)
	
	def test_get_all_matches_with_pagination(self, client, match):
		"""Test GET /matches with pagination."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.get(
			"/matches?skip=0&limit=5",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 200
		data = response.json()
		assert len(data) <= 5
	
	def test_get_all_matches_filter_by_status(self, client, match):
		"""Test GET /matches with status filter."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.get(
			"/matches?status=pending",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 200
		data = response.json()
		assert all(item["status"] == "pending" for item in data)
	
	def test_get_all_matches_sort_by_score(self, client, match):
		"""Test GET /matches sorted by score."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.get(
			"/matches?sort_by=score&order=desc",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 200
		data = response.json()
		if len(data) > 1:
			scores = [item["score"] for item in data]
			assert scores == sorted(scores, reverse=True)


class TestGetMyMatches:
	"""Test GET /matches/me endpoint."""
	
	def test_get_my_matches_requires_auth(self, client):
		"""Test that /matches/me requires authentication."""
		response = client.get("/matches/me")
		assert response.status_code == 401
	
	def test_get_my_matches_empty(self, client, user_a):
		"""Test GET /matches/me when no matches exist."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.get(
			"/matches/me",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 200
		data = response.json()
		assert data == []
	
	def test_get_my_matches_returns_details(self, client, match, user_a):
		"""Test GET /matches/me returns detailed match information."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.get(
			"/matches/me",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 200
		data = response.json()
		assert len(data) == 1
		
		match_detail = data[0]
		assert match_detail["id"] == str(match.id)
		assert match_detail["status"] == "pending"
		assert match_detail["myUserId"] == str(user_a.id)
		assert "myTrip" in match_detail
		assert "otherUser" in match_detail
		assert "otherTrip" in match_detail
		assert "location" in match_detail
	
	def test_get_my_matches_filter_by_status(self, client, match, user_a):
		"""Test GET /matches/me with status filter."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.get(
			"/matches/me?status=pending",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 200
		data = response.json()
		assert all(item["status"] == "pending" for item in data)
	
	def test_get_my_matches_both_users_see_same_match(self, client, match, user_a, user_b):
		"""Test that both users in a match can see it."""
		# User A's perspective
		token_a = self._get_token(client, "test_user_a", "TestPass123!")
		response_a = client.get(
			"/matches/me",
			headers={"Authorization": f"Bearer {token_a}"}
		)
		assert response_a.status_code == 200
		matches_a = response_a.json()
		assert len(matches_a) == 1
		
		# User B's perspective
		token_b = self._get_token(client, "test_user_b", "TestPass123!")
		response_b = client.get(
			"/matches/me",
			headers={"Authorization": f"Bearer {token_b}"}
		)
		assert response_b.status_code == 200
		matches_b = response_b.json()
		assert len(matches_b) == 1
		
		# Same match ID but different perspective
		assert matches_a[0]["id"] == matches_b[0]["id"]
		assert matches_a[0]["myUserId"] == str(user_a.id)
		assert matches_b[0]["myUserId"] == str(user_b.id)


class TestGetMatchById:
	"""Test GET /matches/{match_id} endpoint."""
	
	def test_get_match_by_id_requires_auth(self, client, match):
		"""Test that getting match by ID requires authentication."""
		response = client.get(f"/matches/{match.id}")
		assert response.status_code == 401
	
	def test_get_match_by_id_with_auth(self, client, match, user_a):
		"""Test GET /matches/{match_id} with authentication."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.get(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 200
		data = response.json()
		assert data["id"] == str(match.id)
		assert data["status"] == "pending"
	
	def test_get_match_not_found(self, client, user_a):
		"""Test GET /matches/{match_id} with non-existent ID."""
		from uuid import uuid4
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.get(
			f"/matches/{uuid4()}",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 404
	
	def test_get_match_forbidden_for_unrelated_user(self, client, match, user_a, user_b, db):
		"""Test that unauthorized users can't access a match."""
		# Create a third user
		user_c = User(
			username="test_user_c",
			email="user_c@test.com",
			first_name="Test",
			last_name="UserC",
		)
		user_c.set_password("TestPass123!")
		db.add(user_c)
		db.commit()
		
		token_c = self._get_token(client, "test_user_c", "TestPass123!")
		response = client.get(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token_c}"}
		)
		assert response.status_code == 403


class TestUpdateMatchStatus:
	"""Test PUT /matches/{match_id} endpoint."""
	
	def test_update_match_requires_auth(self, client, match):
		"""Test that updating match requires authentication."""
		response = client.put(
			f"/matches/{match.id}",
			json={"status": "user_a_accepted"}
		)
		assert response.status_code == 401
	
	def test_user_a_accepts_match(self, client, match, user_a):
		"""Test user A accepting a match."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.put(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token}"},
			json={"status": "user_a_accepted"}
		)
		assert response.status_code == 200
		data = response.json()
		assert data["status"] == "user_a_accepted"
	
	def test_user_b_accepts_after_a(self, client, match, user_a, user_b, db):
		"""Test user B accepting after user A."""
		# First, user A accepts
		token_a = self._get_token(client, "test_user_a", "TestPass123!")
		response_a = client.put(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token_a}"},
			json={"status": "user_a_accepted"}
		)
		assert response_a.status_code == 200
		
		# Refresh match from DB
		db.refresh(match)
		
		# Then, user B accepts (should transition to BOTH_ACCEPTED)
		token_b = self._get_token(client, "test_user_b", "TestPass123!")
		response_b = client.put(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token_b}"},
			json={"status": "both_accepted"}
		)
		assert response_b.status_code == 200
		data = response_b.json()
		assert data["status"] == "both_accepted"
	
	def test_reject_match(self, client, match, user_a):
		"""Test rejecting a match."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.put(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token}"},
			json={"status": "rejected"}
		)
		assert response.status_code == 200
		data = response.json()
		assert data["status"] == "rejected"
	
	def test_invalid_status_transition(self, client, match, user_a):
		"""Test invalid status transition."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.put(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token}"},
			json={"status": "both_accepted"}  # Can't go directly from PENDING to BOTH_ACCEPTED
		)
		assert response.status_code == 400


class TestDeleteMatch:
	"""Test DELETE /matches/{match_id} endpoint."""
	
	def test_delete_match_requires_auth(self, client, match):
		"""Test that deleting match requires authentication."""
		response = client.delete(f"/matches/{match.id}")
		assert response.status_code == 401
	
	def test_delete_match(self, client, match, user_a):
		"""Test deleting a match."""
		token = self._get_token(client, "test_user_a", "TestPass123!")
		response = client.delete(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 204
		
		# Verify match is deleted
		response = client.get(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token}"}
		)
		assert response.status_code == 404
	
	def test_delete_match_forbidden_for_unrelated_user(self, client, match, user_a, user_b, db):
		"""Test that unauthorized users can't delete a match."""
		# Create a third user
		user_c = User(
			username="test_user_c",
			email="user_c@test.com",
			first_name="Test",
			last_name="UserC",
		)
		user_c.set_password("TestPass123!")
		db.add(user_c)
		db.commit()
		
		token_c = self._get_token(client, "test_user_c", "TestPass123!")
		response = client.delete(
			f"/matches/{match.id}",
			headers={"Authorization": f"Bearer {token_c}"}
		)
		assert response.status_code == 403


# Helper methods
def _get_token(self, client, username: str, password: str) -> str:
	"""Helper to get authentication token."""
	response = client.post(
		"/users/login",
		json={"usernameOrEmail": username, "password": password}
	)
	assert response.status_code == 200
	return response.json()["access_token"]

# Bind helper method to test classes
TestMatchListingAndFiltering._get_token = _get_token
TestGetMyMatches._get_token = _get_token
TestGetMatchById._get_token = _get_token
TestUpdateMatchStatus._get_token = _get_token
TestDeleteMatch._get_token = _get_token
