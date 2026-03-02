"""
Seed script to populate trips into the database.
Usage: python -m backend.scripts.seed_trips
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config.db import SessionLocal, _load_models, _ensure_postgres_dependencies
from backend.loggers.logger import get_logger
from backend.models.location import Location
from backend.models.trip import Trip, TripStatus, TravelMode
from backend.models.user import User

logger = get_logger("seed_trips", "seed_trips.log")


def load_trips_json():
	"""Load the trips JSON file."""
	json_path = Path(__file__).parent.parent.parent.parent / "data" / "trips.json"
	
	if not json_path.exists():
		logger.error("JSON file not found at %s", json_path)
		return None
	
	with open(json_path, "r") as f:
		return json.load(f)


def _parse_date(value: str | None):
	if not value:
		return None
	try:
		return datetime.strptime(value, "%Y-%m-%d").date()
	except ValueError:
		return None


def _parse_travel_mode(value: str | None) -> TravelMode | None:
	"""Parse travel mode string to enum."""
	if not value:
		return None
	try:
		# Try converting to lowercase and matching with enum
		mode_upper = value.upper()
		for mode in TravelMode:
			if mode.name == mode_upper:
				return mode
		logger.warning("Unknown travel mode: %s, defaulting to None", value)
		return None
	except Exception as e:
		logger.warning("Error parsing travel mode %s: %s", value, e)
		return None


def seed_trips():
	"""Seed the database with trip data."""
	
	# Load models and ensure PostGIS is available
	_load_models()
	_ensure_postgres_dependencies()
	
	# Load JSON data
	data = load_trips_json()
	if data is None:
		return
	
	trips_data = data.get("trips", [])
	
	# Get database session
	db = SessionLocal()
	
	try:
		# Build lookup dictionaries by both username and UUID
		all_users = db.query(User).all()
		users_by_username = {user.username: user for user in all_users}
		users_by_id = {str(user.id): user for user in all_users}
		locations = {location.name: location for location in db.query(Location).all()}
		
		if not all_users:
			logger.warning("No users found. Seed users before seeding trips.")
			return
		if not locations:
			logger.warning("No locations found. Seed locations before seeding trips.")
			return
		
		logger.info("Loading %s trips...", len(trips_data))
		
		for trip_data in trips_data:
			user_identifier = trip_data.get("user_id")
			location_name = trip_data.get("location_name")
			
			# Find user by UUID first, then by username
			user = users_by_id.get(str(user_identifier)) or users_by_username.get(user_identifier)
			
			location = locations.get(location_name)
			
			if not user or not location:
				logger.warning(
					"Skipping trip with unknown user/location: user=%s location=%s",
					user_identifier,
					location_name,
				)
				continue
			
			start_date = _parse_date(trip_data.get("start_date"))
			end_date = _parse_date(trip_data.get("end_date"))
			if not start_date or not end_date:
				logger.warning(
					"Skipping trip with invalid dates: user=%s location=%s",
					user_identifier,
					location_name,
				)
				continue
			if end_date < start_date:
				logger.warning(
					"Skipping trip with end_date before start_date: user=%s location=%s",
					user_identifier,
					location_name,
				)
				continue
			
			status_value = trip_data.get("status", TripStatus.PLANNED.value)
			try:
				status = TripStatus(status_value)
			except ValueError:
				logger.warning(
					"Invalid status '%s' for user=%s. Defaulting to planned.",
					status_value,
					user_identifier,
				)
				status = TripStatus.PLANNED
			
			# Check if trip already exists
			existing_trip = (
				db.query(Trip)
				.join(Trip.user)
				.filter(
					User.id == user.id,
					Trip.location_id == location.id,
					Trip.start_date == start_date,
					Trip.end_date == end_date,
				)
				.first()
			)
			if existing_trip:
				logger.info(
					"Trip already exists for user=%s location=%s start=%s end=%s",
					user_identifier,
					location_name,
					start_date,
					end_date,
				)
				continue
			
			# Parse travel mode
			mode_of_travel = _parse_travel_mode(trip_data.get("mode_of_travel"))
			
			# Create trip with all new fields
			trip = Trip(
				start_date=start_date,
				end_date=end_date,
				status=status,
				location=location,
				user=user,
				from_place=trip_data.get("from_place"),
				to_place=trip_data.get("to_place"),
				mode_of_travel=mode_of_travel,
				budget=trip_data.get("budget"),
				interests=trip_data.get("interests", []),
				description=trip_data.get("description"),
			)
			
			db.add(trip)
		
		# Commit all changes
		db.commit()
		logger.info("Trips seeded successfully.")
		
	except Exception as e:
		db.rollback()
		logger.exception("Error during seeding: %s", e)
		raise
	finally:
		db.close()


if __name__ == "__main__":
	seed_trips()
