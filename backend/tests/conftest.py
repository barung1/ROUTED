
"""
Test configuration and fixtures.

This module sets up pytest fixtures for database testing using a real PostgreSQL database.
The database connection is configured via environment variables (see .gitlab-ci.yml).
All tests use transactions that are rolled back after each test for isolation.
"""
import os
from typing import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session

from backend.config.db import get_db_session
from backend.main import app
from backend.models.Base import Base
from backend.models.location import Location
from backend.models.tag import Tag
from backend.models.trip import Trip
from backend.models.user import User


# Test database URL
TEST_DATABASE_URL = f"postgresql+psycopg://{os.getenv('POSTGRES_USER', 'routed_user')}:{os.getenv('POSTGRES_PASSWORD', 'routed_password')}@{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'routed_test')}"

def get_table_name(table_key: str) -> str:
    """Get the full table name including schema prefix if present."""
    for key in Base.metadata.tables.keys():
        # Handle both schema-qualified names (e.g., "routed.users") and bare names
        if key.endswith(f".{table_key}") or key == table_key:
            return key
    raise KeyError(f"Table '{table_key}' not found in metadata")

@pytest.fixture(scope="session")
def test_engine() -> Generator[Engine, None, None]:
	"""Create a test database engine for the entire test session."""
	engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
	
	# Ensure PostGIS extensions are available
	with engine.connect() as connection:
		connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
		connection.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
		connection.commit()
	
	# Create all tables
	Base.metadata.create_all(bind=engine)
	
	yield engine
	
	# Cleanup: Drop all tables after all tests complete
	Base.metadata.drop_all(bind=engine)
	engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine: Engine) -> Generator[Session, None, None]:
	"""
	Create a new database session for a test with automatic rollback.
	
	Each test gets a fresh session with a transaction that is rolled back
	after the test completes, ensuring test isolation.
	"""
	connection = test_engine.connect()
	transaction = connection.begin()
	
	SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connection)
	session = SessionLocal()
	
	yield session
	
	# Rollback and cleanup
	session.close()
	transaction.rollback()
	connection.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
	"""
	Create a test client with database session override.
	
	This ensures all API calls use the test database session.
	"""
	def override_get_db():
		yield db_session
	
	app.dependency_overrides[get_db_session] = override_get_db
	
	with TestClient(app) as test_client:
		yield test_client
	
	app.dependency_overrides.clear()


# ========== DATA FIXTURES ==========

@pytest.fixture
def sample_user(db_session: Session) -> User:
	"""Create and return a sample user in the database."""
	from backend.routes.user.user import _hash_password
	
	user = User(
		id=uuid4(),
		username=f"testuser_{uuid4().hex[:8]}",
		email=f"test_{uuid4().hex[:8]}@example.com",
		first_name="Test",
		last_name="User",
		hashed_password=_hash_password("TestPassword123!"),
	)
	db_session.add(user)
	db_session.commit()
	db_session.refresh(user)
	return user


@pytest.fixture
def sample_location(db_session: Session) -> Location:
	"""Create and return a sample location in the database."""
	from geoalchemy2.shape import from_shape
	from shapely.geometry import Point
	
	location = Location(
		id=uuid4(),
		name="Test Location",
		description="A test location for unit tests",
		position=from_shape(Point(-79.38, 43.65)),  # Toronto coordinates
	)
	db_session.add(location)
	db_session.commit()
	db_session.refresh(location)
	return location


@pytest.fixture
def sample_tag(db_session: Session) -> Tag:
	"""Create and return a sample tag in the database."""
	tag = Tag(
		id=uuid4(),
		name=f"test_tag_{uuid4().hex[:8]}",
	)
	db_session.add(tag)
	db_session.commit()
	db_session.refresh(tag)
	return tag


@pytest.fixture
def multiple_locations(db_session: Session) -> list[Location]:
	"""Create and return multiple locations for testing."""
	from geoalchemy2.shape import from_shape
	from shapely.geometry import Point
	
	locations = [
		Location(
			id=uuid4(),
			name=f"Location {i}",
			description=f"Test location {i}",
			position=from_shape(Point(-79.38 + i * 0.1, 43.65 + i * 0.1)),
		)
		for i in range(3)
	]
	
	for location in locations:
		db_session.add(location)
	
	db_session.commit()
	
	for location in locations:
		db_session.refresh(location)
	
	return locations
