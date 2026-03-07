"""
Entity Resolver — Interest Normalization and NER-style Entity Linking.

Demonstrates NLP / named entity recognition skills from the Qorsa JD:
  - Normalizes raw interest strings to canonical form
  - Applies synonym expansion (e.g. "trekking" → "hiking")
  - Maps canonical interests to a semantic category hierarchy
    (outdoor / cultural / food / adventure / wellness / social)

This ensures that two users who list "trekking" and "hiking" respectively
are correctly linked through the same (:Interest {name:"hiking"}) node
in the knowledge graph — a fundamental entity resolution step.

In a production AtlasAI-style system this would be replaced with:
  - A fine-tuned NER model for domain-specific entity extraction
  - A knowledge base lookup (Wikidata / domain ontology) for linking
  - Embedding-based fuzzy matching for OOV terms
"""

from __future__ import annotations


# ---------------------------------------------------------------------------
# Synonym Map — entity linking / alias resolution
# Maps raw strings → canonical Interest node names
# ---------------------------------------------------------------------------

SYNONYM_MAP: dict[str, str] = {
    # Outdoor / Nature
    "trekking": "hiking",
    "backpacking": "hiking",
    "trails": "hiking",
    "mountaineering": "hiking",
    "hill walking": "hiking",
    "rock climbing": "climbing",
    "bouldering": "climbing",
    "scuba": "diving",
    "snorkeling": "diving",
    "snorkelling": "diving",
    "surfboarding": "surfing",
    "kayaking": "water sports",
    "canoeing": "water sports",
    "rafting": "water sports",
    "cycling": "cycling",
    "biking": "cycling",
    "mountain biking": "cycling",

    # Culture / History
    "sightseeing": "culture",
    "museums": "culture",
    "art galleries": "culture",
    "galleries": "culture",
    "heritage": "history",
    "historical sites": "history",
    "archaeology": "history",
    "architecture": "architecture",
    "churches": "architecture",
    "temples": "architecture",

    # Food
    "food tours": "food",
    "culinary": "food",
    "wine tasting": "food",
    "street food": "food",
    "cooking classes": "food",
    "gastronomy": "food",
    "local cuisine": "food",

    # Adventure
    "extreme sports": "adventure",
    "skydiving": "adventure",
    "bungee jumping": "adventure",
    "zip lining": "adventure",
    "safari": "wildlife",
    "wildlife watching": "wildlife",
    "bird watching": "wildlife",
    "birdwatching": "wildlife",

    # Wellness
    "spa": "wellness",
    "yoga retreat": "wellness",
    "meditation": "wellness",
    "mindfulness": "wellness",

    # Social / Entertainment
    "nightlife": "nightlife",
    "clubbing": "nightlife",
    "live music": "music",
    "concerts": "music",
    "festivals": "festivals",
    "local festivals": "festivals",
    "theatre": "arts",
    "theater": "arts",

    # Photography
    "photography": "photography",
    "photo tours": "photography",

    # Sports
    "football": "sports",
    "soccer": "sports",
    "basketball": "sports",
    "tennis": "sports",
    "golf": "sports",
}


# ---------------------------------------------------------------------------
# Category Hierarchy — semantic taxonomy (knowledge representation)
# Maps canonical Interest → InterestCategory
# ---------------------------------------------------------------------------

INTEREST_CATEGORIES: dict[str, str] = {
    # Outdoor
    "hiking": "outdoor",
    "camping": "outdoor",
    "climbing": "outdoor",
    "diving": "outdoor",
    "surfing": "outdoor",
    "water sports": "outdoor",
    "cycling": "outdoor",
    "skiing": "outdoor",
    "snowboarding": "outdoor",
    "nature": "outdoor",
    "beaches": "outdoor",

    # Cultural
    "culture": "cultural",
    "history": "cultural",
    "architecture": "cultural",
    "museums": "cultural",
    "art": "cultural",
    "arts": "cultural",
    "literature": "cultural",

    # Food
    "food": "food",
    "coffee": "food",
    "restaurants": "food",

    # Adventure
    "adventure": "adventure",
    "wildlife": "adventure",

    # Wellness
    "wellness": "wellness",
    "yoga": "wellness",
    "fitness": "wellness",

    # Social
    "nightlife": "social",
    "music": "social",
    "festivals": "social",
    "shopping": "social",
    "markets": "social",

    # Photography
    "photography": "creative",
    "videography": "creative",

    # Sports
    "sports": "sports",
}


class EntityResolver:
    """
    Resolves raw interest strings to canonical entity names and categories.

    This mirrors the entity extraction and linking pipeline described in
    the Qorsa job description — converting unstructured text tags into
    structured knowledge graph nodes.
    """

    @staticmethod
    def resolve(raw: str) -> str:
        """
        Resolve a raw interest string to its canonical form.

        Steps:
          1. Normalize: lowercase + strip whitespace
          2. Check synonym map for exact match (entity linking)
          3. Return canonical form (or normalized original if unknown)

        Example:
          "Trekking" → "hiking"
          "Photography" → "photography"
          "unknown_tag" → "unknown_tag"
        """
        normalized = raw.strip().lower()
        return SYNONYM_MAP.get(normalized, normalized)

    @staticmethod
    def resolve_many(raw_interests: list[str]) -> list[str]:
        """
        Resolve and deduplicate a list of raw interests.
        Preserves order while removing post-resolution duplicates.
        """
        seen: set[str] = set()
        result: list[str] = []
        for raw in raw_interests:
            canonical = EntityResolver.resolve(raw)
            if canonical not in seen:
                seen.add(canonical)
                result.append(canonical)
        return result

    @staticmethod
    def get_category(canonical_interest: str) -> str:
        """
        Return the InterestCategory for a canonical interest name.
        Falls back to 'general' if not in the taxonomy.

        Example:
          "hiking" → "outdoor"
          "food"   → "food"
          "novel"  → "general"
        """
        return INTEREST_CATEGORIES.get(canonical_interest, "general")

    @staticmethod
    def extract_and_link(raw_interests: list[str]) -> list[dict[str, str]]:
        """
        Full entity extraction + linking pipeline.
        Returns list of dicts with 'interest' and 'category' keys —
        structured for direct Neo4j MERGE operations.

        This is the function that would be replaced by an NER model
        in a production AtlasAI pipeline.
        """
        resolved = EntityResolver.resolve_many(raw_interests)
        return [
            {
                "interest": name,
                "category": EntityResolver.get_category(name),
            }
            for name in resolved
        ]
