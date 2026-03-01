"""Seed script to populate dummy users and trips for the Explore Trips page."""

from datetime import date
from sqlalchemy import select
from sqlalchemy import text

from backend.config.db import _ensure_postgres_dependencies, _load_models, get_db_session
from backend.loggers.logger import get_logger
from backend.models.location import Location
from backend.models.trip import TravelMode, Trip, TripStatus
from backend.models.user import User
from backend.routes.user.user import _hash_password

logger = get_logger("seed_dummy_trips", "seed_dummy_trips.log")


DUMMY_USERS = [
    {
        "username": "anna_lee",
        "email": "anna.lee@example.com",
        "first_name": "Anna",
        "last_name": "Lee",
    },
    {
        "username": "ben_stone",
        "email": "ben.stone@example.com",
        "first_name": "Ben",
        "last_name": "Stone",
    },
    {
        "username": "chris_miller",
        "email": "chris.miller@example.com",
        "first_name": "Chris",
        "last_name": "Miller",
    },
    {
        "username": "diana_wong",
        "email": "diana.wong@example.com",
        "first_name": "Diana",
        "last_name": "Wong",
    },
    {
        "username": "ethan_kim",
        "email": "ethan.kim@example.com",
        "first_name": "Ethan",
        "last_name": "Kim",
    },
]


SEED_USERNAMES = {user["username"] for user in DUMMY_USERS}


DUMMY_TRIPS = [
    {
        "start_date": date(2026, 3, 2),
        "end_date": date(2026, 3, 6),
        "status": TripStatus.PLANNED,
        "from_place": "Waterloo",
        "to_place": "Niagara Falls",
        "mode_of_travel": TravelMode.CAR,
        "budget": 320.0,
        "interests": ["nature", "photography"],
        "description": "Weekend falls trip.",
    },
    {
        "start_date": date(2026, 3, 10),
        "end_date": date(2026, 3, 14),
        "status": TripStatus.PLANNED,
        "from_place": "Toronto",
        "to_place": "Banff",
        "mode_of_travel": TravelMode.FLIGHT,
        "budget": 1400.0,
        "interests": ["hiking", "mountains"],
        "description": "Mountain hiking getaway.",
    },
    {
        "start_date": date(2026, 3, 20),
        "end_date": date(2026, 3, 21),
        "status": TripStatus.PLANNED,
        "from_place": "Montreal",
        "to_place": "New York",
        "mode_of_travel": TravelMode.TRAIN,
        "budget": 450.0,
        "interests": ["food", "city"],
        "description": "Quick city break.",
    },
    {
        "start_date": date(2026, 4, 3),
        "end_date": date(2026, 4, 9),
        "status": TripStatus.PLANNED,
        "from_place": "Vancouver",
        "to_place": "Whistler",
        "mode_of_travel": TravelMode.BUS,
        "budget": 780.0,
        "interests": ["skiing", "adventure"],
        "description": "Spring mountain escape.",
    },
    {
        "start_date": date(2026, 4, 15),
        "end_date": date(2026, 4, 18),
        "status": TripStatus.COMPLETED,
        "from_place": "Calgary",
        "to_place": "Lake Louise",
        "mode_of_travel": TravelMode.CAR,
        "budget": 620.0,
        "interests": ["lakes", "scenic"],
        "description": "Lakeside scenic drive.",
    },
    {
        "start_date": date(2026, 4, 25),
        "end_date": date(2026, 4, 27),
        "status": TripStatus.CANCELLED,
        "from_place": "Ottawa",
        "to_place": "Grand Canyon",
        "mode_of_travel": TravelMode.FLIGHT,
        "budget": 980.0,
        "interests": ["geology", "hiking"],
        "description": "Desert canyon plan.",
    },
    {
        "start_date": date(2026, 5, 4),
        "end_date": date(2026, 5, 8),
        "status": TripStatus.PLANNED,
        "from_place": "Edmonton",
        "to_place": "Yellowstone",
        "mode_of_travel": TravelMode.CAR,
        "budget": 860.0,
        "interests": ["wildlife", "camping"],
        "description": "National park wildlife tour.",
    },
    {
        "start_date": date(2026, 5, 12),
        "end_date": date(2026, 5, 16),
        "status": TripStatus.PLANNED,
        "from_place": "Quebec City",
        "to_place": "Times Square",
        "mode_of_travel": TravelMode.TRAIN,
        "budget": 730.0,
        "interests": ["nightlife", "shopping"],
        "description": "City lights and shopping trip.",
    },
    {
        "start_date": date(2026, 5, 21),
        "end_date": date(2026, 5, 24),
        "status": TripStatus.COMPLETED,
        "from_place": "Winnipeg",
        "to_place": "Hoover Dam",
        "mode_of_travel": TravelMode.FLIGHT,
        "budget": 1120.0,
        "interests": ["engineering", "history"],
        "description": "Engineering and history weekend.",
    },
    {
        "start_date": date(2026, 6, 2),
        "end_date": date(2026, 6, 6),
        "status": TripStatus.PLANNED,
        "from_place": "Halifax",
        "to_place": "Statue of Liberty",
        "mode_of_travel": TravelMode.SHIP,
        "budget": 990.0,
        "interests": ["monument", "heritage"],
        "description": "Heritage cruise and monument visit.",
    },
]


