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

**What it does:**
1. Reads from `backend/data/trips.json`
2. Matches `user_id` to existing user records
3. Matches `location_name` to existing locations
4. Creates trips with all travel details
5. Validates date ranges (end_date >= start_date)
6. Validates trip status using TripStatus enum
7. Converts travel mode strings to TravelMode enum
8. Skips invalid or duplicate entries

**How to run individually:**
```bash
python -m backend.scripts.seed_trips
```

**JSON Structure Expected:**
```json
{
  "trips": [
    {
      "user_id": "11111111-1111-1111-1111-111111111111",
      "location_name": "Niagara Falls",
      "start_date": "2026-05-10",
      "end_date": "2026-05-13",
      "status": "planned",
      "from_place": "Toronto, ON",
      "to_place": "Niagara Falls, ON",
      "mode_of_travel": "CAR",
      "budget": 2500.0,
      "interests": ["nature", "waterfall", "scenic"],
      "description": "Weekend trip to see the falls with family"
    }
  ]
}
```

**Supported Travel Modes:**
- `CAR`
- `FLIGHT`
- `TRAIN`
- `BUS`
- `BIKE`
- `WALK`

**Supported Trip Statuses:**
- `planned`
- `ongoing`
- `completed`
- `cancelled`

**Behavior**: Non-destructive - skips duplicates by description + dates + location

---

#### `seed_matches.py`
**Purpose**: Populate trip compatibility matches.

**What it does:**
1. Reads from `backend/data/matches.json`
2. Validates user pairs, trip pairs, and shared locations exist
3. Stores compatibility scores (range: 0-100)
4. Clamps out-of-range scores to [0.0, 100.0]
5. Prevents duplicate matches between same user pairs
6. Applies proper date range logic (match_start and match_end)

**How to run individually:**
```bash
python -m backend.scripts.seed_matches
```

**JSON Structure Expected:**
```json
{
  "matches": [
    {
      "user_a_id": "11111111-1111-1111-1111-111111111111",
      "user_b_id": "22222222-2222-2222-2222-222222222222",
      "trip_a_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "trip_b_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "location_name": "Niagara Falls",
      "score": 85.5,
      "match_start": "2026-05-10",
      "match_end": "2026-05-13"
    }
  ]
}
```

**Score Interpretation:**
- 0-30: Poor compatibility
- 31-60: Moderate compatibility
- 61-80: Good compatibility
- 81-100: Excellent compatibility

**Behavior**: Non-destructive - skips existing matches

---

#### `calculate_all_matches.py`
**Purpose**: Automatically calculate and create matches for all PLANNED trips based on matching rules.

**What it does:**
1. Queries all trips with status = 'PLANNED'
2. For each trip, calls MatchService to find compatible trips
3. Creates match records based on:
   - Same destination location
   - Overlapping travel dates
   - Different users (no self-matching)
4. Calculates match score (default: 50.0, range: 0-100)
5. Stores match_start and match_end as date overlap intersection
6. Commits all matches in a single transaction
7. Logs progress and total match count

**How to run individually:**
```bash
python -m backend.scripts.calculate_all_matches
```

**When to use:**
- Automatically called by `reset_and_seed.py` after seeding trips
- Can be run manually to recalculate all matches
- Useful after bulk trip imports or status changes

**Matching Rules:**
- ✅ Both trips must have status = 'PLANNED'
- ✅ Must be to the same destination location
- ✅ Must have overlapping date ranges (start1 <= end2 AND start2 <= end1)
- ✅ Must be different users (no self-matches)

**Example Match Creation:**
```
Trip A: User Alice to Paris (May 10-15)
Trip B: User Bob to Paris (May 12-18)
→ Match created with overlap dates: May 12-15
```

**Behavior**: Creates new matches based on current trip data, uses MatchService for extensible logic

**Dependencies:**
- Requires trips to be seeded first
- Uses MatchService from `backend/services/match_service.py`
- See `backend/services/MATCHING_EXTENSIBILITY.md` for customization

---

### 🧪 Development & Testing Scripts

#### `seed_dummy_trips.py`
**Purpose**: Quickly populate database with dummy users and sample trips for UI testing/demo (development only).

**What it does:**
1. Creates or reuses 5 hardcoded dummy users (anna_lee, ben_stone, chris_miller, diana_wong, ethan_kim)
2. Retrieves all existing locations from database
3. Creates 10 pre-defined sample trips
4. **REMOVES existing dummy trips** before seeding (destructive for dummy data only)
5. Supports all trip fields: from_place, to_place, mode_of_travel, budget, interests, description
6. Logs detailed statistics (users created, trips removed, trips created)

**How to run:**
```bash
python -m backend.scripts.seed_dummy_trips
# or
python backend/src/backend/scripts/seed_dummy_trips.py
```

