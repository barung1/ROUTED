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
	from backend.models import location, tag, trip, user, match, interest  # noqa: F401


def _ensure_postgres_dependencies() -> None:
	"""Ensure schema and PostGIS extension are available."""
	db_schema = os.getenv('DB_SCHEMA', 'routed')
	with engine.connect() as connection:
		# Create schema if it doesn't exist
		connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {db_schema}"))
		connection.commit()
	with engine.connect() as connection:
		# Create extensions in public schema (globally available)
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

if missing_tables:
	Base.metadata.create_all(bind=engine)
	logger.info(
		"Database tables created on startup: %s",
		", ".join(sorted(missing_tables)),
	)
else:
	logger.info("Database tables already existed on startup")


def _ensure_trip_columns() -> None:
	"""Add new trip columns for backward compatibility on existing databases."""
	db_schema = os.getenv('DB_SCHEMA', 'routed')
	inspector_local = sqlalchemy.inspect(engine)
	if "trips" not in inspector_local.get_table_names(schema=db_schema):
		return

	trip_columns = {column["name"] for column in inspector_local.get_columns("trips", schema=db_schema)}
	missing_columns = []

	with engine.connect() as connection:
		connection.execute(
			text(
				"""
				DO $$
				BEGIN
					IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_mode') THEN
						CREATE TYPE travel_mode AS ENUM (
							'flight', 'train', 'bus', 'car', 'ship', 'bicycle', 'walking', 'other'
						);
					END IF;
				END
				$$;
				"""
			)
		)

		if "from_place" not in trip_columns:
			connection.execute(text(f"ALTER TABLE {db_schema}.trips ADD COLUMN IF NOT EXISTS from_place VARCHAR"))
			missing_columns.append("from_place")
		if "to_place" not in trip_columns:
			connection.execute(text(f"ALTER TABLE {db_schema}.trips ADD COLUMN IF NOT EXISTS to_place VARCHAR"))
			missing_columns.append("to_place")
		if "mode_of_travel" not in trip_columns:
			connection.execute(text(f"ALTER TABLE {db_schema}.trips ADD COLUMN IF NOT EXISTS mode_of_travel travel_mode"))
			missing_columns.append("mode_of_travel")
		if "budget" not in trip_columns:
			connection.execute(text(f"ALTER TABLE {db_schema}.trips ADD COLUMN IF NOT EXISTS budget DOUBLE PRECISION"))
			missing_columns.append("budget")
		if "interests" not in trip_columns:
			connection.execute(
				text(f"ALTER TABLE {db_schema}.trips ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb")
			)
			missing_columns.append("interests")
		if "description" not in trip_columns:
			connection.execute(text(f"ALTER TABLE {db_schema}.trips ADD COLUMN IF NOT EXISTS description VARCHAR"))
			missing_columns.append("description")
		if "user_name" not in trip_columns:
			connection.execute(text(f"ALTER TABLE {db_schema}.trips ADD COLUMN IF NOT EXISTS user_name VARCHAR"))
			missing_columns.append("user_name")
		for col in ("from_lat", "from_lng", "to_lat", "to_lng"):
			if col not in trip_columns:
				connection.execute(text(f"ALTER TABLE {db_schema}.trips ADD COLUMN IF NOT EXISTS {col} DOUBLE PRECISION"))
				missing_columns.append(col)

		connection.execute(
			text(
				f"""
				UPDATE {db_schema}.trips t
				SET user_name = u.username
				FROM {db_schema}.user_trips ut
				JOIN {db_schema}.users u ON u.id = ut.user_id
				WHERE ut.trip_id = t.id
				  AND (t.user_name IS NULL OR t.user_name = '');
				"""
			)
		)

		connection.commit()

	if missing_columns:
		logger.info("Added missing trips columns on startup: %s", ", ".join(missing_columns))


_ensure_trip_columns()


def _ensure_user_profile_columns() -> None:
	"""Add user profile columns for backward compatibility on existing databases."""
	db_schema = os.getenv('DB_SCHEMA', 'routed')
	inspector_local = sqlalchemy.inspect(engine)
	if "users" not in inspector_local.get_table_names(schema=db_schema):
		return

	user_columns = {column["name"] for column in inspector_local.get_columns("users", schema=db_schema)}
	missing_columns = []

	with engine.connect() as connection:
		if "location" not in user_columns:
			connection.execute(text(f"ALTER TABLE {db_schema}.users ADD COLUMN IF NOT EXISTS location VARCHAR"))
			missing_columns.append("location")
		if "interests" not in user_columns:
			connection.execute(
				text(f"ALTER TABLE {db_schema}.users ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb")
			)
			missing_columns.append("interests")
		if "bio" not in user_columns:
			connection.execute(text(f"ALTER TABLE {db_schema}.users ADD COLUMN IF NOT EXISTS bio VARCHAR"))
			missing_columns.append("bio")
		if "profile_picture" not in user_columns:
			connection.execute(text(f"ALTER TABLE {db_schema}.users ADD COLUMN IF NOT EXISTS profile_picture TEXT"))
			missing_columns.append("profile_picture")

		connection.commit()

	if missing_columns:
		logger.info("Added missing users columns on startup: %s", ", ".join(missing_columns))


_ensure_user_profile_columns()

# Check if database is empty and needs initial seeding
database_needs_seeding = False
try:
	with engine.connect() as connection:
		from backend.models.location import Location
		from backend.models.user import User
		from sqlalchemy import select, func
		
		# Check if users table is empty
		users_stmt = select(func.count(User.id))
		users_result = connection.execute(users_stmt)
		users_count = users_result.scalar()
		
		# Check if locations table is empty
		locations_stmt = select(func.count(Location.id))
		locations_result = connection.execute(locations_stmt)
		locations_count = locations_result.scalar()
		
		# If both critical tables are empty, database needs seeding
		if (not users_count or users_count == 0) and (not locations_count or locations_count == 0):
			database_needs_seeding = True
			logger.info("Database appears to be empty. Will run initial seeding...")
except Exception as e:
	logger.error(f"Failed to check database population status: {e}")

if database_needs_seeding:
	logger.info("Running initial database seeding...")
	try:
		# Import and run seed_database function from reset_and_seed
		from backend.scripts.seed_users import seed_users
		from backend.scripts.seed_destinations import seed_destinations
		from backend.scripts.seed_trips import seed_trips
		
		logger.info("Seeding users...")
		seed_users()
		
		logger.info("Seeding locations and tags...")
		seed_destinations()
		
		logger.info("Seeding trips...")
		seed_trips()
		
		logger.info("Initial database seeding completed successfully!")
	except Exception as e:
		logger.error(f"Failed to seed database: {e}")
		logger.warning("You may need to run 'python -m backend.scripts.reset_and_seed' manually")


if os.getenv('RESET_DB_ON_STARTUP', 'False').lower() in ('true', '1', 'yes'):
	logger.warning("RESET_DB_ON_STARTUP is enabled. Dropping and recreating all tables!")
	Base.metadata.drop_all(bind=engine)
	Base.metadata.create_all(bind=engine)
	logger.info("Database tables created successfully")
	try:
		from backend.scripts.seed_destinations import seed_destinations
		seed_destinations()
		logger.info("Locations table seeded successfully after reset")
	except Exception as e:
		logger.error(f"Failed to seed locations after reset: {e}")
	# seed_destinations()
