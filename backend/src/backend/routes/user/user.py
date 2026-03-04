from json import load
from operator import ge
import os
import base64
from uuid import UUID
from backend.config.env_vars import load_env_variables
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
import hashlib
import secrets 
from datetime import timedelta

from backend.config.db import get_db_session
from backend.api_models.user import (
	LoginUserModel,
	RegistrationUserModel,
	UpdateUserModel,
	UserPublicModel,
	LoginResponseModel,
	UserProfileModel,
)
from backend.models.user import User
from backend.loggers.logger import get_logger # type: ignore
from backend.auth.jwt import create_access_token, get_current_user_id

router = APIRouter()

loaded_env = load_env_variables()
logger = get_logger(__name__)

# logger.info("Loaded environment variables for user routes" if loaded_env else "Failed to load environment variables for user routes")
# logger.info(f"Environment variables DEV_MODE:{os.getenv('DEV_MODE', 'False')}")

def _valid_password(password: str) -> bool:
	if len(password) < 8:
		return False
	if not any(c.islower() for c in password):
		return False
	if not any(c.isupper() for c in password):
		return False
	if not any(c.isdigit() for c in password):
		return False
	if not any(c in "!@#$%^&*()-_=+[]{}|;:,.<>?/" for c in password):
		return False
	return True

def _valid_username(username: str) -> bool:
	'''
	Validates that the username is between 3 and 30 characters and contains only alphanumeric characters.
	No spaces or special characters allowed.
	'''
	if len(username) < 3 or len(username) > 30:
		return False
	if not username.isalnum():
		return False
	return True

def _hash_password(password: str) -> str:
	iterations = 120_000 
	salt = secrets.token_hex(16)
	derived_key: bytes = hashlib.pbkdf2_hmac(
		"sha256",
		password.encode("utf-8"),
		salt.encode("utf-8"),
		iterations,
	)
	return f"pbkdf2_sha256${iterations}${salt}${derived_key.hex()}"

def _verify_password(stored_password: str, provided_password: str) -> bool:
	try:
		algorithm, iterations_str, salt, derived_key_hex = stored_password.split('$')
		iterations = int(iterations_str)
		provided_derived_key: bytes = hashlib.pbkdf2_hmac(
			"sha256",
			provided_password.encode("utf-8"),
			salt.encode("utf-8"),
			iterations,
		)
		return provided_derived_key.hex() == derived_key_hex
	except Exception as e:
		logger.error(f"Error verifying password: {e}")
		return False


def _to_user_public(user: User) -> UserPublicModel:
	return UserPublicModel(
		id=user.id,
		username=user.username,
		email=user.email,
		firstName=user.first_name,
		lastName=user.last_name,
		location=user.location,
		dateOfBirth=user.date_of_birth,
		interests=user.interests or [],
		bio=user.bio,
		profilePicture=user.profile_picture,
		dateJoined=user.date_joined,
	)

@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserPublicModel)
def register_user(user: RegistrationUserModel, db: Session = Depends(get_db_session)):
	if os.getenv("DEV_MODE", "False").lower() == "true":
		print(f"Registering user: {user}")
	existing_user = db.execute(
		select(User).where((User.username == user.username) | (User.email == user.email))
	).scalars().first()
	if existing_user:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Username or email already registered",
		)
	if not _valid_password(user.password):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Password must be at least 8 characters long and include uppercase, lowercase, digit, and special character",
		)
	if not _valid_username(user.username):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Username must be 3-30 characters long and contain only alphanumeric characters",
		)
	new_user = User(
		username=user.username,
		email=user.email,
		first_name=user.firstName,
		last_name=user.lastName,
		hashed_password=_hash_password(user.password),
		location=user.location,
		date_of_birth=user.dateOfBirth,
		interests=user.interests,
		bio=user.bio,
		profile_picture=user.profilePicture,
	)
	db.add(new_user)
	try:
		db.commit()
	except IntegrityError:
		db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="Username or email already registered",
		)
	db.refresh(new_user)

	return _to_user_public(new_user)


@router.get("/me", response_model=UserProfileModel)
def get_my_profile(
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> UserProfileModel:
	user = db.execute(
		select(User).where(User.id == user_id).options(selectinload(User.trips))
	).scalars().first()
	if not user:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="User not found",
		)

	return UserProfileModel(
		id=user.id,
		username=user.username,
		email=user.email,
		location=user.location,
		dateOfBirth=user.date_of_birth,
		interests=user.interests or [],
		bio=user.bio,
		profilePicture=user.profile_picture,
		tripsCount=len(user.trips or []),
		memberSince=user.date_joined,
	)

@router.get("/{user_id}", response_model=UserPublicModel)
def get_user_by_id(user_id: UUID, db: Session = Depends(get_db_session)) -> UserPublicModel:
	user = db.execute(select(User).where(User.id == user_id)).scalars().first()
	if not user:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="User not found",
		)
	return UserPublicModel(
		id=user.id,
		username=user.username,
		email=user.email,
		firstName=user.first_name,
		lastName=user.last_name,
		location=user.location,
		dateOfBirth=user.date_of_birth,
		interests=user.interests or [],
		bio=user.bio,
		profilePicture=user.profile_picture,
		dateJoined=user.date_joined,
	)

