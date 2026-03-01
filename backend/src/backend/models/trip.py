from datetime import date
import enum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4
from backend.models.Base import Base
from backend.models.associations import user_trips
from sqlalchemy import Enum, String, ForeignKey, Float, JSON, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship, mapped_column, Mapped
from backend.models.user import User

if TYPE_CHECKING:
	# Avoid runtime circular import; SQLAlchemy resolves relationships by string.
	from backend.models.location import Location

class TripStatus(enum.Enum):
	PLANNED = "planned"
	COMPLETED = "completed"
	CANCELLED = "cancelled"


class TravelMode(enum.Enum):
	FLIGHT = "flight"
	TRAIN = "train"
	BUS = "bus"
	CAR = "car"
	SHIP = "ship"
	BICYCLE = "bicycle"
	WALKING = "walking"
	OTHER = "other"

class Trip(Base):
	__tablename__ = 'trips'

	id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		primary_key=True,
		index=True,
		default=uuid4,
		server_default=text("gen_random_uuid()"),
	)
	user: Mapped[User] = relationship(
		"User",
		secondary=user_trips,
		back_populates="trips",
		uselist=False,
	)
	start_date:Mapped[date] = mapped_column(nullable=False)
	end_date:Mapped[date] = mapped_column(nullable=False)
	status:Mapped[TripStatus] = mapped_column(nullable=False,default=TripStatus.PLANNED)
	from_place: Mapped[str | None] = mapped_column(String, nullable=True)
	to_place: Mapped[str | None] = mapped_column(String, nullable=True)
	mode_of_travel: Mapped[TravelMode | None] = mapped_column(
		Enum(TravelMode, name="travel_mode"),
		nullable=True,
	)
	budget: Mapped[float | None] = mapped_column(Float, nullable=True)
	interests: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
	description: Mapped[str | None] = mapped_column(String, nullable=True)
	location_id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		ForeignKey("locations.id"),
		nullable=False,
	)
	location: Mapped[Location] = relationship(back_populates="trips_location")