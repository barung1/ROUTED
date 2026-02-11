from pydantic import BaseModel
from backend.api_models.user import UserPublicModel


class TokenModel(BaseModel):
	access_token: str
	token_type: str = "bearer"
