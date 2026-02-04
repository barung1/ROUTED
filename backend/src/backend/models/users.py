# User model definition
from sqlalchemy import Column, Integer, String
from backend.config.db import engine
from sqlalchemy.orm import DeclarativeBase
from backend.models.Base import Base
	

class User(Base):
	__tablename__ = 'users'
	
	id = Column(Integer, primary_key=True, index=True)
	username = Column(String, unique=True, index=True, nullable=False)
	email = Column(String, unique=True, index=True, nullable=False)
	first_name = Column(String, nullable=True)
	last_name = Column(String, nullable=True)
	hashed_password = Column(String, nullable=False)


