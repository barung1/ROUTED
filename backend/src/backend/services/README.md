# Services Module

This module contains business logic services that are decoupled from API routes.

## 📁 Structure

```
services/
├── __init__.py
├── match_service.py           # Trip matching and compatibility scoring
├── MATCHING_EXTENSIBILITY.md  # Guide for extending matching rules
└── README.md                  # This file
```

## 🎯 Services Available

### MatchService (`match_service.py`)

**Purpose**: Calculate and manage trip matches based on destination, time overlap, and compatibility.

**Key Features**:
- Automatic matching when trips are created/updated
- Extensible rule system for matching criteria
- Flexible scoring framework (0-100 scale)
- Clean separation from routing logic

**Usage Example**:
```python
from backend.services.match_service import MatchService

# Calculate matches for a trip
matches_count = MatchService.calculate_matches_for_trip(trip, db)

# Delete all matches for a trip
deleted_count = MatchService.delete_matches_for_trip(trip_id, db)
```

**Extending**: See [MATCHING_EXTENSIBILITY.md](./MATCHING_EXTENSIBILITY.md) for detailed guide on:
- Adding new matching rules
- Customizing scoring algorithms
- Implementing advanced strategies
- Testing extensions

## 🏗️ Design Philosophy

### Separation of Concerns
- **Routes** (`backend/routes/*`) - Handle HTTP requests/responses, validation, auth
- **Services** (`backend/services/*`) - Contain business logic
- **Models** (`backend/models/*`) - Define database schema

### Benefits
- ✅ **Testability** - Services can be unit tested independently
- ✅ **Reusability** - Business logic can be called from multiple places
- ✅ **Maintainability** - Changes to logic don't affect routing
- ✅ **Extensibility** - Easy to add new features without touching routes

## 📝 Adding New Services

When creating a new service:

1. Create a new file in `services/` (e.g., `user_service.py`)
2. Keep services stateless (use static methods or functions)
3. Accept database session as parameter
4. Document extensibility points
5. Write unit tests in `tests/services/`

Example service structure:
```python
# backend/services/example_service.py
from sqlalchemy.orm import Session
from backend.models.example import Example

class ExampleService:
    """Service for handling Example business logic."""
    
    @staticmethod
    def process_example(example_id: UUID, db: Session) -> bool:
        """Process an example with custom business rules."""
        # Implementation here
        pass
    
    @staticmethod
    def _internal_helper(data) -> any:
        """Internal helper method (prefix with _)."""
        pass
```

## 🧪 Testing Services

Services should have comprehensive unit tests:

```python
# tests/services/test_match_service.py
from backend.services.match_service import MatchService

def test_calculate_matches(db_session):
    # Setup test data
    trip = create_test_trip()
    
    # Test service
    matches_count = MatchService.calculate_matches_for_trip(trip, db_session)
    
    # Assert results
    assert matches_count > 0
```

## 📚 Related Documentation

- [Match Service Extensibility Guide](./MATCHING_EXTENSIBILITY.md)
- [API Routes Documentation](../routes/README.md)
- [Database Models](../models/README.md)
