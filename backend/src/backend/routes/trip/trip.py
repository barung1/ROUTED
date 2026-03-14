from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from backend.api_models.trip import TripCreateModel, TripPublicModel, TripUpdateModel
from backend.auth.jwt import get_current_user_id, security, verify_access_token
from backend.config.db import get_db_session
from backend.models.location import Location
from geoalchemy2 import WKTElement

from backend.models.trip import Trip, TripStatus
from backend.models.user import User
from backend.services.match_service import MatchService
from backend.config.limiter import limiter

router = APIRouter()


EXPLORE_SEED_USERNAMES = {
	"anna_lee",
	"ben_stone",
	"chris_miller",
	"diana_wong",
	"ethan_kim",
}


def _assert_trip_ownership(trip: Trip, user_id: UUID) -> None:
	if not trip.user or trip.user.id != user_id:
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="Not authorized to access this trip",
		)


def _validate_date_range(start_date, end_date) -> None:
	if start_date and end_date and end_date < start_date:
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
			detail="End date must be on or after start date",
		)


def _to_public(trip: Trip) -> TripPublicModel:
	from_lat_f = float(trip.from_lat) if trip.from_lat is not None else None
	from_lng_f = float(trip.from_lng) if trip.from_lng is not None else None
	to_lat_f = float(trip.to_lat) if trip.to_lat is not None else None
	to_lng_f = float(trip.to_lng) if trip.to_lng is not None else None
	return TripPublicModel(
		id=trip.id,
		userId=trip.user.id if trip.user else None,
		userName=trip.user_name or (trip.user.username if trip.user else None),
		locationId=trip.location_id,
		startDate=trip.start_date,
		endDate=trip.end_date,
		status=trip.status,
		fromPlace=trip.from_place,
		toPlace=trip.to_place,
		fromLat=from_lat_f,
		fromLng=from_lng_f,
		toLat=to_lat_f,
		toLng=to_lng_f,
		modeOfTravel=trip.mode_of_travel,
		budget=trip.budget,
		interests=trip.interests or [],
		description=trip.description,
	)


def _get_optional_user_id(
	credentials: HTTPAuthorizationCredentials | None,
) -> UUID | None:
	if credentials is None:
		return None

	try:
		payload = verify_access_token(credentials.credentials)
	except HTTPException:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid or expired token",
			headers={"WWW-Authenticate": "Bearer"},
		)

	user_id = payload.get("sub")
	if user_id is None:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid token: missing user ID",
			headers={"WWW-Authenticate": "Bearer"},
		)

	return UUID(user_id)


def _resolve_location_from_place(
	to_place: str | None,
	from_place: str | None,
	db: Session,
) -> UUID | None:
	"""
	Try to match a known Location from the toPlace or fromPlace text.

	Strategy (in order):
	  1. Case-insensitive exact match of location name against toPlace
	  2. Case-insensitive substring match (location name appears in toPlace)
	  3. Reverse substring (toPlace appears in location name)
	  4. Repeat steps 1-3 for fromPlace as fallback

	Returns the location UUID if found, otherwise None.
	"""
	candidates = db.execute(select(Location)).scalars().all()
	if not candidates:
		return None

	for place_text in [to_place, from_place]:
		if not place_text:
			continue
		text_lower = place_text.lower()

		# Exact name match (case-insensitive)
		for loc in candidates:
			if loc.name.lower() == text_lower:
				return loc.id

		# Location name appears anywhere in the place text
		for loc in candidates:
			if loc.name.lower() in text_lower:
				return loc.id

		# Place text appears in the location name
		# (e.g. "Liberty Island" → "Statue of Liberty" won't match above,
		#  but individual significant words might)
		place_words = [w for w in text_lower.replace(",", "").split() if len(w) > 3]
		best_match = None
		best_score = 0
		for loc in candidates:
			loc_lower = loc.name.lower()
			score = sum(1 for w in place_words if w in loc_lower)
			if score > best_score:
				best_score = score
				best_match = loc
		if best_match and best_score > 0:
			return best_match.id

	return None


