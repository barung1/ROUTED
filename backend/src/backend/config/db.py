from logging import Logger
from typing import Optional
import psycopg
import os
from backend.loggers.logger import get_logger # type: ignore

logger: Logger = get_logger(__name__)

db: Optional[psycopg.Connection] = None

def get_db() -> psycopg.Connection:
	global db
	if db is None:
		try:
			# Use DATABASE_URL or build connection from individual variables
			database_url = os.getenv("DATABASE_URL")
			if database_url:
				db = psycopg.connect(database_url)
			else:
				db = psycopg.connect(
					host=os.getenv("POSTGRES_HOST", "postgres"),
					port=int(os.getenv("POSTGRES_PORT", "5432")),
					dbname=os.getenv("POSTGRES_DB", "routed_db"),
					user=os.getenv("POSTGRES_USER", "routed_user"),
					password=os.getenv("POSTGRES_PASSWORD", "routed_password")
				)
			logger.info("Database connection established.")
		except Exception as e:
			logger.error(f"Error connecting to the database: {e}")
			raise e
	return db