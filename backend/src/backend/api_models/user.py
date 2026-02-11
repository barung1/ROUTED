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

class LoginResponseModel(BaseModel):
	access_token: str
	token_type: str = "bearer"
	user: UserPublicModel

class UpdateUserModel(BaseModel):
	email: EmailStr | None = None
	password: str | None = None
	firstName: str | None = None
	lastName: str | None = None
