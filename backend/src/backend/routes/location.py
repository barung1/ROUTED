from uuid import UUID
from backend.api_models.location import LocationPublicModel
import backend.config.db as db 
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from backend.models.location import Location
from geoalchemy2.functions import ST_X, ST_Y
from geoalchemy2.shape import to_shape
from backend.loggers.logger import get_logger # type: ignore

logger = get_logger(__name__)

router = APIRouter()

@router.get("/", response_model=list[LocationPublicModel], status_code=status.HTTP_200_OK)
def getLocations(db: Session=Depends(db.get_db_session)):
	stmt = select(Location)
	rows = db.execute(stmt).scalars().all()
	return [
    LocationPublicModel(
        id=loc.id,
        name=loc.name,
        description=loc.description,
        latitude=to_shape(loc.position).y, #type: ignore
        longitude=to_shape(loc.position).x, #type: ignore
        tags=[tag.id for tag in loc.tags],
    )
    for loc in rows
]

@router.get("/{location_id}", response_model=LocationPublicModel, status_code=status.HTTP_200_OK)
def getLocationById(location_id: UUID, db: Session=Depends(db.get_db_session)):
	stmt = select(Location).filter(Location.id == location_id)
	row = db.execute(stmt).scalars().first()
	location = row
	if location==None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Location not found",
		)	
	return LocationPublicModel(
		id=location.id,
		name=location.name,
		description=location.description,
		latitude=to_shape(location.position).y, #type: ignore
		longitude=to_shape(location.position).x, #type: ignore
		tags=[tag.id for tag in location.tags],
	)


