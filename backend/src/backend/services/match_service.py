"""
Match Service - Business logic for trip matching and compatibility scoring.

This service provides a flexible and extensible framework for matching trips
based on various criteria. New matching rules and scoring algorithms can be
easily added without modifying the trip routes.
"""

from datetime import date
from typing import List, Tuple, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.models.match import Match
from backend.models.trip import Trip, TripStatus


class MatchService:
	"""
	Service for calculating and managing trip matches.
	
	This service encapsulates all matching logic, making it easy to:
	- Add new matching criteria
	- Adjust scoring algorithms
	- Test matching logic independently
	- Maintain clean separation of concerns
	"""
	
	@staticmethod
	def calculate_matches_for_trip(trip: Trip, db: Session) -> int:
		"""
		Calculate and store all potential matches for a given trip.
		
		Args:
			trip: The trip to find matches for
			db: Database session
			
		Returns:
			Number of new matches created
			
		Note:
			This method is idempotent - running it multiple times won't create duplicates.
		"""
		if not MatchService._is_matchable(trip):
			return 0
		
		potential_matches = MatchService._find_potential_matches(trip, db)
		matches_created = 0
		
		for other_trip in potential_matches:
			if MatchService._should_match(trip, other_trip):
				if MatchService._create_match_if_not_exists(trip, other_trip, db):
					matches_created += 1
		
		if matches_created > 0:
			db.flush()
		
		return matches_created
	
	@staticmethod
	def delete_matches_for_trip(trip_id: UUID, db: Session) -> int:
		"""
		Delete all matches related to a specific trip.
		
		Args:
			trip_id: UUID of the trip
			db: Database session
			
		Returns:
			Number of matches deleted
		"""
		related_matches = db.execute(
			select(Match).where(
				(Match.trip_a_id == trip_id) | (Match.trip_b_id == trip_id)
			)
		).scalars().all()
		
		count = len(related_matches)
		for match in related_matches:
			db.delete(match)
		
		return count
	
	# ==================== Matching Rules ====================
	
	@staticmethod
	def _is_matchable(trip: Trip) -> bool:
		"""
		Check if a trip is eligible for matching.
		
		Current rules:
		- Must have a user
		- Must have a location
		- Must have valid dates
		- Must be in PLANNED status
		
		EXTENSIBILITY: Add new eligibility criteria here
		"""
		if not trip.user or not trip.location_id:
			return False
		
		if not trip.start_date or not trip.end_date:
			return False
		
		# Only match PLANNED trips (users looking for travel companions)
		if trip.status != TripStatus.PLANNED:
			return False
		
		return True
	
	@staticmethod
	def _find_potential_matches(trip: Trip, db: Session) -> List[Trip]:
		"""
		Find all trips that could potentially match with the given trip.
		
		Current criteria:
		- Same location (destination)
		- PLANNED status
		- Different from the input trip
		
		EXTENSIBILITY: Adjust the query to pre-filter candidates
		(e.g., by date range, region, tags, etc.)
		"""
		potential_matches = db.execute(
			select(Trip)
			.where(
				Trip.location_id == trip.location_id,
				Trip.status == TripStatus.PLANNED,
				Trip.id != trip.id,
			)
			.options(selectinload(Trip.user))
		).scalars().all()
		
		return potential_matches
	
	@staticmethod
	def _should_match(trip_a: Trip, trip_b: Trip) -> bool:
		"""
		Determine if two trips should be matched.
		
		Current rules:
		1. Different users (can't match with yourself)
		2. Both have valid dates
		3. Time periods overlap
		
		EXTENSIBILITY: Add more sophisticated matching rules here, such as:
		- Interest alignment
		- Budget compatibility
		- Travel mode preferences
		- Age group compatibility
		- Language preferences
		"""
		# Rule 1: Must be different users
		if not trip_b.user or trip_b.user.id == trip_a.user.id:
			return False
		
		# Rule 2: Both trips must have valid dates
		if not trip_b.start_date or not trip_b.end_date:
			return False
		
		# Rule 3: Time overlap check
		if not MatchService._has_time_overlap(trip_a, trip_b):
			return False
		
		# EXTENSIBILITY: Add more rules here
		# Example future rules:
		# - if not _interests_compatible(trip_a, trip_b): return False
		# - if not _budget_compatible(trip_a, trip_b): return False
		
		return True
	
	@staticmethod
	def _has_time_overlap(trip_a: Trip, trip_b: Trip) -> bool:
		"""
		Check if two trips have overlapping time periods.
		
		Standard interval overlap formula:
		start1 <= end2 AND start2 <= end1
		"""
		return (
			trip_a.start_date <= trip_b.end_date and
			trip_b.start_date <= trip_a.end_date
		)
	
	@staticmethod
	def _create_match_if_not_exists(trip_a: Trip, trip_b: Trip, db: Session) -> bool:
		"""
		Create a match between two trips if it doesn't already exist.
		
		Returns:
			True if a new match was created, False if it already existed
		"""
		# Check if match already exists (in either direction)
		existing_match = db.execute(
			select(Match).where(
				(
					(Match.user_a_id == trip_a.user.id) &
					(Match.user_b_id == trip_b.user.id) &
					(Match.trip_a_id == trip_a.id) &
					(Match.trip_b_id == trip_b.id)
				) |
				(
					(Match.user_a_id == trip_b.user.id) &
					(Match.user_b_id == trip_a.user.id) &
					(Match.trip_a_id == trip_b.id) &
					(Match.trip_b_id == trip_a.id)
				)
			)
		).scalars().first()
		
		if existing_match:
			return False
		
		# Calculate overlap period
		match_start, match_end = MatchService._get_overlap_dates(trip_a, trip_b)
		
		# Calculate compatibility score
		score = MatchService._calculate_match_score(trip_a, trip_b)
		
		# Create new match
		new_match = Match(
			user_a_id=trip_a.user.id,
			user_b_id=trip_b.user.id,
			trip_a_id=trip_a.id,
			trip_b_id=trip_b.id,
			location_id=trip_a.location_id,
			match_start=match_start,
			match_end=match_end,
			score=score,
		)
		db.add(new_match)
		return True
	
	# ==================== Scoring System ====================
	
	@staticmethod
	def _calculate_match_score(trip_a: Trip, trip_b: Trip) -> float:
		"""
		Calculate a compatibility score for two matched trips.
		
		Current implementation: Basic score of 50.0
		
		EXTENSIBILITY: Implement sophisticated scoring algorithm here.
		Score range: 0.0 (poor match) to 100.0 (perfect match)
		
		Future scoring factors:
		1. Time overlap percentage (more overlap = higher score)
		2. Interest similarity (Jaccard index of interests)
		3. Budget compatibility (closer budgets = higher score)
		4. Travel mode compatibility
		5. User ratings/reputation
		6. Social connections (friends of friends)
		"""
		base_score = 50.0
		
		# EXTENSIBILITY: Add scoring components here
		# Example future implementation:
		# overlap_score = _calculate_overlap_score(trip_a, trip_b)
		# interest_score = _calculate_interest_score(trip_a, trip_b)
		# budget_score = _calculate_budget_score(trip_a, trip_b)
		# total_score = (overlap_score * 0.3) + (interest_score * 0.4) + (budget_score * 0.3)
		
		return base_score
	
	# ==================== Helper Methods ====================
	
	@staticmethod
	def _get_overlap_dates(trip_a: Trip, trip_b: Trip) -> Tuple[date, date]:
		"""
		Calculate the exact overlapping date range between two trips.
		
		Returns:
			(overlap_start, overlap_end) as a tuple
		"""
		match_start = max(trip_a.start_date, trip_b.start_date)
		match_end = min(trip_a.end_date, trip_b.end_date)
		return match_start, match_end


