from typing import TYPE_CHECKING
from uuid import UUID, uuid4
from backend.models.Base import Base
from backend.models.associations import location_tags
from sqlalchemy import String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, relationship, mapped_column

if TYPE_CHECKING:
	from backend.models.location import Location

class Tag(Base):
	__tablename__ = 'tags'

	id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		primary_key=True,
		index=True,
		default=uuid4,
		server_default=text("gen_random_uuid()"),
	)
	name: Mapped[str] = mapped_column(String, nullable=False)
	description: Mapped[str] = mapped_column(String, nullable=True)
	color: Mapped[str] = mapped_column(String, nullable=True)
	locations: Mapped[list["Location"]] = relationship(
		"Location",
		secondary=location_tags,
		back_populates="tags",
	)