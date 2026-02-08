from logging import Logger
from typing import Generator
import sqlalchemy
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker, Session
import os
import pathlib
import dotenv
from backend.loggers.logger import get_logger # type: ignore
from backend.models.Base import Base

logger: Logger = get_logger(__name__) 

env_file_path = os.path.join(pathlib.Path(__file__).parent.parent.parent.parent.parent, 'env', '.env')
loaded_env = dotenv.load_dotenv(env_file_path)

if not loaded_env:
	logger.warning(f"Could not load .env file from {env_file_path} when in context:{os.getcwd()}")
else:
	logger.info(f".env file loaded successfully from {env_file_path}")

# Database URL from environment or construct from individual vars
DATABASE_URL = sqlalchemy.engine.URL.create(
	drivername="postgresql+psycopg",
	username=os.getenv('POSTGRES_USER', 'routed_user'),
	password=os.getenv('POSTGRES_PASSWORD', 'routed_password'),
	host=os.getenv('POSTGRES_HOST', '127.0.0.1'),
	port=int(os.getenv('POSTGRES_PORT', '5432')),
	database=os.getenv('POSTGRES_DB', 'routed')
)

# Create engine with connection pooling
engine = sqlalchemy.create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logger.info(f"Database engine created with URL: {DATABASE_URL}")


def _load_models() -> None:
	"""Import models so SQLAlchemy registers them with Base metadata."""
	from backend.models import location, tag, trip, user  # noqa: F401


def _ensure_postgres_dependencies() -> None:
	"""Ensure PostGIS is enabled for geography types."""
	with engine.connect() as connection:
		connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
		connection.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
		connection.commit()

def get_db_session() -> Generator[Session, None, None]:
	"""
		!Not recommended for frequent use without proper handling!
		!Better to use with engine.connect() as session for scoped sessions!
		Get database session for dependency injection in FastAPI endpoints.
	"""
	session = SessionLocal() 
	try:
		yield session
	except Exception as e:
		logger.error(f"Database session error: {e}")
		session.rollback()
		raise
	finally:
		session.close()

if os.getenv('RESET_DB_ON_STARTUP', 'False').lower() in ('true', '1', 'yes'):
	logger.warning("RESET_DB_ON_STARTUP is enabled. Dropping and recreating all tables!")
	_load_models()
	_ensure_postgres_dependencies()
	Base.metadata.drop_all(bind=engine)
	Base.metadata.create_all(bind=engine)
	logger.info("Database tables created successfully")