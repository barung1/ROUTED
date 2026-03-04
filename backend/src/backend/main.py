from typing import Literal
from backend.auth.jwt import get_current_user_id
from pydantic import BaseModel
from fastapi import FastAPI, status, Depends
from fastapi.openapi.utils import get_openapi
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.config.db import get_db_session, engine # type: ignore
from backend.loggers.logger import get_logger # type: ignore
from backend.routes.user.user import router as user_router
from backend.routes.trip.trip import router as trip_router
from backend.routes.match.match import router as match_router
from fastapi.middleware.cors import CORSMiddleware

logger = get_logger(__name__, "app.log")

logger.info("Initializing FastAPI application...")

app = FastAPI(
	title="Routed API",
	description="Routed backend API with comprehensive OpenAPI documentation",
	logger=logger
)

logger.info("FastAPI application created successfully")

# Allow Vite dev server to access the API during development
origins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
]

app.add_middleware(
	CORSMiddleware,
	allow_origins=origins,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(user_router, prefix="/users", tags=["Users"])
app.include_router(trip_router, prefix="/trips", tags=["Trips"])
app.include_router(match_router, prefix="/matches", tags=["Matches"], dependencies=[Depends(get_current_user_id)])

@app.get(
	"/health",
	status_code=status.HTTP_200_OK,
	tags=["Health"],
	summary="Health Check",
	description="Check if the API and database are healthy and operational"
)
def health(db: Session = Depends(get_db_session)):
	try:
		db.execute(text("SELECT 2"))
		db_status = "connected"
	except Exception as e:
		logger.error(f"Database health check failed: {e}")
		db_status = "not connected"
	return {"status": "ok", "database": db_status}