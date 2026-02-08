from json import load
from operator import ge
import os
from uuid import UUID
from backend.config.env_vars import load_env_variables
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import hashlib
import secrets 

from backend.config.db import get_db_session
from backend.api_models.user import LoginUserModel, RegistrationUserModel, UserPublicModel
from backend.models.user import User
from backend.loggers.logger import get_logger # type: ignore

router = APIRouter()

loaded_env = load_env_variables()
logger = get_logger(__name__)

logger.info("Loaded environment variables for user routes" if loaded_env else "Failed to load environment variables for user routes")
logger.info(f"Environment variables DEV_MODE:{os.getenv('DEV_MODE', 'False')}")

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

	return UserPublicModel(
		id=new_user.id,
		username=new_user.username,
		email=new_user.email,
		firstName=new_user.first_name,
		lastName=new_user.last_name,
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
	)

@router.delete("/{user_id}")
def delete_user(user_id: UUID, db: Session = Depends(get_db_session)) -> None:
	user = db.execute(select(User).where(User.id == user_id)).scalars().first()
	if not user:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="User not found",
		)
	db.delete(user)
	try:
		db.commit()
	except Exception as e:
		db.rollback()
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Failed to delete user",
		)

@router.post("/login", response_model=UserPublicModel)
def login_user(credentials: LoginUserModel, db: Session = Depends(get_db_session)) -> UserPublicModel:
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
	return UserPublicModel(
		id=user.id,
		username=user.username,
		email=user.email,
		firstName=user.first_name,
		lastName=user.last_name,
	)