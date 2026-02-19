from logging import Logger
import select
from typing import Generator
from backend.config.env_vars import load_env_variables
from backend.models.location import Location
import sqlalchemy
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker, Session
import os
from backend.loggers.logger import get_logger # type: ignore
from backend.models.Base import Base

logger: Logger = get_logger(__name__) 

loaded_env = load_env_variables()

if not loaded_env:
	logger.warning("Environment variables may not have loaded correctly. Check .env file and load_env_variables function.")
else:
	logger.debug("Environment variables loaded successfully.\nhost: %s",os.getenv('POSTGRES_HOST', 'Not set'))
# Database URL from environment or construct from individual vars
DATABASE_URL = sqlalchemy.engine.URL.create(
	drivername="postgresql+psycopg",
	username=os.getenv('POSTGRES_USER', 'routed_user'),
	password=os.getenv('POSTGRES_PASSWORD', 'routed_password'),
	host=os.getenv('POSTGRES_HOST', '127.0.0.1'),
	port=int(os.getenv('POSTGRES_PORT', '5432')),
	database=os.getenv('POSTGRES_DB', 'postgres'),
)
logger.info(f"Database engine created with URL: {DATABASE_URL}")

# Create engine with connection pooling
engine = sqlalchemy.create_engine(DATABASE_URL, pool_pre_ping=True,
		connect_args={"options": f"-csearch_path=public,{os.getenv('DB_SCHEMA', 'routed')}"})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)



def _load_models() -> None:
	"""Import models so SQLAlchemy registers them with Base metadata."""
	from backend.models import location, tag, trip, user  # noqa: F401


def _ensure_postgres_dependencies() -> None:
	"""Ensure PostGIS is enabled for geography types."""
	try:
		with engine.connect() as connection:
			connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
			connection.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
			connection.commit()
	except Exception as e:
		logger.warning(f"Could not connect to database to set up extensions: {e}. Skipping. Tables will not auto-create until DB is available.")

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
try:
	with engine.connect() as connection:
		from backend.models.location import Location
		import sqlalchemy
		from sqlalchemy import select, func
		stmt = select(func.count(Location.id))
		result = connection.execute(stmt)
		count = result.scalar()
		if count and count > 0:
			locations_populated = True
except Exception as e:
	logger.error(f"Failed to check locations population: {e}")

if not locations_populated:
	from backend.scripts.seed_destinations import seed_destinations
	try:
		seed_destinations()
		logger.info("Locations table seeded successfully")
	except Exception as e:
		logger.error(f"Failed to seed locations: {e}")

if os.getenv('RESET_DB_ON_STARTUP', 'False').lower() in ('true', '1', 'yes'):
	logger.warning("RESET_DB_ON_STARTUP is enabled. Dropping and recreating all tables!")
	Base.metadata.drop_all(bind=engine)
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
except Exception as e:
	logger.warning(f"Could not initialize database tables on startup: {e}. Tables will be created when database becomes available.")
