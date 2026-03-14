from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session, selectinload

from backend.api_models.match import (
	MatchDetailModel,
	MatchExplanation,
	MatchPublicModel,
	MatchUpdateModel,
	UserBasic,
	TripBasic,
	LocationBasic,
)
from backend.auth.jwt import get_current_user_id
from backend.config.db import get_db_session
from backend.models.match import Match, MatchStatus
from backend.models.location import Location
from backend.models.trip import Trip
from backend.models.user import User
from backend.config.limiter import limiter

router = APIRouter()


def _get_other_user_id(match: Match, current_user_id: UUID) -> UUID:
	"""Get the other user's ID in a match."""
	if match.user_a_id == current_user_id:
		return match.user_b_id
	else:
		return match.user_a_id


def _get_my_trip_id(match: Match, current_user_id: UUID) -> UUID:
	"""Get current user's trip ID in a match."""
	if match.user_a_id == current_user_id:
		return match.trip_a_id
	else:
		return match.trip_b_id


def _get_other_trip_id(match: Match, current_user_id: UUID) -> UUID:
	"""Get other user's trip ID in a match."""
	if match.user_a_id == current_user_id:
		return match.trip_b_id
	else:
		return match.trip_a_id


def _assert_match_accessibility(match: Match, user_id: UUID) -> None:
	"""Verify that the user is part of this match."""
	if match.user_a_id != user_id and match.user_b_id != user_id:
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="Not authorized to access this match",
		)


def _to_match_detail(match: Match, current_user_id: UUID, db: Session) -> MatchDetailModel:
	"""Convert Match model to MatchDetailModel with current user's perspective."""
	other_user_id = _get_other_user_id(match, current_user_id)
	my_trip_id = _get_my_trip_id(match, current_user_id)
	other_trip_id = _get_other_trip_id(match, current_user_id)
	
	# Get other user
	other_user = db.execute(select(User).where(User.id == other_user_id)).scalars().first()
	if not other_user:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Other user not found",
		)
	
	# Get trips
	my_trip = db.execute(select(Trip).where(Trip.id == my_trip_id)).scalars().first()
	other_trip = db.execute(select(Trip).where(Trip.id == other_trip_id)).scalars().first()
	
	if not my_trip or not other_trip:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Trip not found",
		)
	
	# Get location
	location = db.execute(select(Location).where(Location.id == match.location_id)).scalars().first()
	if not location:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Location not found",
		)

	# Compute explanation (shared interests, overlap, budget)
	explanation = _build_match_explanation(match, my_trip, other_trip)

	return MatchDetailModel(
		id=match.id,
		status=match.status,
		score=match.score,
		matchStart=match.match_start,
		matchEnd=match.match_end,
		createdAt=match.created_at,
		myUserId=current_user_id,
		isUserA=match.user_a_id == current_user_id,
		myTrip=TripBasic(
			id=my_trip.id,
			locationId=my_trip.location_id,
			startDate=my_trip.start_date,
			endDate=my_trip.end_date,
			fromPlace=my_trip.from_place,
			toPlace=my_trip.to_place,
			budget=my_trip.budget,
		),
		otherUser=UserBasic(
			id=other_user.id,
			username=other_user.username,
			firstName=other_user.first_name,
			lastName=other_user.last_name,
			email=other_user.email,
		),
		otherTrip=TripBasic(
			id=other_trip.id,
			locationId=other_trip.location_id,
			startDate=other_trip.start_date,
			endDate=other_trip.end_date,
			fromPlace=other_trip.from_place,
			toPlace=other_trip.to_place,
			budget=other_trip.budget,
		),
		location=LocationBasic(
			id=location.id,
			name=location.name,
		),
		explanation=explanation,
	)


