"""
Seed script to populate example users into the database.
Usage: python -m backend.scripts.seed_users
"""

import json
import sys
from pathlib import Path
import hashlib
import secrets
from datetime import datetime
from uuid import UUID

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config.db import SessionLocal, engine, _load_models, _ensure_postgres_dependencies
from backend.loggers.logger import get_logger
from backend.models.Base import Base
from backend.models.user import User

logger = get_logger("seed_users", "seed_users.log")


def _hash_password(password: str) -> str:
	"""Hash a password using PBKDF2-SHA256."""
	iterations = 120_000 
	salt = secrets.token_hex(16)
	derived_key: bytes = hashlib.pbkdf2_hmac(
		"sha256",
		password.encode("utf-8"),
		salt.encode("utf-8"),
		iterations,
	)
	return f"pbkdf2_sha256${iterations}${salt}${derived_key.hex()}"


def load_users_json():
	"""Load the users JSON file."""
	json_path = Path(__file__).parent.parent.parent.parent / "data" / "users.json"
	
	if not json_path.exists():
		logger.error("JSON file not found at %s", json_path)
		return None
	
	with open(json_path, 'r') as f:
		return json.load(f)


def seed_users():
	"""Seed the database with example users."""
	
	# Load models and ensure PostGIS is available
	_load_models()
	_ensure_postgres_dependencies()
	
	# Load JSON data
	data = load_users_json()
	if data is None:
		return
	
	users_data = data.get('users', [])
	
	# Get database session
	db = SessionLocal()
	
	try:
		logger.info("Loading %s example users...", len(users_data))
		
		for user_data in users_data:
			# Check if user already exists
			existing_user = db.query(User).filter(
				User.username == user_data['username']
			).first()
			
			if existing_user:
				logger.info("User '%s' already exists, skipping...", user_data['username'])
				continue
			
			# Hash the password
			hashed_password = _hash_password(user_data['password'])
			
			# Parse date_of_birth if provided
			date_of_birth = None
			if user_data.get('date_of_birth'):
				try:
					date_of_birth = datetime.strptime(user_data['date_of_birth'], '%Y-%m-%d').date()
				except ValueError:
					logger.warning("Invalid date_of_birth format for user %s", user_data['username'])
			
			# Parse date_joined if provided, otherwise None (uses server default)
			date_joined = None
			if user_data.get('date_joined'):
				try:
					date_joined = datetime.strptime(user_data['date_joined'], '%Y-%m-%d').date()
				except ValueError:
					logger.warning("Invalid date_joined format for user %s", user_data['username'])
			
			# Parse UUID if provided in JSON
			user_id = None
			if user_data.get('id'):
				try:
					user_id = UUID(user_data['id'])
				except (ValueError, TypeError):
					logger.warning("Invalid UUID format for user %s", user_data['username'])
			
			# Create user (with explicit ID if provided)
			user = User(
				username=user_data['username'],
				email=user_data['email'],
				first_name=user_data.get('first_name'),
				last_name=user_data.get('last_name'),
				hashed_password=hashed_password,
				date_of_birth=date_of_birth,
				date_joined=date_joined
			)
			
			# Set UUID if provided in JSON
			if user_id:
				user.id = user_id
			
			db.add(user)
		
		# Commit all changes
		db.commit()
		logger.info("Users seeded successfully.")
		
	except Exception as e:
		db.rollback()
		logger.exception("Error during seeding: %s", e)
		raise
	finally:
		db.close()


if __name__ == "__main__":
	seed_users()
