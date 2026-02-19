from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase
import os
from backend.config.env_vars import load_env_variables
from backend.loggers.logger import get_logger # type: ignore

loaded_env = load_env_variables()
logger = get_logger(__name__)

logger.info("Initializing Base model with schema: %s", os.getenv('DB_SCHEMA', 'Not set'))

class Base(DeclarativeBase):
	metadata = MetaData(schema=os.getenv('DB_SCHEMA', 'public'))