def _get_or_create_location_from_coords(
	display_name: str,
	lat: float,
	lng: float,
	db: Session,
) -> UUID:
	"""Create a Location from autocomplete selection if none exists. Uses destination name as location name."""
	position_wkt = f"POINT({lng} {lat})"
	position = WKTElement(position_wkt, srid=4326)
	# Use short name: first part before comma (e.g. "Toronto, Ontario, Canada" -> "Toronto")
	name = display_name.split(",")[0].strip() or display_name[:80]
	loc = Location(name=name, position=position)
	db.add(loc)
	db.flush()
	return loc.id


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=TripPublicModel)
@limiter.limit("100/minute")
def create_trip(
	request: Request,
	trip: TripCreateModel,
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> TripPublicModel:
	_validate_date_range(trip.startDate, trip.endDate)
	user = db.execute(select(User).where(User.id == user_id)).scalars().first()
	if not user:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="User not found",
		)
	# Resolve the location for this trip
	location_id = trip.locationId
	if location_id is None:
		# If we have destination coordinates from autocomplete, create Location on the fly
		if trip.toPlace and trip.toLat is not None and trip.toLng is not None:
			location_id = _get_or_create_location_from_coords(
				trip.toPlace, float(trip.toLat), float(trip.toLng), db
			)
		else:
			# Try to infer location from toPlace or fromPlace using fuzzy name matching
			location_id = _resolve_location_from_place(trip.toPlace, trip.fromPlace, db)
			if location_id is None:
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST,
					detail="Could not determine a location for this trip. "
					       "Please select a destination from the autocomplete suggestions.",
				)
	else:
		location = db.execute(select(Location).where(Location.id == location_id)).scalars().first()
		if not location:
			raise HTTPException(
				status_code=status.HTTP_404_NOT_FOUND,
				detail="Location not found",
			)
	new_trip = Trip(
		start_date=trip.startDate,
		end_date=trip.endDate,
		status=trip.status or TripStatus.PLANNED,
		user_name=user.username,
		from_place=trip.fromPlace,
		to_place=trip.toPlace,
		from_lat=trip.fromLat,
		from_lng=trip.fromLng,
		to_lat=trip.toLat,
		to_lng=trip.toLng,
		mode_of_travel=trip.modeOfTravel,
		budget=trip.budget,
		interests=trip.interests,
		description=trip.description,
		location_id=location_id,
	)
	new_trip.user = user
	db.add(new_trip)
	db.commit()
	db.refresh(new_trip)
	
	# Eagerly reload the trip with the user relationship for match calculation
	new_trip = db.execute(
		select(Trip).where(Trip.id == new_trip.id).options(selectinload(Trip.user))
	).scalars().first()
	
	# Calculate and store matches for this new trip
	try:
		from backend.workers.tasks import calculate_matches_for_trip_id
		calculate_matches_for_trip_id.delay(str(new_trip.id))
	except Exception as e:
		# Log error but don't fail the trip creation
		print(f"Warning: Failed to calculate matches: {e}")
	
	# Sync trip to Neo4j knowledge graph in background
	try:
		from backend.graph.knowledge_graph import sync_trip
		sync_trip(
			trip_id=str(new_trip.id),
			user_id=str(user.id),
			location_id=str(location_id),
			interests=trip.interests or [],
		)
	except Exception as e:
		print(f"Warning: Failed to sync trip to Neo4j: {e}")
	
	return _to_public(new_trip)


@router.get("/", response_model=list[TripPublicModel])
def list_all_trips(
	credentials: HTTPAuthorizationCredentials | None = Depends(security),
	db: Session = Depends(get_db_session),
) -> list[TripPublicModel]:
	user_id = _get_optional_user_id(credentials)
	trips = db.execute(select(Trip).options(selectinload(Trip.user))).scalars().all()

	if user_id is None:
		dummy_trips = [
			trip
			for trip in trips
			if trip.user is not None and trip.user.username in EXPLORE_SEED_USERNAMES
		]
		return [_to_public(trip) for trip in dummy_trips]

	visible_trips = [
		trip
		for trip in trips
		if (trip.user is None) or (trip.user.id != user_id)
	]
	return [_to_public(trip) for trip in visible_trips]


