from turtle import color
from uuid import UUID
from pydantic import BaseModel

class TagPublicModel(BaseModel):
	id: UUID
	name: str
	color: str