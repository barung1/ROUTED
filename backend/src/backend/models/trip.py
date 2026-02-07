import enum
from  backend.models.Base import Base
from backend.models.location import Location
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship,mapped_column, Mapped

class TripStatus(enum.Enum):
	PLANNED = "planned"
	COMPLETED = "completed"
	CANCELLED = "cancelled"

class Trip(Base):
	__tablename__ = 'trips'

	id:Mapped[int] = mapped_column(primary_key=True, index=True)
	user_id:Mapped[int] = mapped_column(nullable=False)
	destination:Mapped["Location"] = relationship("Location", nullable=False)
	start_date:Mapped[str] = mapped_column(nullable=False)
	end_date:Mapped[str] = mapped_column(nullable=False)
	status:Mapped[TripStatus] = mapped_column(nullable=False,default=TripStatus.PLANNED)