from backend.loggers.logger import get_logger # type: ignore
from fastapi import FastAPI

logger = get_logger(__name__, "app.log")

logger.info("Initializing FastAPI application...")

app = FastAPI(title="FastAPI Backend")

logger.info("✅ FastAPI application created successfully")

@app.get("/health")
def health():
    return {"status": "ok"}
