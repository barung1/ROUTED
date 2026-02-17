from venv import logger
from backend.api_models.location import LocationPublicModel
import backend.config.db as db 
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.models.location import Location
from backend.loggers.logger import get_logger # type: ignore

logger = get_logger(__name__)

router = APIRouter()

@router.get("/{location_id}", response_model=LocationPublicModel, status_code=status.HTTP_200_OK)
def getLocationById(location_id: int, db: Session=Depends(db.get_db_session)):
	location = db.query(Location).filter(Location.id == location_id).first()
	if not location:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Location not found",
		)
	return LocationPublicModel(
		id=location.id,
		name=location.name,
		description=location.description,
		latitude=location.position.y,
		longitude=location.position.x,
		tags=[tag.id for tag in location.tags]
	)