**When to use:**
- 🧪 Local development and UI testing
- When you need sample trips quickly
- After running `reset_and_seed` to add demo data
- When you want to refresh test data (existing dummy trips will be replaced)

**Dummy Users Created:**
- anna_lee (password: DummyPass123!)
- ben_stone (password: DummyPass123!)
- chris_miller (password: DummyPass123!)
- diana_wong (password: DummyPass123!)
- ethan_kim (password: DummyPass123!)

**Sample Trips Include:**
- Niagara Falls (Waterloo → Niagara Falls, CAR)
- Banff National Park (Toronto → Banff, FLIGHT)
- New York City (Montreal → NYC, TRAIN)
- Whistler (Vancouver → Whistler, BUS)
- Lake Louise (Calgary → Lake Louise, CAR)
- Grand Canyon (Ottawa → Grand Canyon, FLIGHT)
- Yellowstone (Edmonton → Yellowstone, CAR)
- Times Square (Quebec City → NYC, TRAIN)
- Hoover Dam (Winnipeg → Hoover Dam, FLIGHT)
- Statue of Liberty (Halifax → NYC, SHIP)

**Behavior**: Semi-destructive for dummy data - removes previous dummy trips but preserves non-dummy user data

**Prerequisites for this script:**
- Locations must already exist (run `seed_destinations.py` first)
- Trip schema columns should exist (script auto-creates them if missing)

---

## Dependencies & Execution Order

### For Production (Complete Reset)
```
reset_and_seed.py (orchestrates all below)
├── seed_users.py
├── seed_destinations.py
├── seed_trips.py
└── calculate_all_matches.py (automatic match calculation)
```

### For Development (After reset_and_seed)
```
seed_dummy_trips.py (can run anytime, requires locations to exist)
```

---

## Important Notes

### Database Behavior
- **Production scripts** skip existing records by default (idempotent)
- **Dummy trips script** removes previous dummy trips but preserves real user data
- Tags must be defined before locations reference them
- Trips require existing users and locations
- Matches require existing users, trips, and locations

### Error Handling
- Invalid records are logged with warnings but don't halt execution
- Date parsing failures are handled gracefully (with fallbacks or skipping)
- Foreign key violations cause record to be skipped with warning
- Out-of-range match scores are automatically clamped to valid range

### Data Validation
- **User**: Username uniqueness, email format, password hashing
- **Location**: Coordinate range validation (-90 to 90 latitude, -180 to 180 longitude), WKTElement POINT creation
- **Trip**: Date range validation (end_date >= start_date), status enum validation, mode enum validation
- **Match**: Score clamping to [0, 100], user/trip/location existence verification

---

## Troubleshooting

### "No users found" warning
```bash
python -m backend.scripts.seed_users
```

### "No locations found" warning
```bash
python -m backend.scripts.seed_destinations
```

### "Invalid coordinates" or PostGIS errors
- Ensure latitude is in range [-90, 90]
- Ensure longitude is in range [-180, 180]
- Verify PostgreSQL has PostGIS extension enabled

### Duplicate key errors
- Normal and safe to ignore for production scripts (will skip)
- For dummy_trips, previous dummy trips will be deleted automatically
- To force fresh data: `python -m backend.scripts.reset_and_seed`

### "Cannot find module" errors
- Ensure you're running from the project root or backend directory
- Use full module path: `python -m backend.scripts.<script_name>`
- Check that Python path is correctly set

### Connection errors to PostgreSQL
- Verify Docker container is running: `docker ps`
- Check `.env` file has correct DATABASE_URL
- Verify database credentials and port (default: 5433)

---

## Usage Workflows

### Workflow 1: Complete Fresh Setup
```bash
# Start with completely clean database
python -m backend.scripts.reset_and_seed
```

### Workflow 2: Development with Dummy Data
```bash
# Complete reset with production data
python -m backend.scripts.reset_and_seed

# Add dummy users and sample trips for UI testing
python -m backend.scripts.seed_dummy_trips
```

### Workflow 3: Add Only New Data
```bash
# Add only new production users (skip if exist)
python -m backend.scripts.seed_users

# Add only new locations (skip if exist)
python -m backend.scripts.seed_destinations

# Add only new trips (skip if exist)
python -m backend.scripts.seed_trips

# Add only new matches (skip if exist)
python -m backend.scripts.seed_matches
```

### Workflow 4: Refresh Test Data
```bash
# Keep existing data but refresh dummy trips
python -m backend.scripts.seed_dummy_trips
```

---

## File Locations

All scripts: `backend/src/backend/scripts/`
- `reset_and_seed.py`
- `seed_users.py`
- `seed_destinations.py`
- `seed_trips.py`
- `seed_matches.py`
- `calculate_all_matches.py`
- `seed_dummy_trips.py`

All data files: `backend/data/`
- `users.json`
- `tourist_destinations.json`
- `trips.json`
- `matches.json`

Log files: `backend/scripts/logs/`
- One log file per script (auto-created)