def _get_or_create_dummy_users(db) -> list[User]:
    users: list[User] = []

    for user_data in DUMMY_USERS:
        existing_user = db.execute(
            select(User).where(User.username == user_data["username"])
        ).scalars().first()

        if existing_user:
            users.append(existing_user)
            continue

        new_user = User(
            username=user_data["username"],
            email=user_data["email"],
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            hashed_password=_hash_password("DummyPass123!"),
        )
        db.add(new_user)
        db.flush()
        users.append(new_user)

    return users


def _seed_dummy_trips(db, users: list[User], locations: list[Location]) -> int:
    if not users or not locations:
        return 0

    created_count = 0

    for index, trip_template in enumerate(DUMMY_TRIPS):
        target_user = users[index % len(users)]
        target_location = locations[index % len(locations)]

        existing_trip = db.execute(
            select(Trip).where(
                Trip.description == trip_template["description"],
                Trip.start_date == trip_template["start_date"],
                Trip.end_date == trip_template["end_date"],
                Trip.location_id == target_location.id,
            )
        ).scalars().first()

        if existing_trip:
            continue

        trip = Trip(
            start_date=trip_template["start_date"],
            end_date=trip_template["end_date"],
            status=trip_template["status"],
            from_place=trip_template["from_place"],
            to_place=trip_template["to_place"],
            mode_of_travel=trip_template["mode_of_travel"],
            budget=trip_template["budget"],
            interests=trip_template["interests"],
            description=trip_template["description"],
            location_id=target_location.id,
        )
        trip.user = target_user
        db.add(trip)
        created_count += 1

    return created_count


def _ensure_trip_schema_compatibility(db) -> None:
    """Ensure trips table has columns required by the current seed/model shape."""
    db.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_mode') THEN
                    CREATE TYPE travel_mode AS ENUM (
                        'flight', 'train', 'bus', 'car', 'ship', 'bicycle', 'walking', 'other'
                    );
                END IF;
            END
            $$;
            """
        )
    )

    db.execute(text("ALTER TABLE routed.trips ADD COLUMN IF NOT EXISTS from_place VARCHAR"))
    db.execute(text("ALTER TABLE routed.trips ADD COLUMN IF NOT EXISTS to_place VARCHAR"))
    db.execute(text("ALTER TABLE routed.trips ADD COLUMN IF NOT EXISTS mode_of_travel travel_mode"))
    db.execute(text("ALTER TABLE routed.trips ADD COLUMN IF NOT EXISTS budget DOUBLE PRECISION"))
    db.execute(text("ALTER TABLE routed.trips ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb"))
    db.execute(text("ALTER TABLE routed.trips ADD COLUMN IF NOT EXISTS description VARCHAR"))
    db.flush()


def _remove_existing_seed_trips(db) -> int:
    seed_trips = (
        db.execute(select(Trip).join(Trip.user).where(User.username.in_(SEED_USERNAMES)))
        .scalars()
        .all()
    )
    removed_count = len(seed_trips)
    for trip in seed_trips:
        db.delete(trip)
    db.flush()
    return removed_count


def seed_dummy_trips() -> None:
    """Create dummy users and trips for UI testing/demo."""
    _load_models()
    _ensure_postgres_dependencies()

    db = next(get_db_session())

    try:
        _ensure_trip_schema_compatibility(db)
        locations = db.execute(select(Location)).scalars().all()
        if not locations:
            logger.warning("No locations found. Seed locations first, then run this script again.")
            return

        users = _get_or_create_dummy_users(db)
        removed_trips = _remove_existing_seed_trips(db)
        created_trips = _seed_dummy_trips(db, users, locations)

        db.commit()
        logger.info(
            "Dummy trip seeding complete. Users available: %s, trips removed: %s, trips created: %s",
            len(users),
            removed_trips,
            created_trips,
        )
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to seed dummy trips: %s", exc)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_dummy_trips()
