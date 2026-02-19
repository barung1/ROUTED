"""
Tests for trip routes using real database.

All tests use the test database configured in conftest.py with proper
transaction isolation. Each test gets a clean database state.
"""
from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.auth.jwt import create_access_token
from backend.models.trip import Trip, TripStatus
from backend.models.user import User
from backend.models.location import Location


def _auth_header(user_id):
	"""Generate JWT auth header for a user."""
	token = create_access_token(
		data={"sub": str(user_id), "username": "tester"},
		expires_delta=timedelta(hours=1),
	)
	return {"Authorization": f"Bearer {token}"}


# ========== CREATE TRIP TESTS ==========

def test_create_trip_success(client: TestClient, sample_user: User, sample_location: Location):
	"""Test successful trip creation."""
	payload = {
		"locationId": str(sample_location.id),
		"startDate": "2026-03-01",
		"endDate": "2026-03-10",
		"status": "planned",
	}
	response = client.post("/trips/", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 201
	body = response.json()
	assert body["userId"] == str(sample_user.id)
	assert body["locationId"] == str(sample_location.id)
	assert body["startDate"] == "2026-03-01"
	assert body["endDate"] == "2026-03-10"
	assert body["status"] == "planned"
	assert "id" in body


def test_create_trip_user_not_found(client: TestClient, sample_location: Location):
	"""Test trip creation with non-existent user (simulated via bad JWT)."""
	fake_user_id = uuid4()
	
	payload = {
		"locationId": str(sample_location.id),
		"startDate": "2026-03-01",
		"endDate": "2026-03-10",
	}
	response = client.post("/trips/", json=payload, headers=_auth_header(fake_user_id))

	assert response.status_code == 404
	assert response.json()["detail"] == "User not found"


def test_create_trip_location_not_found(client: TestClient, sample_user: User):
	"""Test trip creation with non-existent location."""
	fake_location_id = uuid4()
	
	payload = {
		"locationId": str(fake_location_id),
		"startDate": "2026-03-01",
		"endDate": "2026-03-10",
	}
	response = client.post("/trips/", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 404
	assert response.json()["detail"] == "Location not found"


def test_create_trip_invalid_date_range(client: TestClient, sample_user: User, sample_location: Location):
	"""Test trip creation with end date before start date."""
	payload = {
		"locationId": str(sample_location.id),
		"startDate": "2026-03-10",
		"endDate": "2026-03-01",  # End before start
	}
	response = client.post("/trips/", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 422
	assert "End date must be on or after start date" in response.json()["detail"]


def test_create_trip_same_dates_allowed(client: TestClient, sample_user: User, sample_location: Location):
	"""Test that single-day trips (same start and end date) are allowed."""
	payload = {
		"locationId": str(sample_location.id),
		"startDate": "2026-03-05",
		"endDate": "2026-03-05",  # Same day
	}
	response = client.post("/trips/", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 201
	body = response.json()
	assert body["startDate"] == "2026-03-05"
	assert body["endDate"] == "2026-03-05"


# ========== LIST MY TRIPS TESTS ==========

def test_list_my_trips_success(client: TestClient, db_session: Session, sample_user: User, multiple_locations: list[Location]):
	"""Test listing trips for a user with multiple trips."""
	# Create trips for the user
	trip1 = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=multiple_locations[0].id,
	)
	trip1.user = sample_user
	
	trip2 = Trip(
		id=uuid4(),
		start_date=date(2026, 4, 1),
		end_date=date(2026, 4, 5),
		status=TripStatus.COMPLETED,
		location_id=multiple_locations[1].id,
	)
	trip2.user = sample_user
	
	db_session.add(trip1)
	db_session.add(trip2)
	db_session.commit()

	response = client.get("/trips/me", headers=_auth_header(sample_user.id))

	assert response.status_code == 200
	body = response.json()
	assert len(body) == 2
	trip_ids = {trip["id"] for trip in body}
	assert str(trip1.id) in trip_ids
	assert str(trip2.id) in trip_ids


def test_list_my_trips_empty(client: TestClient, sample_user: User):
	"""Test listing trips when user has no trips."""
	response = client.get("/trips/me", headers=_auth_header(sample_user.id))

	assert response.status_code == 200
	body = response.json()
	assert len(body) == 0


def test_list_my_trips_user_not_found(client: TestClient):
	"""Test listing trips for non-existent user."""
	fake_user_id = uuid4()
	
	response = client.get("/trips/me", headers=_auth_header(fake_user_id))

	assert response.status_code == 404
	assert response.json()["detail"] == "User not found"


# ========== GET TRIP BY ID TESTS ==========

def test_get_trip_by_id_success(client: TestClient, db_session: Session, sample_user: User, sample_location: Location):
	"""Test getting a trip by ID."""
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=sample_location.id,
	)
	trip.user = sample_user
	db_session.add(trip)
	db_session.commit()

	response = client.get(f"/trips/{trip.id}", headers=_auth_header(sample_user.id))

	assert response.status_code == 200
	body = response.json()
	assert body["id"] == str(trip.id)
	assert body["userId"] == str(sample_user.id)
	assert body["locationId"] == str(sample_location.id)


def test_get_trip_by_id_not_found(client: TestClient, sample_user: User):
	"""Test getting a non-existent trip."""
	fake_trip_id = uuid4()
	
	response = client.get(f"/trips/{fake_trip_id}", headers=_auth_header(sample_user.id))

	assert response.status_code == 404
	assert response.json()["detail"] == "Trip not found"


def test_get_trip_by_id_unauthorized(client: TestClient, db_session: Session, sample_user: User, sample_location: Location):
	"""Test getting a trip that belongs to another user."""
	from backend.routes.user.user import _hash_password
	
	# Create another user
	other_user = User(
		id=uuid4(),
		username=f"otheruser_{uuid4().hex[:8]}",
		email=f"other_{uuid4().hex[:8]}@example.com",
		first_name="Other",
		last_name="User",
		hashed_password=_hash_password("OtherPass123!"),
	)
	db_session.add(other_user)
	
	# Create trip for other user
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=sample_location.id,
	)
	trip.user = other_user
	db_session.add(trip)
	db_session.commit()

	# Try to access with sample_user
	response = client.get(f"/trips/{trip.id}", headers=_auth_header(sample_user.id))

	assert response.status_code == 403
	assert response.json()["detail"] == "Not authorized to access this trip"


# ========== UPDATE TRIP TESTS ==========

def test_update_trip_success(client: TestClient, db_session: Session, sample_user: User, multiple_locations: list[Location]):
	"""Test successful trip update with all fields."""
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=multiple_locations[0].id,
	)
	trip.user = sample_user
	db_session.add(trip)
	db_session.commit()

	payload = {
		"locationId": str(multiple_locations[1].id),
		"startDate": "2026-03-05",
		"endDate": "2026-03-15",
		"status": "completed",
	}
	response = client.put(f"/trips/{trip.id}", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 200
	body = response.json()
	assert body["id"] == str(trip.id)
	assert body["status"] == "completed"


def test_update_trip_partial_update(client: TestClient, db_session: Session, sample_user: User, sample_location: Location):
	"""Test updating only status field."""
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=sample_location.id,
	)
	trip.user = sample_user
	db_session.add(trip)
	db_session.commit()

	payload = {
		"status": "completed",
	}
	response = client.put(f"/trips/{trip.id}", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 200
	body = response.json()
	assert body["status"] == "completed"
	assert body["locationId"] == str(sample_location.id)  # Unchanged


def test_update_trip_not_found(client: TestClient, sample_user: User):
	"""Test updating a non-existent trip."""
	fake_trip_id = uuid4()

	payload = {
		"status": "completed",
	}
	response = client.put(f"/trips/{fake_trip_id}", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 404
	assert response.json()["detail"] == "Trip not found"


def test_update_trip_unauthorized(client: TestClient, db_session: Session, sample_user: User, sample_location: Location):
	"""Test updating a trip that belongs to another user."""
	from backend.routes.user.user import _hash_password
	
	other_user = User(
		id=uuid4(),
		username=f"otheruser_{uuid4().hex[:8]}",
		email=f"other_{uuid4().hex[:8]}@example.com",
		first_name="Other",
		last_name="User",
		hashed_password=_hash_password("OtherPass123!"),
	)
	db_session.add(other_user)
	
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=sample_location.id,
	)
	trip.user = other_user
	db_session.add(trip)
	db_session.commit()

	payload = {
		"status": "completed",
	}
	response = client.put(f"/trips/{trip.id}", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 403
	assert response.json()["detail"] == "Not authorized to access this trip"


def test_update_trip_location_not_found(client: TestClient, db_session: Session, sample_user: User, sample_location: Location):
	"""Test updating trip with non-existent location."""
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=sample_location.id,
	)
	trip.user = sample_user
	db_session.add(trip)
	db_session.commit()

	fake_location_id = uuid4()
	payload = {
		"locationId": str(fake_location_id),
	}
	response = client.put(f"/trips/{trip.id}", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 404
	assert response.json()["detail"] == "Location not found"


def test_update_trip_invalid_date_range(client: TestClient, db_session: Session, sample_user: User, sample_location: Location):
	"""Test updating trip with invalid date range."""
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=sample_location.id,
	)
	trip.user = sample_user
	db_session.add(trip)
	db_session.commit()

	payload = {
		"startDate": "2026-03-15",
		"endDate": "2026-03-10",  # End before start
	}
	response = client.put(f"/trips/{trip.id}", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 422
	assert "End date must be on or after start date" in response.json()["detail"]


def test_update_trip_same_dates_allowed(client: TestClient, db_session: Session, sample_user: User, sample_location: Location):
	"""Test that single-day trips are allowed on update."""
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=sample_location.id,
	)
	trip.user = sample_user
	db_session.add(trip)
	db_session.commit()

	payload = {
		"startDate": "2026-03-05",
		"endDate": "2026-03-05",  # Same day trip
	}
	response = client.put(f"/trips/{trip.id}", json=payload, headers=_auth_header(sample_user.id))

	assert response.status_code == 200


# ========== DELETE TRIP TESTS ==========

def test_delete_trip_success(client: TestClient, db_session: Session, sample_user: User, sample_location: Location):
	"""Test successful trip deletion."""
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=sample_location.id,
	)
	trip.user = sample_user
	db_session.add(trip)
	db_session.commit()
	trip_id = trip.id

	response = client.delete(f"/trips/{trip_id}", headers=_auth_header(sample_user.id))

	assert response.status_code == 204
	
	# Verify trip was deleted
	deleted_trip = db_session.query(Trip).filter(Trip.id == trip_id).first()
	assert deleted_trip is None