@router.delete("/me")
def delete_current_user(user_id: UUID = Depends(get_current_user_id), db: Session = Depends(get_db_session)) -> None:
	try:
		user = db.execute(select(User).where(User.id == user_id)).scalars().first()
		if not user:
			raise HTTPException(
				status_code=status.HTTP_404_NOT_FOUND,
				detail="User not found",
			)
		db.delete(user)
		db.commit()
	except ValueError:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Invalid user ID format",
		)
	except HTTPException:
		raise
	except Exception as e:
		db.rollback()
		logger.error(f"Failed to delete user {user_id}: {e}")
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Failed to delete user",
		)

@router.put("/me")
def update_user(update: UpdateUserModel, user_id: UUID = Depends(get_current_user_id), db: Session = Depends(get_db_session)) -> UserPublicModel:
	try:
		user = db.execute(select(User).where(User.id == user_id)).scalars().first()
		if not user:
			raise HTTPException(
				status_code=status.HTTP_404_NOT_FOUND,
				detail="User not found",
			)
		if update.username is not None:
			if not _valid_username(update.username):
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST,
					detail="Username must be 3-30 characters long and contain only alphanumeric characters",
				)
			existing_username_user = db.execute(
				select(User).where(User.username == update.username, User.id != user_id)
			).scalars().first()
			if existing_username_user:
				raise HTTPException(
					status_code=status.HTTP_409_CONFLICT,
					detail="Username already registered",
				)
			user.username = update.username
		if update.email is not None:
			user.email = update.email
		if update.password is not None:
			if not _valid_password(update.password):
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST,
					detail="Password must be at least 8 characters long and include uppercase, lowercase, digit, and special character",
				)
			user.hashed_password = _hash_password(update.password)
		if update.firstName is not None:
			user.first_name = update.firstName
		if update.lastName is not None:
			user.last_name = update.lastName
		if update.location is not None:
			user.location = update.location
		if update.dateOfBirth is not None:
			user.date_of_birth = update.dateOfBirth
		if update.interests is not None:
			user.interests = update.interests
		if update.bio is not None:
			user.bio = update.bio
		if update.profilePicture is not None:
			user.profile_picture = update.profilePicture
		db.commit()
		db.refresh(user)
		return _to_user_public(user)
	except IntegrityError:
		db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="Username or email already registered",
		)
	except HTTPException:
		raise
	except Exception as e:
		db.rollback()
		logger.error(f"Failed to Update user: {user_id} for update: {e}")
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Failed to retrieve user for update",
		)


@router.put("/me/profile-picture", response_model=UserPublicModel)
async def update_profile_picture(
	profile_picture: UploadFile = File(...),
	user_id: UUID = Depends(get_current_user_id),
	db: Session = Depends(get_db_session),
) -> UserPublicModel:
	allowed_content_types = {"image/jpeg", "image/jpg", "image/pjpeg"}
	if profile_picture.content_type not in allowed_content_types:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Profile picture must be a JPEG/JPG image",
		)

	content = await profile_picture.read()
	if not content:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Profile picture file is empty",
		)

	max_size_bytes = 2 * 1024 * 1024
	if len(content) > max_size_bytes:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Profile picture must be 2MB or smaller",
		)

	user = db.execute(select(User).where(User.id == user_id)).scalars().first()
	if not user:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="User not found",
		)

	encoded = base64.b64encode(content).decode("ascii")
	user.profile_picture = f"data:image/jpeg;base64,{encoded}"

	try:
		db.commit()
		db.refresh(user)
		return _to_user_public(user)
	except Exception as e:
		db.rollback()
		logger.error(f"Failed to update profile picture for user {user_id}: {e}")
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Failed to update profile picture",
		)
	

@router.post("/login", response_model=LoginResponseModel)
def login_user(credentials: LoginUserModel, db: Session = Depends(get_db_session)) -> LoginResponseModel:
	username_or_email = credentials.usernameOrEmail
	password = credentials.password
	isEmail = "@" in username_or_email
	user:User|None = None
	if isEmail:
		logger.info(f"Attempting login with email: {username_or_email}")
		user = db.execute(select(User).where(User.email == username_or_email)).scalars().first()
	else:
		logger.info(f"Attempting login with username: {username_or_email}")
		user = db.execute(select(User).where(User.username == username_or_email)).scalars().first()
	if not user:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid username or email",
		)
	elif not _verify_password(user.hashed_password, password):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid username or password",
		)
	
	# Create JWT token
	access_token_expires = timedelta(hours=int(os.getenv("TOKEN_EXPIRE_HOURS", "24")))
	access_token = create_access_token(
		data={"sub": str(user.id), "username": user.username},
		expires_delta=access_token_expires
	)
	
	user_public = _to_user_public(user)
	
	return LoginResponseModel(
		access_token=access_token,
		token_type="bearer",
		user=user_public
	)