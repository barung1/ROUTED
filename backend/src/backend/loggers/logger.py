# logging/logger.py
import logging
import os
from typing import Optional

LOG_DIR = "logs"

cLogger:Optional[logging.Logger] = None

def get_logger(name: str='app', log_file: str='app.log', level: int = logging.INFO) -> logging.Logger:
	
	global cLogger

	if cLogger is not None:
		return cLogger
	
	if not os.path.exists(LOG_DIR):
		os.makedirs(LOG_DIR)

	logger = logging.getLogger(name)
	logger.setLevel(level)
	logger.propagate = False

	if logger.handlers:
		return logger

	formatter = logging.Formatter(
		"%(asctime)s - %(name)s - %(levelname)s - %(message)s"
	)

	console_handler = logging.StreamHandler()
	file_handler = logging.FileHandler(os.path.join(LOG_DIR, log_file))

	console_handler.setFormatter(formatter)
	file_handler.setFormatter(formatter)

	logger.addHandler(console_handler)
	logger.addHandler(file_handler)

	return logger