# ==================== Future Extensions ====================

"""
EXTENSIBILITY EXAMPLES:

1. Interest-based scoring:
   @staticmethod
   def _calculate_interest_score(trip_a: Trip, trip_b: Trip) -> float:
       interests_a = set(trip_a.interests or [])
       interests_b = set(trip_b.interests or [])
       if not interests_a or not interests_b:
           return 50.0
       intersection = len(interests_a & interests_b)
       union = len(interests_a | interests_b)
       jaccard_index = intersection / union if union > 0 else 0
       return jaccard_index * 100.0

2. Budget compatibility:
   @staticmethod
   def _calculate_budget_score(trip_a: Trip, trip_b: Trip) -> float:
       if not trip_a.budget or not trip_b.budget:
           return 50.0
       budget_diff = abs(trip_a.budget - trip_b.budget)
       max_budget = max(trip_a.budget, trip_b.budget)
       similarity = 1 - (budget_diff / max_budget)
       return similarity * 100.0

3. Overlap duration scoring:
   @staticmethod
   def _calculate_overlap_score(trip_a: Trip, trip_b: Trip) -> float:
       overlap_days = (_get_overlap_dates(trip_a, trip_b)[1] - 
                      _get_overlap_dates(trip_a, trip_b)[0]).days + 1
       trip_a_days = (trip_a.end_date - trip_a.start_date).days + 1
       overlap_ratio = overlap_days / trip_a_days
       return overlap_ratio * 100.0

4. Custom matching strategies:
   class MatchStrategy(ABC):
       @abstractmethod
       def should_match(self, trip_a: Trip, trip_b: Trip) -> bool:
           pass
       
       @abstractmethod
       def calculate_score(self, trip_a: Trip, trip_b: Trip) -> float:
           pass
   
   class AdventureMatchStrategy(MatchStrategy):
       # Match based on adventure level, outdoor activities, etc.
       pass
   
   class BudgetMatchStrategy(MatchStrategy):
       # Match based primarily on budget compatibility
       pass
"""
