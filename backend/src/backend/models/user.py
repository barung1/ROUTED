# User model definition
from typing import TYPE_CHECKING
from uuid import UUID, uuid4
from sqlalchemy import String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, relationship, mapped_column
from backend.models.Base import Base
from backend.models.associations import user_trips

if TYPE_CHECKING:
	from backend.models.trip import Trip
	

class User(Base):
	__tablename__ = 'users'
	
	id: Mapped[UUID] = mapped_column(
		PGUUID(as_uuid=True),
		primary_key=True,
		index=True,
		default=uuid4,
		server_default=text("gen_random_uuid()"),
	)
	username: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
	email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
	first_name: Mapped[str] = mapped_column(String, nullable=True)
	last_name: Mapped[str] = mapped_column(String, nullable=True)
	hashed_password: Mapped[str] = mapped_column(String, nullable=False)
	trips: Mapped[list["Trip"]] = relationship(
		"Trip",
		secondary=user_trips,
		back_populates="user",
	)


