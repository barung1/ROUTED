"""
Knowledge Graph — Core Cypher Operations for Routed.

Manages the Neo4j graph schema and provides query functions for:
  - Syncing PostgreSQL entities (Users, Trips, Locations) as graph nodes
  - Computing semantic match scores via shared Interest traversal
  - Bootstrapping indexes and constraints on startup
  - Generating match explanations for the /graph/explain endpoint

Graph Schema:
  (:User  {id})
  (:Trip  {id, start_date, end_date, budget})
  (:Location {id, name})
  (:Interest {name})                        ← canonical, resolved via entity_resolver
  (:InterestCategory {name})               ← outdoor / cultural / food / adventure / etc.

  (:User)-[:CREATED]->(:Trip)
  (:User)-[:LIKES]->(:Interest)
  (:Trip)-[:HAS_INTEREST]->(:Interest)
  (:Trip)-[:TO_LOCATION]->(:Location)
  (:Location)-[:HAS_ACTIVITY]->(:Interest)
  (:Interest)-[:IS_A]->(:InterestCategory) ← semantic hierarchy (entity_resolver)
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from backend.graph.graph_client import get_graph_driver
from backend.graph.entity_resolver import EntityResolver

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

def bootstrap_graph() -> None:
    """
    Create Neo4j indexes, constraints, and seed any missing data on startup.
    Called once from main.py @app.on_event("startup").
    Safe to call multiple times (idempotent).
    """
    driver = get_graph_driver()
    if driver is None:
        return

    constraints = [
        "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
        "CREATE CONSTRAINT trip_id IF NOT EXISTS FOR (t:Trip) REQUIRE t.id IS UNIQUE",
        "CREATE CONSTRAINT location_id IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE",
        "CREATE CONSTRAINT interest_name IF NOT EXISTS FOR (i:Interest) REQUIRE i.name IS UNIQUE",
        "CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:InterestCategory) REQUIRE c.name IS UNIQUE",
    ]
    with driver.session() as session:
        for c in constraints:
            session.run(c)

    from backend.loggers.logger import get_logger
    get_logger(__name__).info("[KnowledgeGraph] Bootstrap complete — constraints and indexes ready.")


# ---------------------------------------------------------------------------
# Node sync — called when entities are created/updated in Postgres
# ---------------------------------------------------------------------------

def sync_user(user_id: str | UUID, interests: list[str]) -> None:
    """
    Upsert a :User node and connect it to :Interest nodes via [:LIKES].
    Interests are resolved to canonical form before writing.
    """
    driver = get_graph_driver()
    if driver is None:
        return

    canonical = [EntityResolver.resolve(i) for i in (interests or [])]

    with driver.session() as session:
        session.run(
            """
            MERGE (u:User {id: $uid})
            WITH u
            OPTIONAL MATCH (u)-[r:LIKES]->()
            DELETE r
            """,
            uid=str(user_id),
        )
        for interest in canonical:
            category = EntityResolver.get_category(interest)
            session.run(
                """
                MERGE (i:Interest {name: $name})
                MERGE (c:InterestCategory {name: $cat})
                MERGE (i)-[:IS_A]->(c)
                MERGE (u:User {id: $uid})
                MERGE (u)-[:LIKES]->(i)
                """,
                name=interest,
                cat=category,
                uid=str(user_id),
            )


def sync_trip(
    trip_id: str | UUID,
    user_id: str | UUID,
    location_id: str | UUID,
    interests: list[str],
) -> None:
    """
    Upsert a :Trip node and connect it to:
      - :User via [:CREATED]
      - :Location via [:TO_LOCATION]
      - :Interest nodes via [:HAS_INTEREST]

    Interests are entity-resolved to canonical form.
    """
    driver = get_graph_driver()
    if driver is None:
        return

    canonical = [EntityResolver.resolve(i) for i in (interests or [])]

    with driver.session() as session:
        # Upsert trip + relationships to User and Location
        session.run(
            """
            MERGE (t:Trip {id: $tid})
            MERGE (u:User {id: $uid})
            MERGE (l:Location {id: $lid})
            MERGE (u)-[:CREATED]->(t)
            MERGE (t)-[:TO_LOCATION]->(l)
            WITH t
            OPTIONAL MATCH (t)-[r:HAS_INTEREST]->()
            DELETE r
            """,
            tid=str(trip_id),
            uid=str(user_id),
            lid=str(location_id),
        )
        for interest in canonical:
            category = EntityResolver.get_category(interest)
            session.run(
                """
                MERGE (i:Interest {name: $name})
                MERGE (c:InterestCategory {name: $cat})
                MERGE (i)-[:IS_A]->(c)
                MERGE (t:Trip {id: $tid})
                MERGE (t)-[:HAS_INTEREST]->(i)
                """,
                name=interest,
                cat=category,
                tid=str(trip_id),
            )


def sync_location(location_id: str | UUID, name: str, tags: list[str]) -> None:
    """
    Upsert a :Location node and connect it to :Interest (activity) nodes
    via [:HAS_ACTIVITY]. Tags from the Location model are used as activities.
    """
    driver = get_graph_driver()
    if driver is None:
        return

    canonical_tags = [EntityResolver.resolve(t) for t in (tags or [])]

    with driver.session() as session:
        session.run(
            "MERGE (l:Location {id: $lid}) SET l.name = $name",
            lid=str(location_id),
            name=name,
        )
        for tag in canonical_tags:
            session.run(
                """
                MERGE (i:Interest {name: $name})
                MERGE (l:Location {id: $lid})
                MERGE (l)-[:HAS_ACTIVITY]->(i)
                """,
                name=tag,
                lid=str(location_id),
            )


def delete_trip_node(trip_id: str | UUID) -> None:
    """Remove a :Trip node and all its relationships from the graph."""
    driver = get_graph_driver()
    if driver is None:
        return

    with driver.session() as session:
        session.run(
            "MATCH (t:Trip {id: $tid}) DETACH DELETE t",
            tid=str(trip_id),
        )


# ---------------------------------------------------------------------------
# Scoring — called from match_service._calculate_match_score()
# ---------------------------------------------------------------------------

def compute_graph_score(trip_a_id: str | UUID, trip_b_id: str | UUID) -> Optional[float]:
    """
    Compute a 0-100 semantic compatibility score between two trips using
    shared Interest node traversal in Neo4j.

    Algorithm:
      1. Count shared :Interest nodes between the two trips ([:HAS_INTEREST])
      2. Also count shared category paths ([:HAS_INTEREST]->[:IS_A]->[:InterestCategory])
      3. Normalize to 0-100

    Returns None if Neo4j is unavailable (caller falls back to Jaccard).

    Cypher reasoning:
      Two trips that both [:HAS_INTEREST]->(:Interest {name:"hiking"}) share a
      graph path. The count of such shared paths is the intersection; we
      normalize by the union to get a Jaccard-like similarity on the graph.
    """
    driver = get_graph_driver()
    if driver is None:
        return None

    tid_a = str(trip_a_id)
    tid_b = str(trip_b_id)

    with driver.session() as session:
        # Path 1: shared Interest nodes
        result = session.run(
            """
            MATCH (a:Trip {id: $id_a})-[:HAS_INTEREST]->(i:Interest)
            MATCH (b:Trip {id: $id_b})-[:HAS_INTEREST]->(i)
            RETURN count(DISTINCT i) AS shared_interests
            """,
            id_a=tid_a,
            id_b=tid_b,
        )
        shared = result.single()["shared_interests"]

        # Path 2: union of all interests for normalization
        result2 = session.run(
            """
            MATCH (t:Trip)-[:HAS_INTEREST]->(i:Interest)
            WHERE t.id IN [$id_a, $id_b]
            RETURN count(DISTINCT i) AS total_interests
            """,
            id_a=tid_a,
            id_b=tid_b,
        )
        total = result2.single()["total_interests"]

        # Path 3: shared InterestCategory (broader semantic overlap)
        result3 = session.run(
            """
            MATCH (a:Trip {id: $id_a})-[:HAS_INTEREST]->(:Interest)-[:IS_A]->(c:InterestCategory)
            MATCH (b:Trip {id: $id_b})-[:HAS_INTEREST]->(:Interest)-[:IS_A]->(c)
            RETURN count(DISTINCT c) AS shared_categories
            """,
            id_a=tid_a,
            id_b=tid_b,
        )
        shared_cats = result3.single()["shared_categories"]

    if total == 0:
        return 50.0  # Neutral score if no interests on either trip

    # Jaccard on interest nodes (0-1 → 0-100)
    jaccard_score = (shared / total) * 100.0

    # Bonus: each shared category adds up to 10 points (max +20)
    category_bonus = min(shared_cats * 10.0, 20.0)

    return min(jaccard_score + category_bonus, 100.0)


# ---------------------------------------------------------------------------
# Cached scoring — Redis-backed cache for graph scores (1h TTL)
# ---------------------------------------------------------------------------

_GRAPH_SCORE_CACHE_TTL = 3600  # 1 hour


def compute_graph_score_cached(trip_a_id: str | UUID, trip_b_id: str | UUID) -> Optional[float]:
    """
    Like compute_graph_score but with Redis caching.
    Canonical key: score:{min_id}:{max_id}. On cache miss, compute and store.
    """
    tid_a = str(trip_a_id)
    tid_b = str(trip_b_id)
    key_min, key_max = (tid_a, tid_b) if tid_a <= tid_b else (tid_b, tid_a)
    cache_key = f"graph_score:{key_min}:{key_max}"

    redis_client = None
    try:
        from backend.config.redis import get_redis_client
        redis_client = get_redis_client()
    except Exception:
        pass

    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached is not None:
                return float(cached)
        except Exception:
            pass

    score = compute_graph_score(trip_a_id, trip_b_id)
    if score is not None and redis_client:
        try:
            redis_client.setex(cache_key, _GRAPH_SCORE_CACHE_TTL, str(score))
        except Exception:
            pass

    return score


# ---------------------------------------------------------------------------
# Explain — called from GET /graph/explain/{match_id}
# ---------------------------------------------------------------------------

def get_match_explanation(trip_a_id: str | UUID, trip_b_id: str | UUID) -> dict:
    """
    Return a human-readable explanation of why two trips were matched,
    structured for LLM / RAG augmentation (AtlasAI integration point).

    Returns a dict with:
      - shared_interests: list of shared Interest node names
      - shared_categories: list of shared InterestCategory names
      - location_activities: activities at the shared destination
      - llm_prompt_context: natural-language summary for LLM prompting
    """
    driver = get_graph_driver()
    if driver is None:
        return {"error": "Knowledge graph unavailable", "shared_interests": [], "shared_categories": []}

    tid_a = str(trip_a_id)
    tid_b = str(trip_b_id)

    with driver.session() as session:
        # Shared interests
        r1 = session.run(
            """
            MATCH (a:Trip {id: $id_a})-[:HAS_INTEREST]->(i:Interest)<-[:HAS_INTEREST]-(b:Trip {id: $id_b})
            RETURN collect(DISTINCT i.name) AS shared_interests
            """,
            id_a=tid_a,
            id_b=tid_b,
        )
        shared_interests = r1.single()["shared_interests"]

        # Shared categories
        r2 = session.run(
            """
            MATCH (a:Trip {id: $id_a})-[:HAS_INTEREST]->(:Interest)-[:IS_A]->(c:InterestCategory)
                  <-[:IS_A]-(:Interest)<-[:HAS_INTEREST]-(b:Trip {id: $id_b})
            RETURN collect(DISTINCT c.name) AS shared_categories
            """,
            id_a=tid_a,
            id_b=tid_b,
        )
        shared_categories = r2.single()["shared_categories"]

        # Destination activities
        r3 = session.run(
            """
            MATCH (t:Trip {id: $id_a})-[:TO_LOCATION]->(l:Location)-[:HAS_ACTIVITY]->(act:Interest)
            RETURN l.name AS location_name, collect(DISTINCT act.name) AS activities
            """,
            id_a=tid_a,
        )
        loc_record = r3.single()
        location_name = loc_record["location_name"] if loc_record else "Unknown"
        location_activities = loc_record["activities"] if loc_record else []

    # Build natural-language context string for LLM/RAG
    if shared_interests:
        interest_str = ", ".join(shared_interests)
        cat_str = ", ".join(shared_categories) if shared_categories else "general"
        llm_context = (
            f"These two travelers are both visiting {location_name} with overlapping travel dates. "
            f"They share {len(shared_interests)} common interest(s): {interest_str}, "
            f"which fall under the {cat_str} category. "
            f"The destination offers activities including: {', '.join(location_activities) or 'various experiences'}. "
            f"This makes them strong candidates for travel companionship."
        )
    else:
        llm_context = (
            f"These two travelers are both visiting {location_name} with overlapping travel dates "
            f"but have no directly shared interests in the knowledge graph. "
            f"The destination offers: {', '.join(location_activities) or 'various experiences'}."
        )

    return {
        "shared_interests": shared_interests,
        "shared_categories": shared_categories,
        "location_name": location_name,
        "location_activities": location_activities,
        "llm_prompt_context": llm_context,
    }
