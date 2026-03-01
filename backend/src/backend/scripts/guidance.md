# Database Seeding Guide

## Prerequisites
- PostgreSQL 15 running in Docker on port 5433
- `.env` file configured with database credentials
- JSON seed files present in `backend/data/`:
  - `users.json`
  - `tourist_destinations.json`
  - `trips.json`
  - `matches.json` (optional)

---

## Quick Start

For **production/complete initialization**, use the master orchestrator:

```bash
python -m backend.scripts.reset_and_seed
```

For **development/quick testing**, use the dummy data script:

```bash
python -m backend.scripts.seed_dummy_trips
```

---

## All Scripts Overview

### 🎯 Production Seeding Scripts

#### `reset_and_seed.py` ⭐ (Master Orchestrator)
**Purpose**: Complete database reset and initialization with all production data.

**What it does:**
1. Drops all existing tables
2. Creates fresh tables based on current models
3. Orchestrates all seed scripts in correct order:
   - Seeds users from `backend/data/users.json`
   - Seeds locations/tags from `backend/data/tourist_destinations.json`
   - Seeds trips from `backend/data/trips.json`
   - Calculates all matches automatically for PLANNED trips

**How to run:**
```bash
python -m backend.scripts.reset_and_seed
# or
python backend/src/backend/scripts/reset_and_seed.py
```

**When to use:**
- Fresh database setup
- After major schema changes
- During development when you need clean production data

**Behavior**: Destructive - drops and recreates all data

---

#### `seed_users.py`
**Purpose**: Populate user accounts from JSON data.

**What it does:**
1. Reads from `backend/data/users.json`
2. Hashes plaintext passwords using PBKDF2-SHA256 (120k iterations)
3. Parses `date_of_birth` and `date_joined` fields (or uses server defaults)
4. Creates users if they don't already exist
5. Validates email format and prevents duplicate usernames

**How to run individually:**
```bash
python -m backend.scripts.seed_users
```

**JSON Structure Expected:**
```json
{
  "users": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "username": "alice_explorer",
      "email": "alice@example.com",
      "first_name": "Alice",
      "last_name": "Explorer",
      "password": "Alice@Routed2024!",
      "date_of_birth": "1990-05-15",
      "date_joined": "2026-01-05"
    }
  ]
}
```

**Behavior**: Non-destructive - skips duplicates by username

---

#### `seed_destinations.py`
**Purpose**: Populate tourist destinations and tags from JSON.

**What it does:**
1. Reads from `backend/data/tourist_destinations.json`
2. Creates all tags with full metadata (name, description, color)
3. Creates locations with PostGIS POINT geometry (WKTElement)
4. Links locations to tags via many-to-many relationship
5. Skips existing locations by name

**How to run individually:**
```bash
python -m backend.scripts.seed_destinations
```

**JSON Structure Expected:**
```json
{
  "tags": [
    {
      "name": "nature",
      "description": "Natural attractions",
      "color": "#00AA00"
    },
    {
      "name": "waterfall",
      "description": "Waterfalls and cascades",
      "color": "#0066FF"
    }
  ],
  "destinations": [
    {
      "name": "Niagara Falls",
      "latitude": 43.0896,
      "longitude": -79.0849,
      "description": "Famous waterfall straddling US-Canada border",
      "tags": ["nature", "waterfall", "scenic"]
    },
    {
      "name": "Paris",
      "latitude": 48.8566,
      "longitude": 2.3522,
      "description": "The City of Light in France",
      "tags": ["city", "landmark", "culture"]
    }
  ]
}
```

**Behavior**: Non-destructive - skips existing locations

---

#### `seed_trips.py`
**Purpose**: Populate trip records from JSON data.

### `seed_dummy_trips.py`
Populates the database with sample users and trips for Explore Trips page testing.

**What it does:**
1. Ensures sample users exist
2. Reads existing locations from the database
3. Creates sample trips with from/to place, mode of travel, budget, interests, and description
4. Refreshes seeded trips safely when re-run

**How to run:**
```bash
python -m backend.scripts.seed_dummy_trips
# or
python backend/src/backend/scripts/seed_dummy_trips.py
```

## Notes
- Tags must be defined in the JSON before locations reference them
- Locations link to tags by name
- All scripts skip existing records to prevent duplicates
