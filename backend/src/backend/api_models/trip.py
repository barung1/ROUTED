from datetime import date
from uuid import UUID
from pydantic import BaseModel
from backend.models.trip import TripStatus, TravelMode


class TripCreateModel(BaseModel):
	locationId: UUID | None = None
	startDate: date
	endDate: date
	status: TripStatus | None = TripStatus.PLANNED
	fromPlace: str | None = None
	toPlace: str | None = None
	modeOfTravel: TravelMode | None = None
	budget: float | None = None
	interests: list[str] = []
	description: str | None = None


class TripUpdateModel(BaseModel):
	locationId: UUID | None = None
	startDate: date | None = None
	endDate: date | None = None
	status: TripStatus | None = None
	fromPlace: str | None = None
	toPlace: str | None = None
	modeOfTravel: TravelMode | None = None
	budget: float | None = None
	interests: list[str] | None = None
	description: str | None = None


class TripPublicModel(BaseModel):
	id: UUID
	userId: UUID | None = None
	locationId: UUID
	startDate: date
	endDate: date
	status: TripStatus
	fromPlace: str | None = None
	toPlace: str | None = None
	modeOfTravel: TravelMode | None = None
	budget: float | None = None
	interests: list[str] = []
	description: str | None = None