def test_delete_trip_not_found(client: TestClient, sample_user: User):
	"""Test deleting a non-existent trip."""
	fake_trip_id = uuid4()

	response = client.delete(f"/trips/{fake_trip_id}", headers=_auth_header(sample_user.id))

	assert response.status_code == 404
	assert response.json()["detail"] == "Trip not found"


def test_delete_trip_unauthorized(client: TestClient, db_session: Session, sample_user: User, sample_location: Location):
	"""Test deleting a trip that belongs to another user."""
	from backend.routes.user.user import _hash_password
	
	other_user = User(
		id=uuid4(),
		username=f"otheruser_{uuid4().hex[:8]}",
		email=f"other_{uuid4().hex[:8]}@example.com",
		first_name="Other",
		last_name="User",
		hashed_password=_hash_password("OtherPass123!"),
	)
	db_session.add(other_user)
	
	trip = Trip(
		id=uuid4(),
		start_date=date(2026, 3, 1),
		end_date=date(2026, 3, 10),
		status=TripStatus.PLANNED,
		location_id=sample_location.id,
	)
	trip.user = other_user
	db_session.add(trip)
	db_session.commit()

	response = client.delete(f"/trips/{trip.id}", headers=_auth_header(sample_user.id))

	assert response.status_code == 403
	assert response.json()["detail"] == "Not authorized to access this trip"
	
	# Verify trip was NOT deleted
	still_exists = db_session.query(Trip).filter(Trip.id == trip.id).first()
	assert still_exists is not None