@router.get("/me", response_model=list[TripPublicModel])
def list_my_trips(
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> list[TripPublicModel]:
	user = db.execute(select(User).where(User.id == user_id).options(selectinload(User.trips))).scalars().first()
	if not user:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="User not found",
		)
	return [_to_public(trip) for trip in user.trips]


@router.get("/{trip_id}", response_model=TripPublicModel)
def get_trip_by_id(
	trip_id: UUID,
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> TripPublicModel:
	trip = db.execute(
		select(Trip).where(Trip.id == trip_id).options(selectinload(Trip.user))
	).scalars().first()
	if not trip:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Trip not found",
		)
	_assert_trip_ownership(trip, user_id)
	return _to_public(trip)


@router.put("/{trip_id}", response_model=TripPublicModel)
@limiter.limit("100/minute")
def update_trip(
	request: Request,
	trip_id: UUID,
	update: TripUpdateModel,
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> TripPublicModel:
	trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalars().first()
	if not trip:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Trip not found",
		)
	_assert_trip_ownership(trip, user_id)
	
	# Track if status changed from PLANNED to something else
	original_status = trip.status
	status_changed_from_planned = False
	
	if update.locationId is not None:
		location = db.execute(select(Location).where(Location.id == update.locationId)).scalars().first()
		if not location:
			raise HTTPException(
				status_code=status.HTTP_404_NOT_FOUND,
				detail="Location not found",
			)
		trip.location_id = update.locationId
	if update.startDate is not None:
		trip.start_date = update.startDate
	if update.endDate is not None:
		trip.end_date = update.endDate
	if update.status is not None:
		if original_status == TripStatus.PLANNED and update.status != TripStatus.PLANNED:
			status_changed_from_planned = True
		trip.status = update.status
	if update.fromPlace is not None:
		trip.from_place = update.fromPlace
	if update.toPlace is not None:
		trip.to_place = update.toPlace
	if update.fromLat is not None:
		trip.from_lat = update.fromLat
	if update.fromLng is not None:
		trip.from_lng = update.fromLng
	if update.toLat is not None:
		trip.to_lat = update.toLat
	if update.toLng is not None:
		trip.to_lng = update.toLng
	if update.modeOfTravel is not None:
		trip.mode_of_travel = update.modeOfTravel
	if update.budget is not None:
		trip.budget = update.budget
	if update.interests is not None:
		trip.interests = update.interests
	if update.description is not None:
		trip.description = update.description

	_validate_date_range(trip.start_date, trip.end_date)
	
	# If status changed from PLANNED, remove existing matches
	if status_changed_from_planned:
		try:
			MatchService.delete_matches_for_trip(trip_id, db)
		except Exception as e:
			print(f"Warning: Failed to delete matches: {e}")

	db.commit()
	db.refresh(trip)

	# Recalculate matches after trip update (only if status is PLANNED)
	if trip.status == TripStatus.PLANNED:
		try:
			from backend.workers.tasks import calculate_matches_for_trip_id
			calculate_matches_for_trip_id.delay(str(trip.id))
		except Exception:
			try:
				matches_count = MatchService.calculate_matches_for_trip(trip, db)
				if matches_count > 0:
					db.commit()
			except Exception as inner:
				import logging
				logging.getLogger(__name__).warning("Match recalculation failed: %s", inner)

	return _to_public(trip)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(
	trip_id: UUID,
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> None:
	trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalars().first()
	if not trip:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Trip not found",
		)
	_assert_trip_ownership(trip, user_id)
	
	# Delete all matches related to this trip
	try:
		MatchService.delete_matches_for_trip(trip_id, db)
	except Exception as e:
		print(f"Warning: Failed to delete matches: {e}")
	
	db.delete(trip)
	db.commit()
