"""
Celery tasks for Routed.
"""

import time
from uuid import UUID

from backend.workers.celery_app import app
from backend.config.db import SessionLocal
from backend.services.match_service import MatchService
from backend.metrics import match_generation_time, matches_created_total
from sqlalchemy import select
from backend.models.trip import Trip


@app.task(bind=True, name="calculate_matches_for_trip")
def calculate_matches_for_trip_id(self, trip_id: str) -> int:
    """
    Calculate and store matches for a trip. Runs asynchronously after trip create/update.
    """
    db = SessionLocal()
    try:
        from sqlalchemy.orm import selectinload
        trip = db.execute(
            select(Trip).where(Trip.id == UUID(trip_id)).options(selectinload(Trip.user))
        ).scalars().first()
        if not trip:
            return 0
        start = time.perf_counter()
        count = MatchService.calculate_matches_for_trip(trip, db)
        match_generation_time.observe(time.perf_counter() - start)
        matches_created_total.inc(count)
        if count > 0:
            db.commit()
        return count
    finally:
        db.close()
