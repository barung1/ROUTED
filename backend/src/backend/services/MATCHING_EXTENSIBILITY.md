# Match Service - Extensibility Guide

## 📖 Overview

The `MatchService` provides a flexible framework for matching trips based on customizable criteria. This guide explains how to extend the matching logic without modifying the core trip routes.

---

## 🎯 Current Matching Rules

### Basic Criteria
1. **Same Destination** - Trips must be to the same location
2. **Time Overlap** - Trip dates must overlap (even by 1 day)
3. **Different Users** - Users can't match with themselves
4. **PLANNED Status** - Only trips in PLANNED status are matched

### Current Score
- **Default Score**: 50.0 (basic match)
- **Range**: 0.0 (poor) to 100.0 (perfect)

---

## 🔧 How to Extend Matching Rules

### 1. Add New Matching Criteria

Edit `_should_match()` in `match_service.py`:

```python
@staticmethod
def _should_match(trip_a: Trip, trip_b: Trip) -> bool:
    # Existing rules...
    
    # NEW: Add interest compatibility check
    if not _interests_compatible(trip_a, trip_b):
        return False
    
    # NEW: Add budget range check
    if not _budget_compatible(trip_a, trip_b):
        return False
    
    return True
```

### 2. Implement Helper Functions

```python
@staticmethod
def _interests_compatible(trip_a: Trip, trip_b: Trip) -> bool:
    """Check if trips have at least 2 common interests."""
    interests_a = set(trip_a.interests or [])
    interests_b = set(trip_b.interests or [])
    common_interests = interests_a & interests_b
    return len(common_interests) >= 2

@staticmethod
def _budget_compatible(trip_a: Trip, trip_b: Trip) -> bool:
    """Check if budgets are within 50% of each other."""
    if not trip_a.budget or not trip_b.budget:
        return True  # Allow if no budget specified
    
    max_budget = max(trip_a.budget, trip_b.budget)
    min_budget = min(trip_a.budget, trip_b.budget)
    ratio = min_budget / max_budget
    return ratio >= 0.5  # Within 50%
```

---

## 📊 How to Customize Scoring

### 1. Simple Weighted Score

Edit `_calculate_match_score()`:

```python
@staticmethod
def _calculate_match_score(trip_a: Trip, trip_b: Trip) -> float:
    """Calculate weighted compatibility score."""
    
    # Component scores (0-100 each)
    overlap_score = _calculate_overlap_score(trip_a, trip_b)
    interest_score = _calculate_interest_score(trip_a, trip_b)
    budget_score = _calculate_budget_score(trip_a, trip_b)
    
    # Weighted average
    total_score = (
        overlap_score * 0.30 +    # 30% weight
        interest_score * 0.50 +   # 50% weight
        budget_score * 0.20       # 20% weight
    )
    
    return min(max(total_score, 0.0), 100.0)  # Clamp to 0-100
```

### 2. Scoring Component Examples

```python
@staticmethod
def _calculate_overlap_score(trip_a: Trip, trip_b: Trip) -> float:
    """Score based on percentage of time overlap."""
    match_start, match_end = MatchService._get_overlap_dates(trip_a, trip_b)
    overlap_days = (match_end - match_start).days + 1
    
    trip_a_days = (trip_a.end_date - trip_a.start_date).days + 1
    overlap_ratio = overlap_days / trip_a_days
    
    return overlap_ratio * 100.0

@staticmethod
def _calculate_interest_score(trip_a: Trip, trip_b: Trip) -> float:
    """Score based on Jaccard similarity of interests."""
    interests_a = set(trip_a.interests or [])
    interests_b = set(trip_b.interests or [])
    
    if not interests_a or not interests_b:
        return 50.0  # Neutral score if no interests
    
    intersection = len(interests_a & interests_b)
    union = len(interests_a | interests_b)
    jaccard = intersection / union if union > 0 else 0
    
    return jaccard * 100.0

@staticmethod
def _calculate_budget_score(trip_a: Trip, trip_b: Trip) -> float:
    """Score based on budget similarity."""
    if not trip_a.budget or not trip_b.budget:
        return 50.0  # Neutral score if no budget
    
    budget_diff = abs(trip_a.budget - trip_b.budget)
    max_budget = max(trip_a.budget, trip_b.budget)
    similarity = 1 - (budget_diff / max_budget)
    
    return similarity * 100.0
```

---

## 🏗️ Advanced: Strategy Pattern

For completely different matching algorithms:

