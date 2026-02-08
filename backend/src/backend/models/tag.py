from typing import List, TYPE_CHECKING
from backend.models.Base import Base
from backend.models.associations import location_tags
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Mapped, relationship

if TYPE_CHECKING:
	from backend.models.location import Location

class Tag(Base):
	__tablename__ = 'tags'

	id = Column(Integer, primary_key=True, index=True)
	name = Column(String, nullable=False)
	description = Column(String, nullable=True)
	color = Column(String, nullable=True)
	locations: Mapped[List["Location"]] = relationship(
		"Location",
		secondary=location_tags,
		back_populates="tags",
	)