from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api_models.trip import TripCreateModel, TripPublicModel, TripUpdateModel
from backend.auth.jwt import get_current_user_id
from backend.config.db import get_db_session
from backend.models.location import Location
from backend.models.trip import Trip, TripStatus
from backend.models.user import User

router = APIRouter()


def _to_public(trip: Trip) -> TripPublicModel:
	return TripPublicModel(
		id=trip.id,
		userId=trip.user.id if trip.user else None,
		locationId=trip.location_id,
		startDate=trip.start_date.isoformat() if trip.start_date else None,
		endDate=trip.end_date.isoformat() if trip.end_date else None,
		status=trip.status,
	)


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=TripPublicModel)
def create_trip(
	trip: TripCreateModel,
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> TripPublicModel:
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
		location_id=trip.locationId,
	)
	new_trip.user = user
	db.add(new_trip)
	db.commit()
	db.refresh(new_trip)
	return _to_public(new_trip)


@router.get("/me", response_model=list[TripPublicModel])
def list_my_trips(
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> list[TripPublicModel]:
	user = db.execute(select(User).where(User.id == user_id)).scalars().first()
	if not user:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="User not found",
		)
	return [_to_public(trip) for trip in user.trips]


@router.get("/{trip_id}", response_model=TripPublicModel)
def get_trip_by_id(trip_id: UUID, db: Session = Depends(get_db_session)) -> TripPublicModel:
	trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalars().first()
	if not trip:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Trip not found",
		)
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
	if not trip.user or trip.user.id != user_id:
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="Not authorized to update this trip",
		)
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
	if not trip.user or trip.user.id != user_id:
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="Not authorized to delete this trip",
		)
	db.delete(trip)
	db.commit()
