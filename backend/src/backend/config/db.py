from logging import Logger
from typing import Generator
from backend.config.env_vars import load_env_variables
import sqlalchemy
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker, Session
import os
from backend.loggers.logger import get_logger # type: ignore
from backend.models.Base import Base

logger: Logger = get_logger(__name__) 

loaded_env = load_env_variables()

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


# Ensure models are registered for relationships (even when not resetting DB).
_load_models()
_ensure_postgres_dependencies()

# Ensure tables exist in all environments and log status.
inspector = sqlalchemy.inspect(engine)
expected_tables = set(Base.metadata.tables.keys())
existing_tables = set(inspector.get_table_names())
missing_tables = expected_tables - existing_tables
Base.metadata.create_all(bind=engine)

if missing_tables:
	logger.info(
		"Database tables created on startup: %s",
		", ".join(sorted(missing_tables)),
	)
else:
	logger.info("Database tables already existed on startup")

if os.getenv('RESET_DB_ON_STARTUP', 'False').lower() in ('true', '1', 'yes'):
	logger.warning("RESET_DB_ON_STARTUP is enabled. Dropping and recreating all tables!")
	Base.metadata.drop_all(bind=engine)
	Base.metadata.create_all(bind=engine)
	logger.info("Database tables created successfully")
