from uuid import UUID
from pydantic import BaseModel

class LocationPublicModel(BaseModel):
	id: UUID
	name: str
	description: str
	latitude: float
	longitude: float
	tags: list[UUID] = []