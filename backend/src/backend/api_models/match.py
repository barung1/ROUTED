from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from backend.models.match import MatchStatus


class UserBasic(BaseModel):
	"""Basic user information for match responses."""
	model_config = ConfigDict(from_attributes=True)
	
	id: UUID
	username: str
	firstName: str | None = None
	lastName: str | None = None
	email: str | None = None


class TripBasic(BaseModel):
	"""Basic trip information for match responses."""
	model_config = ConfigDict(from_attributes=True)
	
	id: UUID
	locationId: UUID
	startDate: date
	endDate: date
	fromPlace: str | None = None
	toPlace: str | None = None
	budget: float | None = None
	interests: list[str] = []


class LocationBasic(BaseModel):
	"""Basic location information for match responses."""
	model_config = ConfigDict(from_attributes=True)
	
	id: UUID
	name: str


class MatchPublicModel(BaseModel):
	"""Match information exposed to the API."""
	model_config = ConfigDict(from_attributes=True)
	
	id: UUID
	userAId: UUID
	userBId: UUID
	tripAId: UUID
	tripBId: UUID
	locationId: UUID
	matchStart: date
	matchEnd: date
	status: MatchStatus
	score: float
	createdAt: datetime


class MatchDetailModel(BaseModel):
	"""Detailed match information including related entities."""
	model_config = ConfigDict(from_attributes=True)
	
	id: UUID
	status: MatchStatus
	score: float
	matchStart: date
	matchEnd: date
	createdAt: datetime
	
	# Current user's perspective
	myUserId: UUID
	isUserA: bool
	myTrip: TripBasic
	
	# Other user's information
	otherUser: UserBasic
	otherTrip: TripBasic
	
	# Shared location
	location: LocationBasic


class MatchUpdateModel(BaseModel):
	"""Update match status."""
	status: MatchStatus

