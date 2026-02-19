from datetime import date
from uuid import UUID
from pydantic import BaseModel
from backend.models.trip import TripStatus


class TripCreateModel(BaseModel):
	locationId: UUID
	startDate: str
	endDate: str
	status: TripStatus | None = TripStatus.PLANNED


class TripUpdateModel(BaseModel):
	locationId: UUID | None = None
	startDate: str | None = None
	endDate: str | None = None
	status: TripStatus | None = None


class TripPublicModel(BaseModel):
	id: UUID
	userId: UUID | None = None
	locationId: UUID
	startDate: str
	endDate: str
	status: TripStatus