def _build_match_explanation(match: Match, my_trip: Trip, other_trip: Trip) -> MatchExplanation:
	"""Build MatchExplanation from match and trip data."""
	overlap_days = (match.match_end - match.match_start).days + 1
	budget_sim = 0.5
	if my_trip.budget is not None and other_trip.budget is not None:
		diff = abs(my_trip.budget - other_trip.budget)
		mx = max(my_trip.budget, other_trip.budget)
		if mx > 0:
			budget_sim = max(0.0, 1.0 - (diff / mx))

	shared_interests: list[str] = []
	try:
		from backend.graph import knowledge_graph
		exp = knowledge_graph.get_match_explanation(match.trip_a_id, match.trip_b_id)
		shared_interests = exp.get("shared_interests") or []
	except Exception:
		pass

	return MatchExplanation(
		shared_interests=shared_interests,
		overlap_days=overlap_days,
		budget_similarity=round(budget_sim, 2),
	)


@router.get("/", response_model=list[MatchPublicModel])
def list_all_matches(
	skip: int = Query(0, ge=0),
	limit: int = Query(10, ge=1, le=100),
	match_status: Optional[str] = Query(None, alias="status"),
	sort_by: str = Query("created_at", regex="^(created_at|score)$"),
	order: str = Query("desc", regex="^(asc|desc)$"),
	db: Session = Depends(get_db_session),
) -> list[MatchPublicModel]:
	"""
	List all matches with pagination, filtering, and sorting.
	
	Query Parameters:
	- skip: Number of records to skip (default: 0)
	- limit: Number of records to return (default: 10, max: 100)
	- status: Filter by match status (optional)
	- sort_by: Sort by 'created_at' or 'score' (default: created_at)
	- order: Sort order 'asc' or 'desc' (default: desc)
	"""
	try:
		query = select(Match)
		
		# Apply status filter if provided
		if match_status:
			try:
				status_enum = MatchStatus(match_status)
				query = query.where(Match.status == status_enum)
			except ValueError:
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST,
					detail=f"Invalid status value: {match_status}. Valid values are: {', '.join([s.value for s in MatchStatus])}"
				)
		
		# Apply sorting
		if sort_by == "score":
			sort_column = Match.score
		else:
			sort_column = Match.created_at
		
		if order == "asc":
			query = query.order_by(sort_column.asc())
		else:
			query = query.order_by(sort_column.desc())
		
		# Apply pagination
		query = query.offset(skip).limit(limit)
		
		matches = db.execute(query).scalars().all()
		
		# Convert to response model
		result = []
		for match in matches:
			result.append(MatchPublicModel(
				id=match.id,
				userAId=match.user_a_id,
				userBId=match.user_b_id,
				tripAId=match.trip_a_id,
				tripBId=match.trip_b_id,
				locationId=match.location_id,
				matchStart=match.match_start,
				matchEnd=match.match_end,
				status=match.status,
				score=match.score,
				createdAt=match.created_at,
			))
		
		return result
	
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Error fetching matches: {str(e)}"
		)


@router.get("/me", response_model=list[MatchDetailModel])
@limiter.limit("100/minute")
def get_my_matches(
	request: Request,
	user_id: UUID = Depends(get_current_user_id),
	match_status: Optional[str] = Query(None, alias="status"),
	skip: int = Query(0, ge=0),
	limit: int = Query(10, ge=1, le=100),
	db: Session = Depends(get_db_session),
) -> list[MatchDetailModel]:
	"""
	Get all matches for the current user with optional status filtering.
	
	Query Parameters:
	- status: Filter by match status (optional)
	- skip: Number of records to skip (default: 0)
	- limit: Number of records to return (default: 10, max: 100)
	
	Returns matches where current user is either user_a or user_b.
	"""
	try:
		query = select(Match).where(
			or_(
				Match.user_a_id == user_id,
				Match.user_b_id == user_id,
			)
		).options(
			selectinload(Match.user_a),
			selectinload(Match.user_b),
			selectinload(Match.trip_a),
			selectinload(Match.trip_b),
		)
		
		# Apply status filter if provided
		if match_status:
			try:
				status_enum = MatchStatus(match_status)
				query = query.where(Match.status == status_enum)
			except ValueError:
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST,
					detail=f"Invalid status value: {match_status}. Valid values are: {', '.join([s.value for s in MatchStatus])}"
				)
		
		# Apply pagination
		query = query.order_by(Match.created_at.desc()).offset(skip).limit(limit)
		
		matches = db.execute(query).scalars().all()
		
		return [_to_match_detail(match, user_id, db) for match in matches]
	
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Error fetching matches: {str(e)}"
		)


