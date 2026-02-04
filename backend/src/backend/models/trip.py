from  backend.models.Base import Base
from sqlalchemy import Column, Integer, String

class Trip(Base):
	__tablename__ = 'trips'

	id = Column(Integer, primary_key=True, index=True)
	user_id = Column(Integer, nullable=False)
	destination = Column(String, nullable=False)
	start_date = Column(String, nullable=False)
	end_date = Column(String, nullable=False)
	status = Column(String, nullable=False)  # e.g., planned, completed, cancelled