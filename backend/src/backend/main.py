from typing import Literal
from pydantic import BaseModel
from fastapi import FastAPI, status, Depends
from fastapi.openapi.utils import get_openapi
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.config.db import get_db_session, engine # type: ignore
from backend.loggers.logger import get_logger # type: ignore

logger = get_logger(__name__, "app.log")

logger.info("Initializing FastAPI application...")

app = FastAPI(
	title="Routed API",
	description="Routed backend API with comprehensive OpenAPI documentation",
	logger=logger
)

logger.info("FastAPI application created successfully")


@app.get(
	"/health",
	status_code=status.HTTP_200_OK,
	tags=["Health"],
	summary="Health Check",
	description="Check if the API and database are healthy and operational"
)
def health(db: Session = Depends(get_db_session)):
	try:
		db.execute(text("SELECT 1"))
		db_status = "connected"
	except Exception as e:
		logger.error(f"Database health check failed: {e}")
		db_status = "not connected"
	return {"status": "ok", "database": db_status}