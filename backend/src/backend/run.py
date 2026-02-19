import subprocess
import sys
from venv import logger
import uvicorn
from backend.loggers.logger import get_logger # type: ignore

logger = get_logger(__name__)

def dev():
	try:
		logger.info("Checking dependencies...")
		subprocess.run(
			["poetry", "install", "--no-interaction", "--sync"],
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

if __name__ == "__main__":
    dev()
