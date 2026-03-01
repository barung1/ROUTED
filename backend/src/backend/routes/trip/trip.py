from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from backend.api_models.trip import TripCreateModel, TripPublicModel, TripUpdateModel
from backend.auth.jwt import get_current_user_id, security, verify_access_token
from backend.config.db import get_db_session
from backend.models.location import Location
from backend.models.trip import Trip, TripStatus
from backend.models.user import User

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
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail="End date must be on or after start date",
		)


def _to_public(trip: Trip) -> TripPublicModel:
	return TripPublicModel(
		id=trip.id,
		userId=trip.user.id if trip.user else None,
		locationId=trip.location_id,
		startDate=trip.start_date,
		endDate=trip.end_date,
		status=trip.status,
		fromPlace=trip.from_place,
		toPlace=trip.to_place,
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


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=TripPublicModel)
def create_trip(
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
	location = db.execute(select(Location).where(Location.id == trip.locationId)).scalars().first()
	if not location:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Location not found",
		)
	new_trip = Trip(
		start_date=trip.startDate,
		end_date=trip.endDate,
		status=trip.status or TripStatus.PLANNED,
		from_place=trip.fromPlace,
		to_place=trip.toPlace,
		mode_of_travel=trip.modeOfTravel,
		budget=trip.budget,
		interests=trip.interests,
		description=trip.description,
		location_id=trip.locationId,
	)
	new_trip.user = user
	db.add(new_trip)
	db.commit()
	db.refresh(new_trip)
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
def update_trip(
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
		trip.status = update.status
	if update.fromPlace is not None:
		trip.from_place = update.fromPlace
	if update.toPlace is not None:
		trip.to_place = update.toPlace
	if update.modeOfTravel is not None:
		trip.mode_of_travel = update.modeOfTravel
	if update.budget is not None:
		trip.budget = update.budget
	if update.interests is not None:
		trip.interests = update.interests
	if update.description is not None:
		trip.description = update.description

	_validate_date_range(trip.start_date, trip.end_date)

	db.commit()
	db.refresh(trip)
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
	db.delete(trip)
	db.commit()
