"""
Seed script to populate tourist destinations and tags into the database.
"""

import json
import sys
from pathlib import Path
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config.db import get_db_session, SessionLocal, engine, _load_models, _ensure_postgres_dependencies
from backend.models.Base import Base
from backend.models.location import Location
from backend.models.tag import Tag


def load_destinations_json():
    """Load the tourist destinations JSON file."""
    json_path = Path(__file__).parent.parent.parent.parent / "data" / "tourist_destinations.json"
    
    if not json_path.exists():
        print(f"Error: JSON file not found at {json_path}")
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
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Get database session
    db = SessionLocal()
    
    try:
        # First, seed all tags from the top-level tags section
        tags_data = data.get('tags', [])
        tags_map = {}  # Map of tag_name -> Tag object
        
        print(f"Loading {len(tags_data)} tags...")
        for tag_data in tags_data:
            tag_name = tag_data['name']
            
            # Check if tag exists
            existing_tag = db.query(Tag).filter(Tag.name == tag_name).first()
            
            if existing_tag:
                tags_map[tag_name] = existing_tag
                print(f"  ✓ Tag '{tag_name}' already exists")
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
                print(f"  + Created tag: {tag_name} - {tag_data.get('description')}")
        
        # Commit tags first
        db.commit()
        print(f"✓ Tags seeded successfully!\n")
        
        # Now seed locations
        locations_data = data.get('locations', [])
        print(f"Loading {len(locations_data)} locations...")
        
        for loc_data in locations_data:
            # Check if location already exists
            existing_location = db.query(Location).filter(
                Location.name == loc_data['name']
            ).first()
            
            if existing_location:
                print(f"  ✓ Location '{loc_data['name']}' already exists, skipping...")
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
            print(f"  + Added location: {loc_data['name']} with {len(tags)} tags")
        
        # Commit all changes
        db.commit()
        print("\n✓ Database seeded successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error during seeding: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_destinations()
