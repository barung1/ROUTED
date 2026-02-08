# User model definition
from typing import List, TYPE_CHECKING
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Mapped, relationship
from backend.models.Base import Base
from backend.models.associations import user_trips

if TYPE_CHECKING:
	from backend.models.trip import Trip
	

class User(Base):
	__tablename__ = 'users'
	
	id = Column(Integer, primary_key=True, index=True)
	username = Column(String, unique=True, index=True, nullable=False)
	email = Column(String, unique=True, index=True, nullable=False)
	first_name = Column(String, nullable=True)
	last_name = Column(String, nullable=True)
	hashed_password = Column(String, nullable=False)
	trips: Mapped[List["Trip"]] = relationship(
		"Trip",
		secondary=user_trips,
		back_populates="users",
	)


