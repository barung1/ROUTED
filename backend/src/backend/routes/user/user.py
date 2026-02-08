from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import hashlib
import secrets

from backend.config.db import get_db_session
from backend.api_models.user import RegistrationUserModel, UserPublicModel
from backend.models.user import User

router = APIRouter()

def _hash_password(password: str) -> str:
	iterations = 120_000
	salt = secrets.token_hex(16)
	derived_key = hashlib.pbkdf2_hmac(
		"sha256",
		password.encode("utf-8"),
		salt.encode("utf-8"),
		iterations,
	)
	return f"pbkdf2_sha256${iterations}${salt}${derived_key.hex()}"

@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserPublicModel)
def register_user(user: RegistrationUserModel, db: Session = Depends(get_db_session)):
	existing_user = db.execute(
		select(User).where((User.username == user.username) | (User.email == user.email))
	).scalars().first()
	if existing_user:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Username or email already registered",
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