from  backend.models.Base import Base
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Relationship

class Location(Base):
	__tablename__ = 'locations'

	id = Column(Integer, primary_key=True, index=True)
	name = Column(String, nullable=False)
	latitude = Column(String, nullable=False)
	longitude = Column(String, nullable=False)
	tags = Relationship('Tag', secondary='location_tags',
					  back_populates='locations')
	description = Column(String, nullable=True)