```python
from abc import ABC, abstractmethod

class MatchStrategy(ABC):
    @abstractmethod
    def should_match(self, trip_a: Trip, trip_b: Trip) -> bool:
        """Determine if two trips should match."""
        pass
    
    @abstractmethod
    def calculate_score(self, trip_a: Trip, trip_b: Trip) -> float:
        """Calculate compatibility score."""
        pass

class AdventureMatchStrategy(MatchStrategy):
    """Matches based on adventure level and outdoor activities."""
    
    def should_match(self, trip_a: Trip, trip_b: Trip) -> bool:
        # Check for adventure-related interests
        adventure_tags = {'hiking', 'camping', 'climbing', 'adventure'}
        interests_a = set(trip_a.interests or [])
        interests_b = set(trip_b.interests or [])
        
        return bool(interests_a & adventure_tags) and bool(interests_b & adventure_tags)
    
    def calculate_score(self, trip_a: Trip, trip_b: Trip) -> float:
        # Custom scoring for adventure trips
        pass

class BudgetMatchStrategy(MatchStrategy):
    """Matches primarily on budget compatibility."""
    
    def should_match(self, trip_a: Trip, trip_b: Trip) -> bool:
        if not trip_a.budget or not trip_b.budget:
            return False
        
        # Only match if budgets within 30%
        ratio = min(trip_a.budget, trip_b.budget) / max(trip_a.budget, trip_b.budget)
        return ratio >= 0.7
    
    def calculate_score(self, trip_a: Trip, trip_b: Trip) -> float:
        # Score heavily weighted on budget similarity
        pass

# Usage in MatchService:
class MatchService:
    _strategy: MatchStrategy = None  # Default strategy
    
    @classmethod
    def set_strategy(cls, strategy: MatchStrategy):
        cls._strategy = strategy
    
    @staticmethod
    def _should_match(trip_a: Trip, trip_b: Trip) -> bool:
        if MatchService._strategy:
            return MatchService._strategy.should_match(trip_a, trip_b)
        # Fallback to default logic
        return MatchService._default_should_match(trip_a, trip_b)
```

---

## 🧪 Testing Extensions

### Unit Test Example

```python
# tests/test_match_service.py
from datetime import date
from backend.services.match_service import MatchService
from backend.models.trip import Trip, TripStatus

def test_interest_scoring():
    trip_a = Trip(
        interests=['hiking', 'photography', 'nature'],
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 10),
        status=TripStatus.PLANNED
    )
    
    trip_b = Trip(
        interests=['hiking', 'nature', 'camping'],
        start_date=date(2026, 5, 5),
        end_date=date(2026, 5, 15),
        status=TripStatus.PLANNED
    )
    
    score = MatchService._calculate_interest_score(trip_a, trip_b)
    assert score > 50.0  # Should have good match (2/4 common = 50% Jaccard)
```

---

## 📋 Quick Reference

### Files to Edit
- `backend/services/match_service.py` - All matching logic
- `backend/routes/trip/trip.py` - Only if adding new API endpoints

### Key Methods
- `_is_matchable()` - Trip eligibility
- `_find_potential_matches()` - Pre-filtering candidates
- `_should_match()` - Matching criteria
- `_calculate_match_score()` - Scoring algorithm
- `_has_time_overlap()` - Time overlap check

### When Matches Are Calculated
1. **After trip creation** - Automatic
2. **After trip update** - Automatic (if PLANNED)
3. **Status change from PLANNED** - Deletes existing matches

---

## 🎨 Real-World Extension Examples

### 1. Location Radius Matching
Match trips to nearby locations (within 100km):

```python
from geopy.distance import geodesic

@staticmethod
def _find_potential_matches(trip: Trip, db: Session) -> List[Trip]:
    all_trips = db.execute(
        select(Trip)
        .where(Trip.status == TripStatus.PLANNED, Trip.id != trip.id)
        .options(selectinload(Trip.user), selectinload(Trip.location))
    ).scalars().all()
    
    nearby_trips = []
    for other_trip in all_trips:
        distance = _calculate_distance(trip.location, other_trip.location)
        if distance <= 100:  # 100km radius
            nearby_trips.append(other_trip)
    
    return nearby_trips
```

### 2. Language Preference
Add language matching based on user profiles.

### 3. Travel Style
Match based on travel pace (fast-paced, relaxed, luxury, budget).

### 4. Group Size Preference
Match solo travelers, couples, families, etc.

---

## ⚠️ Best Practices

1. **Keep Rules Simple** - Complex rules slow matching
2. **Test Thoroughly** - Write unit tests for new rules
3. **Document Changes** - Update this guide when extending
4. **Performance** - Consider query optimization for large datasets
5. **Backwards Compatible** - Ensure old matches still work

---

## 🚀 Future Ideas

- **ML-Based Scoring** - Use machine learning for personalized matching
- **Collaborative Filtering** - "Users like you also matched with..."
- **Time Zone Compatibility** - Consider user time zones
- **Social Network Integration** - Prefer friends or friends-of-friends
- **Historical Success** - Learn from past successful matches
