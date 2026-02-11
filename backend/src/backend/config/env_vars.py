import os,dotenv,pathlib
from venv import logger

from backend.loggers.logger import get_logger # type: ignore

logger = get_logger(__name__)

def load_env_variables() -> bool:
	env_file_path = os.path.join(pathlib.Path(__file__).parent.parent.parent.parent.parent, 'env', '.env')
	loaded_env = dotenv.load_dotenv(env_file_path)

	if not loaded_env:
		logger.warning(f"Could not load .env file from {env_file_path} when in context:{os.getcwd()}")
	else:
		logger.info(f".env file loaded successfully from {env_file_path}")
	return loaded_env
	