"""
Script to calculate matches for all PLANNED trips in the database.
Usage: python -m backend.scripts.calculate_all_matches
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config.db import SessionLocal, _load_models
from backend.loggers.logger import get_logger
from backend.models.trip import Trip, TripStatus
from backend.services.match_service import MatchService
from sqlalchemy import select

logger = get_logger("calculate_all_matches", "calculate_all_matches.log")


def calculate_all_matches():
	"""Calculate matches for all PLANNED trips in the database."""
	
	# Load models
	_load_models()
	
	# Get database session
	db = SessionLocal()
	
	try:
		# Get all PLANNED trips
		planned_trips = db.execute(
			select(Trip).where(Trip.status == TripStatus.PLANNED)
		).scalars().all()
		
		if not planned_trips:
			logger.info("No PLANNED trips found. Nothing to match.")
			return
		
		logger.info("Found %d PLANNED trips. Calculating matches...", len(planned_trips))
		
		total_matches = 0
		for trip in planned_trips:
			try:
				matches_count = MatchService.calculate_matches_for_trip(trip, db)
				total_matches += matches_count
				if matches_count > 0:
					logger.info(
						"Trip %s: Found %d matches",
						trip.id,
						matches_count
					)
			except Exception as e:
				logger.error("Failed to calculate matches for trip %s: %s", trip.id, e)
				continue
		
		# Commit all matches
		db.commit()
		logger.info("Match calculation completed. Created %d total matches.", total_matches)
		
	except Exception as e:
		db.rollback()
		logger.exception("Error during match calculation: %s", e)
		raise
	finally:
		db.close()


if __name__ == "__main__":
	calculate_all_matches()
