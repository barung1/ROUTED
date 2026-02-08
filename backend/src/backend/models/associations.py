from sqlalchemy import Column, ForeignKey, Integer, Table, UniqueConstraint
from backend.models.Base import Base

location_tags = Table(
	"location_tags",
	Base.metadata,
	Column("location_id", Integer, ForeignKey("locations.id"), primary_key=True),
	Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)

user_trips = Table(
	"user_trips",
	Base.metadata,
	Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
	Column("trip_id", Integer, ForeignKey("trips.id"), primary_key=True),
	UniqueConstraint("trip_id", name="uq_user_trips_trip_id"),
)
