"""
Master seed script to reset and populate the entire database.
Usage: python -m backend.scripts.reset_and_seed

This script will:
1. Drop all existing tables
2. Create fresh tables with current schema
3. Load all seed data (users, locations, trips, matches)
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config.db import SessionLocal, Base, engine, _load_models, _ensure_postgres_dependencies
from backend.loggers.logger import get_logger

logger = get_logger("reset_and_seed", "reset_and_seed.log")


def reset_database():
	"""Drop all existing tables and recreate schema."""
	logger.info("Resetting database...")
	
	# Load models to ensure all are registered with Base
	_load_models()
	
	# Ensure PostGIS is available
	_ensure_postgres_dependencies()
	
	# Drop all tables
	logger.info("Dropping all existing tables...")
	Base.metadata.drop_all(bind=engine)
	logger.info("All tables dropped successfully.")
	
	# Create fresh tables
	logger.info("Creating fresh tables...")
	Base.metadata.create_all(bind=engine)
	logger.info("Fresh tables created successfully.")


def seed_database():
	"""Load all seed data."""
	logger.info("Starting database seeding...")
	
	try:
		# Import and run individual seed scripts
		logger.info("Seeding users...")
		from backend.scripts.seed_users import seed_users
		seed_users()
		
		logger.info("Seeding locations...")
		from backend.scripts.seed_destinations import seed_destinations
		seed_destinations()
		
		logger.info("Seeding trips...")
		from backend.scripts.seed_trips import seed_trips
		seed_trips()
		
		logger.info("Calculating matches...")
		from backend.scripts.calculate_all_matches import calculate_all_matches
		calculate_all_matches()
		
		logger.info("Database seeding completed successfully!")
		
	except Exception as e:
		logger.exception("Error during database seeding: %s", e)
		raise


def main():
	"""Main orchestration function."""
	try:
		# Reset database
		reset_database()
		
		# Seed with data
		seed_database()
		
		logger.info("Reset and seed operation completed successfully!")
		
	except Exception as e:
		logger.exception("Critical error in reset_and_seed: %s", e)
		sys.exit(1)


if __name__ == "__main__":
	main()
