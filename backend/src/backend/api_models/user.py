from uuid import UUID, uuid4
from pydantic import BaseModel, EmailStr


class RegistrationUserModel(BaseModel):
	username: str
	email: EmailStr
	password: str
	firstName: str
	lastName: str


class UserPublicModel(BaseModel):
	id: UUID
	username: str
	email: EmailStr
	firstName: str | None = None
	lastName: str | None = None


class LoginUserModel(BaseModel):
	usernameOrEmail: str|EmailStr
	password: str
