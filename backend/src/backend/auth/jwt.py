from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

security = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
	"""
	Create a JWT access token.
	
	Args:
		data: Dictionary containing claims to encode
		expires_delta: Optional timedelta for token expiration. Defaults to 30 minutes.
	
	Returns:
		Encoded JWT token string
	"""
	secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
	algorithm = os.getenv("JWT_ALGORITHM", "HS256")
	
	to_encode = data.copy()
	if expires_delta:
		expire = datetime.now(timezone.utc) + expires_delta
	else:
		expire = datetime.now(timezone.utc) + timedelta(minutes=30)
	
	to_encode.update({"exp": expire})
	encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=algorithm)
	return encoded_jwt


def verify_access_token(token: str) -> dict:
	"""
	Verify and decode a JWT access token.
	
	Args:
		token: JWT token string to verify
	
	Returns:
		Decoded token payload
	
	Raises:
		HTTPException: If token is invalid or expired
	"""
	secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
	algorithm = os.getenv("JWT_ALGORITHM", "HS256")
	
	try:
		payload = jwt.decode(token, secret_key, algorithms=[algorithm])
		return payload
	except JWTError:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid or expired token",
			headers={"WWW-Authenticate": "Bearer"},
		)


def get_current_user_id(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> str:
	"""
	Dependency to extract and verify the current user ID from JWT Bearer token.
	
	Args:
		credentials: HTTPAuthorizationCredentials from Authorization header
	
	Returns:
		User ID from token
	
	Raises:
		HTTPException: If token is invalid or missing user ID
	"""
	if credentials is None:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Not authenticated",
			headers={"WWW-Authenticate": "Bearer"},
		)

	token = credentials.credentials
	payload = verify_access_token(token)
	user_id: str | None = payload.get("sub", None)
	if user_id is None:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid token: missing user ID",
			headers={"WWW-Authenticate": "Bearer"},
		)
	return user_id
