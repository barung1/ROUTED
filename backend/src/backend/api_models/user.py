from datetime import date
from uuid import UUID
from pydantic import BaseModel, EmailStr


class RegistrationUserModel(BaseModel):
	username: str
	email: EmailStr
	password: str
	firstName: str
	lastName: str
	location: str | None = None
	dateOfBirth: date | None = None
	interests: list[str] = []
	bio: str | None = None


class UserPublicModel(BaseModel):
	id: UUID
	username: str
	email: EmailStr
	firstName: str | None = None
	lastName: str | None = None
	location: str | None = None
	dateOfBirth: date | None = None
	interests: list[str] = []
	bio: str | None = None
	dateJoined: date | None = None


class LoginUserModel(BaseModel):
	usernameOrEmail: str|EmailStr
	password: str

class LoginResponseModel(BaseModel):
	access_token: str
	token_type: str = "bearer"
	user: UserPublicModel

class UpdateUserModel(BaseModel):
	username: str | None = None
	email: EmailStr | None = None
	password: str | None = None
	firstName: str | None = None
	lastName: str | None = None
	location: str | None = None
	dateOfBirth: date | None = None
	interests: list[str] | None = None
	bio: str | None = None


class UserProfileModel(BaseModel):
	id: UUID
	username: str
	email: EmailStr
	location: str | None = None
	dateOfBirth: date | None = None
	interests: list[str] = []
	bio: str | None = None
	tripsCount: int = 0
	memberSince: date | None = None
