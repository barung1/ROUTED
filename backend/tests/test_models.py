from sqlalchemy import UniqueConstraint
from geoalchemy2 import Geography

from backend.models.Base import Base
from backend.models.user import User  # noqa: F401
from backend.models.tag import Tag  # noqa: F401
from backend.models.location import Location  # noqa: F401
from backend.models.trip import Trip  # noqa: F401
from backend.models.associations import *  # noqa: F401, F403
from tests.conftest import get_table_name


def test_users_table_columns():
	table = Base.metadata.tables[get_table_name("users")]
	assert {"id", "username", "email", "first_name", "last_name", "hashed_password"}.issubset(
		set(table.c.keys())
	)
	assert table.c.username.nullable is False
	assert table.c.username.unique is True
	assert table.c.email.nullable is False
	assert table.c.email.unique is True
	assert table.c.hashed_password.nullable is False


def test_tags_table_columns():
	table = Base.metadata.tables[get_table_name("tags")]
	assert {"id", "name", "description", "color"}.issubset(set(table.c.keys()))
	assert table.c.name.nullable is False


def test_locations_table_columns():
	table = Base.metadata.tables[get_table_name("locations")]
	assert {"id", "name", "position", "description"}.issubset(set(table.c.keys()))
	assert table.c.name.nullable is False
	assert table.c.position.nullable is False
	assert isinstance(table.c.position.type, Geography)
	assert table.c.position.type.geometry_type == "POINT"
	assert table.c.position.type.srid == 4326


def test_trips_table_columns():
	table = Base.metadata.tables[get_table_name("trips")]
	assert {"id", "start_date", "end_date", "status", "location_id"}.issubset(
		set(table.c.keys())
	)
	assert table.c.start_date.nullable is False
	assert table.c.end_date.nullable is False
	assert table.c.status.nullable is False
	assert table.c.location_id.nullable is False
	assert any(fk.column.table.name == "locations" and fk.column.name == "id" for fk in table.c.location_id.foreign_keys)


def test_association_tables():
	location_tags = Base.metadata.tables[get_table_name("location_tags")]
	assert {"location_id", "tag_id"}.issubset(set(location_tags.c.keys()))
	assert location_tags.c.location_id.primary_key is True
	assert location_tags.c.tag_id.primary_key is True

	user_trips = Base.metadata.tables[get_table_name("user_trips")]
	assert {"user_id", "trip_id"}.issubset(set(user_trips.c.keys()))
	constraint = next(
		c for c in user_trips.constraints
		if isinstance(c, UniqueConstraint) and c.name == "uq_user_trips_trip_id"
	)
	assert "trip_id" in {col.name for col in constraint.columns}