@router.get("/{match_id}", response_model=MatchDetailModel)
@limiter.limit("100/minute")
def get_match_by_id(
	request: Request,
	match_id: UUID,
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> MatchDetailModel:
	"""Get detailed information about a specific match."""
	match = db.execute(
		select(Match).where(Match.id == match_id).options(
			selectinload(Match.user_a),
			selectinload(Match.user_b),
			selectinload(Match.trip_a),
			selectinload(Match.trip_b),
		)
	).scalars().first()
	
	if not match:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Match not found",
		)
	
	_assert_match_accessibility(match, user_id)
	
	return _to_match_detail(match, user_id, db)


@router.put("/{match_id}", response_model=MatchDetailModel)
@limiter.limit("100/minute")
def update_match_status(
	request: Request,
	match_id: UUID,
	update: MatchUpdateModel,
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> MatchDetailModel:
	"""
	Update match status. Only users involved in the match can update it.
	
	Status Transitions:
	- PENDING → USER_A_ACCEPTED (if user is A) or USER_B_ACCEPTED (if user is B)
	- PENDING → REJECTED (either user)
	- USER_A_ACCEPTED → BOTH_ACCEPTED (if user is B and accepts)
	- USER_B_ACCEPTED → BOTH_ACCEPTED (if user is A and accepts)
	- BOTH_ACCEPTED → REJECTED (either user)
	"""
	match = db.execute(select(Match).where(Match.id == match_id)).scalars().first()
	
	if not match:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Match not found",
		)
	
	_assert_match_accessibility(match, user_id)
	
	# Determine if current user is user_a or user_b
	is_user_a = match.user_a_id == user_id
	
	new_status = update.status
	current_status = match.status
	
	# Validate status transitions
	if new_status == MatchStatus.REJECTED:
		# Anyone can reject at any time
		match.status = MatchStatus.REJECTED
	elif new_status == MatchStatus.USER_A_ACCEPTED:
		# Only user_a can set this status
		if not is_user_a:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Only user A can set USER_A_ACCEPTED status",
			)
		if current_status not in [MatchStatus.PENDING, MatchStatus.USER_B_ACCEPTED]:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail=f"Cannot transition from {current_status.value} to {new_status.value}",
			)
		match.status = MatchStatus.USER_A_ACCEPTED
	elif new_status == MatchStatus.USER_B_ACCEPTED:
		# Only user_b can set this status
		if is_user_a:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Only user B can set USER_B_ACCEPTED status",
			)
		if current_status not in [MatchStatus.PENDING, MatchStatus.USER_A_ACCEPTED]:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail=f"Cannot transition from {current_status.value} to {new_status.value}",
			)
		match.status = MatchStatus.USER_B_ACCEPTED
	elif new_status == MatchStatus.BOTH_ACCEPTED:
		# Transition to BOTH_ACCEPTED only from appropriate states
		if is_user_a:
			if current_status != MatchStatus.USER_B_ACCEPTED:
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST,
					detail="User A can only set BOTH_ACCEPTED if user B has already accepted",
				)
		else:
			if current_status != MatchStatus.USER_A_ACCEPTED:
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST,
					detail="User B can only set BOTH_ACCEPTED if user A has already accepted",
				)
		match.status = MatchStatus.BOTH_ACCEPTED
	else:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Invalid status transition to {new_status.value}",
		)
	
	db.commit()
	db.refresh(match)
	
	return _to_match_detail(match, user_id, db)


@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_match(
	match_id: UUID,
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> None:
	"""
	Delete/ignore a match. Only users involved in the match can delete it.
	"""
	match = db.execute(select(Match).where(Match.id == match_id)).scalars().first()
	
	if not match:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Match not found",
		)
	
	_assert_match_accessibility(match, user_id)
	
	db.delete(match)
	db.commit()
