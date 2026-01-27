from typing import Literal
from backend.config.db import get_db # type: ignore
from backend.loggers.logger import get_logger # type: ignore
from fastapi import FastAPI

db = get_db()

logger = get_logger(__name__, "app.log")

logger.info("Initializing FastAPI application...")

app = FastAPI(title="FastAPI Backend",logger=logger)

logger.info("FastAPI application created successfully")

@app.get("/health")
def health():
	db_status = "connected" if db and not db.closed else "not connected"
	return {"status": "ok", "database": db_status}
