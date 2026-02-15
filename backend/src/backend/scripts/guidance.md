# Database Seeding Guide

## Scripts Overview

### `seed_destinations.py`
Populates the database with tourist destinations and tags from a JSON file.

**What it does:**
1. Reads from `backend/data/tourist_destinations.json`
2. Creates all tags with full data (name, description, color)
3. Creates locations and links them to tags
4. Skips existing records (safe to run multiple times)

**How to run:**
```bash
python -m backend.scripts.seed_destinations
# or
python backend/src/backend/scripts/seed_destinations.py
```

**JSON Structure Expected:**
```json
{
  "tags": [
    {
      "name": "nature",
      "description": "Natural attractions",
      "color": "#00AA00"
    }
  ],
  "locations": [
    {
      "name": "Niagara Falls",
      "latitude": 43.0896,
      "longitude": -79.0849,
      "description": "Famous waterfall...",
      "tags": ["nature", "waterfall", "scenic"]
    }
  ]
}
```
---

## Prerequisites
- PostgreSQL running
- `.env` file configured with database credentials
- `backend/data/tourist_destinations.json` file present

## Notes
- Tags must be defined in the JSON before locations reference them
- Locations link to tags by name
- All scripts skip existing records to prevent duplicates
