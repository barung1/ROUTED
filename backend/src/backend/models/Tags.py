from  backend.models.Base import Base
from sqlalchemy import Column, Integer, String

class Tag(Base):
	__tablename__ = 'tags'

	id = Column(Integer, primary_key=True, index=True)
	name = Column(String, nullable=False)
	description = Column(String, nullable=True)
	color = Column(String, nullable=True)