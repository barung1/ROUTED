from typing import TYPE_CHECKING
from uuid import UUID, uuid4
from backend.models.Base import Base
from backend.models.associations import location_tags
from geoalchemy2 import Geography
from sqlalchemy import String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.models.tag import Tag
from backend.models.trip import Trip

	

class Location(Base):
	__tablename__ = 'locations'

	id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		primary_key=True,
		index=True,
		default=uuid4,
		server_default=text("gen_random_uuid()"),
	)
	name: Mapped[str] = mapped_column(nullable=False)
	position: Mapped[str] = mapped_column(
		Geography(geometry_type='POINT', srid=4326,spatial_index=True)
		,nullable=False)
	tags: Mapped[list["Tag"]] = relationship(
		"Tag",
		secondary=location_tags,
		back_populates="locations",
	)
	trips_location: Mapped[list["Trip"]] = relationship(
		"Trip",
		back_populates="location",
	)
	description: Mapped[str] = mapped_column(nullable=True)