import subprocess
import sys
import uvicorn
from backend.loggers.logger import get_logger # type: ignore

logger = get_logger(__name__)

def dev():
	try:
		logger.info("Checking dependencies...")
		subprocess.run(
			["poetry", "install", "--no-interaction"],
			check=True,
			timeout=30
		)
		logger.info("Starting development server...")
	except KeyboardInterrupt:
		logger.info("Shutting down gracefully...")
		sys.exit(0)
	except subprocess.TimeoutExpired:
		logger.error("Dependency install timed out. Check your connection or run 'poetry install' manually.")
		sys.exit(1)
	except subprocess.CalledProcessError as e:
		logger.error(f"Failed to install dependencies: {e}")
		sys.exit(1)
	uvicorn.run(
			"backend.main:app",
			host="0.0.0.0",
			port=8000,
			reload=True,
		)

def deleteRowsAndRemakeTables():
	"""Drop and recreate all tables in the application schema only."""
	from backend.config.db import engine
	from backend.models.Base import Base
	
	try:
		logger.info("Dropping all tables in schema...")
		Base.metadata.drop_all(bind=engine)
		logger.info("Recreating all tables in schema...")
		Base.metadata.create_all(bind=engine)
		logger.info("Schema reset complete. Tables dropped and recreated successfully.")
		
		# Re-seed locations
		from backend.scripts.seed_destinations import seed_destinations
		seed_destinations()
		logger.info("Locations table seeded successfully after reset.")
		
	except Exception as e:
		logger.error(f"Error resetting schema: {e}")
		raise
