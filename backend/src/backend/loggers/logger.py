# logging/logger.py
import logging
import os
import re
from typing import Any, IO

LOG_DIR = "logs"

cLogger: logging.Logger|None = None


class ColorFormatter(logging.Formatter):
	RESET = "\x1b[0m"
	COLORS = {
		logging.DEBUG: "\x1b[36m",
		logging.INFO: "\x1b[32m",
		logging.WARNING: "\x1b[33m",
		logging.ERROR: "\x1b[31m",
		logging.CRITICAL: "\x1b[31;1m",
	}

	def format(self, record: logging.LogRecord) -> str:
		message = super().format(record)
		color = self.COLORS.get(record.levelno, "")
		reset = self.RESET if color else ""
		return f"{color}{message}{reset}"

def _supports_color(stream: IO[Any]) -> bool:
	if os.environ.get("NO_COLOR"):
		return False
	return hasattr(stream, "isatty") and stream.isatty()

def get_logger(name: str = "app", log_file: str = "app.log", level: int = logging.INFO) -> logging.Logger:
	
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
		"%(levelname)s - %(asctime)s - %(name)s - %(message)s"
	)

	console_handler = logging.StreamHandler()
	file_handler = logging.FileHandler(os.path.join(LOG_DIR, log_file))

	if _supports_color(console_handler.stream):
		color_formatter = ColorFormatter(
			"%(levelname)s - %(asctime)s - %(name)s - %(message)s"
		)
		console_handler.setFormatter(color_formatter)
	else:
		console_handler.setFormatter(formatter)
	file_handler.setFormatter(formatter)

	logger.addHandler(console_handler)
	logger.addHandler(file_handler)
	return logger
