from datetime import date, datetime
import enum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4
from backend.models.Base import Base
from sqlalchemy import ForeignKey, Float, Enum, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
	from backend.models.location import Location
	from backend.models.trip import Trip
	from backend.models.user import User


class MatchStatus(enum.Enum):
	PENDING = "pending"
	USER_A_ACCEPTED = "user_a_accepted"
	USER_B_ACCEPTED = "user_b_accepted"
	BOTH_ACCEPTED = "both_accepted"
	REJECTED = "rejected"


class Match(Base):
	__tablename__ = "matches"

	id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		primary_key=True,
		index=True,
		default=uuid4,
		server_default=text("gen_random_uuid()"),
	)
	user_a_id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		ForeignKey("users.id"),
		nullable=False,
	)
	user_b_id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		ForeignKey("users.id"),
		nullable=False,
	)
	trip_a_id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		ForeignKey("trips.id"),
		nullable=False,
	)
	trip_b_id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		ForeignKey("trips.id"),
		nullable=False,
	)
	location_id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		ForeignKey("locations.id"),
		nullable=False,
	)
	match_start: Mapped[date] = mapped_column(nullable=False)
	match_end: Mapped[date] = mapped_column(nullable=False)
	status: Mapped[MatchStatus] = mapped_column(
		Enum(MatchStatus, native_enum=False),
		nullable=False,
		default=MatchStatus.PENDING,
	)
	score: Mapped[float] = mapped_column(
		Float,
		nullable=False,
		default=0.0,
		comment="Compatibility score between two users (0.0 - 100.0). Used for ranking matches and matching algorithm."
	)
	created_at: Mapped[datetime] = mapped_column(
		nullable=False,
		server_default=text("CURRENT_TIMESTAMP"),
	)

	user_a: Mapped["User"] = relationship("User", foreign_keys=[user_a_id])
	user_b: Mapped["User"] = relationship("User", foreign_keys=[user_b_id])
	trip_a: Mapped["Trip"] = relationship("Trip", foreign_keys=[trip_a_id])
	trip_b: Mapped["Trip"] = relationship("Trip", foreign_keys=[trip_b_id])
	location: Mapped["Location"] = relationship("Location")
