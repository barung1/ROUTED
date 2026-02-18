"""
Seed script to populate tourist destinations and tags into the database.
"""

import json
import sys
from pathlib import Path
from geoalchemy2.elements import WKTElement

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config.db import get_db_session, engine, _load_models, _ensure_postgres_dependencies
from backend.loggers.logger import get_logger
from backend.models.Base import Base
from backend.models.location import Location
from backend.models.tag import Tag

logger = get_logger("seed_destinations", "seed_destinations.log")


def load_destinations_json():
    """Load the tourist destinations JSON file."""
    json_path = Path(__file__).parent.parent.parent.parent / "data" / "tourist_destinations.json"
    
    if not json_path.exists():
        logger.error("JSON file not found at %s", json_path)
        return None
    
    with open(json_path, 'r') as f:
        return json.load(f)


def seed_destinations():
    """Seed the database with tourist destinations and tags."""
    
    # Load models and ensure PostGIS is available
    _load_models()
    _ensure_postgres_dependencies()
    
    # Load JSON data
    data = load_destinations_json()
    if data is None:
        return
    
    # Get database session
    db = next(get_db_session())
    
    try:
        # First, seed all tags from the top-level tags section
        tags_data = data.get('tags', [])
        tags_map = {}  # Map of tag_name -> Tag object
        
        logger.info("Loading %s tags...", len(tags_data))
        for tag_data in tags_data:
            tag_name = tag_data['name']
            
            # Check if tag exists
            existing_tag = db.query(Tag).filter(Tag.name == tag_name).first()
            
            if existing_tag:
                tags_map[tag_name] = existing_tag
                logger.info("Tag '%s' already exists", tag_name)
            else:
                # Create new tag with full data from JSON
                new_tag = Tag(
                    name=tag_name,
                    description=tag_data.get('description'),
                    color=tag_data.get('color')
                )
                db.add(new_tag)
                db.flush()  # Flush to get the tag ID
                tags_map[tag_name] = new_tag
                # logger.info(
                #     "Created tag: %s - %s",
                #     tag_name,
                #     tag_data.get('description')
                # )
        
        # Commit tags first
        db.commit()
        logger.info("Tags seeded successfully.")
        
        # Now seed locations
        locations_data = data.get('locations', [])
        logger.info("Loading %s locations...", len(locations_data))
        
        for loc_data in locations_data:
            # Check if location already exists
            existing_location = db.query(Location).filter(
                Location.name == loc_data['name']
            ).first()
            
            if existing_location:
                logger.info("Location '%s' already exists, skipping...", loc_data['name'])
                continue
            
            # Get tags for this location from the pre-created tags_map
            tag_names = loc_data.get('tags', [])
            tags = [tags_map[tag_name] for tag_name in tag_names if tag_name in tags_map]
            
            # Create WKT POINT geometry from latitude and longitude
            # Format: POINT(longitude latitude) - note the order!
            position_wkt = f"POINT({loc_data['longitude']} {loc_data['latitude']})"
            position = WKTElement(position_wkt, srid=4326)
            
            # Create location
            location = Location(
                name=loc_data['name'],
                position=position,
                description=loc_data.get('description', ''),
                tags=tags
            )
            
            db.add(location)
            # logger.info(
            #     "Added location: %s with %s tags",
            #     loc_data['name'],
            #     len(tags)
            # )
        
        # Commit all changes
        db.commit()
        logger.info("Database seeded successfully.")
        
    except Exception as e:
        db.rollback()
        logger.exception("Error during seeding: %s", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_destinations()
