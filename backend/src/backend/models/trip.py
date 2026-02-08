import enum
from typing import TYPE_CHECKING
from backend.models.Base import Base
from backend.models.associations import user_trips
from backend.models.location import Location
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship, mapped_column, Mapped

if TYPE_CHECKING:
	from backend.models.users import User

class TripStatus(enum.Enum):
	PLANNED = "planned"
	COMPLETED = "completed"
	CANCELLED = "cancelled"

class Trip(Base):
	__tablename__ = 'trips'

	id:Mapped[int] = mapped_column(primary_key=True, index=True)
	user: Mapped["User"] = relationship(
		"User",
		secondary=user_trips,
		back_populates="trips",
		uselist=False,
	)
	destination:Mapped[Location] = relationship(cascade="all, delete",back_populates="trips_destination")
	start_date:Mapped[str] = mapped_column(nullable=False)
	end_date:Mapped[str] = mapped_column(nullable=False)
	status:Mapped[TripStatus] = mapped_column(nullable=False,default=TripStatus.PLANNED)
	location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
	location: Mapped[Location] = relationship(back_populates="trips_location")