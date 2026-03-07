"""
Tests for Knowledge Graph scoring and entity resolution.

Run with: pytest tests/test_graph_scoring.py -v

These tests do NOT require a live Neo4j connection — they use mocking
to verify that the scoring pipeline handles both connected and fallback modes.
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import date

from backend.services.match_service import MatchService
from backend.graph.entity_resolver import EntityResolver


# ---------------------------------------------------------------------------
# Entity Resolver Tests (no mocking needed — pure Python)
# ---------------------------------------------------------------------------

class TestEntityResolver:
    """Test NER-style interest entity linking."""

    def test_resolve_synonym_hiking(self):
        """'trekking' should resolve to canonical 'hiking'."""
        assert EntityResolver.resolve("trekking") == "hiking"

    def test_resolve_synonym_case_insensitive(self):
        """Resolution should be case-insensitive."""
        assert EntityResolver.resolve("Trekking") == "hiking"
        assert EntityResolver.resolve("TREKKING") == "hiking"

    def test_resolve_with_whitespace(self):
        """Extra whitespace should be stripped."""
        assert EntityResolver.resolve("  hiking  ") == "hiking"

    def test_resolve_unknown_interest(self):
        """Unknown interests should be returned normalized (not discarded)."""
        result = EntityResolver.resolve("paragliding")
        assert result == "paragliding"

    def test_resolve_diving_synonym(self):
        """'snorkeling' should resolve to 'diving'."""
        assert EntityResolver.resolve("snorkeling") == "diving"
        assert EntityResolver.resolve("snorkelling") == "diving"  # UK spelling

    def test_resolve_many_deduplicates(self):
        """resolve_many should deduplicate post-resolution."""
        result = EntityResolver.resolve_many(["hiking", "trekking", "backpacking"])
        assert result == ["hiking"]  # All three → "hiking", deduplicated

    def test_resolve_many_preserves_order(self):
        """resolve_many should preserve first-occurrence order."""
        result = EntityResolver.resolve_many(["food", "hiking", "culture"])
        assert result == ["food", "hiking", "culture"]

    def test_get_category_outdoor(self):
        """'hiking' should map to 'outdoor' category."""
        assert EntityResolver.get_category("hiking") == "outdoor"

    def test_get_category_food(self):
        """'food' should map to 'food' category."""
        assert EntityResolver.get_category("food") == "food"

    def test_get_category_unknown_falls_back(self):
        """Unknown interests should fall back to 'general' category."""
        assert EntityResolver.get_category("paragliding") == "general"

    def test_extract_and_link_full_pipeline(self):
        """Full entity extraction + linking pipeline."""
        result = EntityResolver.extract_and_link(["trekking", "Photography", "food tours"])
        assert len(result) == 3
        names = [r["interest"] for r in result]
        assert "hiking" in names       # trekking → hiking
        assert "photography" in names  # normalized
        assert "food" in names         # food tours → food
        # Verify categories are set
        for item in result:
            assert "category" in item
            assert item["category"] != ""


# ---------------------------------------------------------------------------
# Scoring Component Tests (pure math — no Neo4j needed)
# ---------------------------------------------------------------------------

class TestOverlapScore:
    """Test _calculate_overlap_score — pure date math."""

    def _make_trip(self, start, end, budget=None, interests=None):
        """Helper to create a minimal Trip-like object for scoring tests."""
        trip = MagicMock()
        trip.start_date = date(*start)
        trip.end_date = date(*end)
        trip.budget = budget
        trip.interests = interests or []
        trip.id = "test-id"
        return trip

    def test_full_overlap_scores_100(self):
        """When trip B fully contains trip A, score should be 100."""
        a = self._make_trip((2026, 5, 10), (2026, 5, 15))
        b = self._make_trip((2026, 5, 8), (2026, 5, 20))
        score = MatchService._calculate_overlap_score(a, b)
        assert score == 100.0

    def test_partial_overlap_scores_proportionally(self):
        """3 days overlap out of 6 day trip = 50%."""
        a = self._make_trip((2026, 5, 10), (2026, 5, 15))  # 6 days
        b = self._make_trip((2026, 5, 13), (2026, 5, 20))  # overlap: 13-15 = 3 days
        score = MatchService._calculate_overlap_score(a, b)
        assert score == pytest.approx(50.0, abs=1.0)


class TestBudgetScore:
    """Test _calculate_budget_score — pure math."""

    def _make_trip(self, budget):
        trip = MagicMock()
        trip.budget = budget
        trip.interests = []
        return trip

    def test_identical_budgets_score_100(self):
        a = self._make_trip(1000.0)
        b = self._make_trip(1000.0)
        assert MatchService._calculate_budget_score(a, b) == 100.0

    def test_no_budget_returns_neutral(self):
        a = self._make_trip(None)
        b = self._make_trip(1000.0)
        assert MatchService._calculate_budget_score(a, b) == 50.0

    def test_very_different_budgets_score_low(self):
        a = self._make_trip(100.0)
        b = self._make_trip(10000.0)
        score = MatchService._calculate_budget_score(a, b)
        assert score < 10.0


# ---------------------------------------------------------------------------
# Graph Interest Score Tests (mocked Neo4j)
# ---------------------------------------------------------------------------

class TestInterestScore:
    """Test _calculate_interest_score with mocked Neo4j."""

    def _make_trip(self, interests):
        trip = MagicMock()
        trip.interests = interests
        trip.id = "mock-trip-id"
        return trip

    def test_graph_score_used_when_available(self):
        """When Neo4j returns a score, it should be used."""
        a = self._make_trip(["hiking", "photography"])
        b = self._make_trip(["hiking", "nature"])
        with patch("backend.graph.knowledge_graph.compute_graph_score", return_value=80.0):
            score = MatchService._calculate_interest_score(a, b)
        assert score == 80.0

    def test_fallback_to_jaccard_when_neo4j_unavailable(self):
        """When Neo4j returns None, Jaccard on raw lists is used."""
        a = self._make_trip(["hiking", "food"])
        b = self._make_trip(["hiking", "culture"])
        with patch("backend.graph.knowledge_graph.compute_graph_score", return_value=None):
            score = MatchService._calculate_interest_score(a, b)
        # Jaccard: intersection={"hiking"} / union={"hiking","food","culture"} = 1/3 ≈ 33.3
        assert score == pytest.approx(33.3, abs=1.0)

    def test_fallback_when_graph_import_fails(self):
        """If graph module raises, Jaccard fallback is used."""
        a = self._make_trip(["hiking", "food"])
        b = self._make_trip(["hiking", "food"])
        with patch("backend.graph.knowledge_graph.compute_graph_score", side_effect=Exception("neo4j down")):
            score = MatchService._calculate_interest_score(a, b)
        # Both trips identical → Jaccard = 1.0 → 100.0
        assert score == 100.0

    def test_no_interests_returns_neutral(self):
        """When no interests are set, score should be neutral 50."""
        a = self._make_trip([])
        b = self._make_trip([])
        with patch("backend.graph.knowledge_graph.compute_graph_score", return_value=None):
            score = MatchService._calculate_interest_score(a, b)
        assert score == 50.0


# ---------------------------------------------------------------------------
# Full Composite Score Tests
# ---------------------------------------------------------------------------

class TestCompositeScore:
    """Test _calculate_match_score composite (overlap + interest + budget)."""

    def _make_trip(self, start, end, interests, budget=None):
        trip = MagicMock()
        trip.start_date = date(*start)
        trip.end_date = date(*end)
        trip.interests = interests
        trip.budget = budget
        trip.id = "mock-id"
        return trip

    def test_score_higher_with_shared_interests(self):
        """Trips with shared interests should score higher than trips without."""
        a = self._make_trip((2026, 5, 10), (2026, 5, 20), ["hiking", "nature"])
        b = self._make_trip((2026, 5, 10), (2026, 5, 20), ["hiking", "nature"])

        with patch("backend.graph.knowledge_graph.compute_graph_score", return_value=100.0):
            score_match = MatchService._calculate_match_score(a, b)

        c = self._make_trip((2026, 5, 10), (2026, 5, 20), ["nightlife", "shopping"])
        d = self._make_trip((2026, 5, 10), (2026, 5, 20), ["yoga", "wellness"])

        with patch("backend.graph.knowledge_graph.compute_graph_score", return_value=0.0):
            score_no_match = MatchService._calculate_match_score(c, d)

        assert score_match > score_no_match

    def test_score_is_clamped_between_0_and_100(self):
        """Score must always be within [0, 100]."""
        a = self._make_trip((2026, 5, 10), (2026, 5, 20), ["hiking"])
        b = self._make_trip((2026, 5, 10), (2026, 5, 20), ["hiking"])

        with patch("backend.graph.knowledge_graph.compute_graph_score", return_value=100.0):
            score = MatchService._calculate_match_score(a, b)

        assert 0.0 <= score <= 100.0
