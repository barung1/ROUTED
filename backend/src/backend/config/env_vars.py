import os
import pathlib
from dotenv import load_dotenv

from backend.loggers.logger import get_logger # type: ignore

logger = get_logger(__name__)

env_file_path = os.path.join(pathlib.Path(__file__).parent.parent.parent.parent.parent, 'env', '.env')

loaded_env:bool = False

def load_env_variables() -> bool:
	global loaded_env
	if loaded_env:
		return loaded_env
	logger.info(f"Attempting to load environment variables from {env_file_path}")
	loaded_env = load_dotenv(env_file_path)
	if not loaded_env:
		logger.warning(f"Could not load .env file from {env_file_path} when in context:{os.getcwd()}")
	else:
		logger.info(f".env file loaded successfully from {env_file_path}")
	return loaded_env
	