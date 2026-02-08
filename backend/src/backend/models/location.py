from typing import List, TYPE_CHECKING
from backend.models.Base import Base
from backend.models.associations import location_tags
from geoalchemy2 import Geography
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
	from backend.models.tag import Tag

class Location(Base):
	__tablename__ = 'locations'

	id:Mapped[int] = mapped_column(primary_key=True, index=True)
	name:Mapped[str] = mapped_column(nullable=False)
	position:Mapped[str] = mapped_column(
		Geography(geometry_type='POINT', srid=4326,spatial_index=True)
		,nullable=False)
	tags: Mapped[list["Tag"]] = relationship(
		"Tag",
		secondary=location_tags,
		back_populates="locations",
	)
	description:Mapped[str] = mapped_column(nullable=True)