"""Test configuration and fixtures."""
import sys
from pathlib import Path

# Ensure the backend module can be imported
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Import all models to register them with Base.metadata
from backend.models.Base import Base
from backend.models.user import User  # noqa: F401
from backend.models.tag import Tag  # noqa: F401
from backend.models.location import Location  # noqa: F401
from backend.models.trip import Trip  # noqa: F401
from backend.models.associations import *  # noqa: F401, F403


def get_table_name(table_key: str) -> str:
    """Get the full table name including schema prefix if present."""
    for key in Base.metadata.tables.keys():
        # Handle both schema-qualified names (e.g., "routed.users") and bare names
        if key.endswith(f".{table_key}") or key == table_key:
            return key
    raise KeyError(f"Table '{table_key}' not found in metadata")
