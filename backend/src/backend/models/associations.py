from sqlalchemy import Column, ForeignKey, Table, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from backend.models.Base import Base

location_tags = Table(
	"location_tags",
	Base.metadata,
	Column("location_id", PGUUID(as_uuid=True), ForeignKey("locations.id"), primary_key=True),
	Column("tag_id", PGUUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True),
)

user_trips = Table(
	"user_trips",
	Base.metadata,
	Column("user_id", PGUUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
	Column("trip_id", PGUUID(as_uuid=True), ForeignKey("trips.id"), primary_key=True),
	UniqueConstraint("trip_id", name="uq_user_trips_trip_id"),
)
