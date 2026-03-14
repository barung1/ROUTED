"""
Neo4j Driver Singleton for Routed Knowledge Graph.

Reads GRAPH_NEO4J_URI, GRAPH_NEO4J_USER, GRAPH_NEO4J_PASSWORD from env.
Returns None gracefully if Neo4j is unreachable — the app continues
functioning with Jaccard fallback scoring.
"""

import os
from typing import Optional

_driver = None
_driver_initialized = False


def get_graph_driver():
    """
    Return the shared Neo4j Driver instance, or None if unavailable.

    Uses lazy initialization: the driver is created on first call and
    reused for the lifetime of the process. If Neo4j is unreachable,
    returns None so callers can degrade gracefully.
    """
    global _driver, _driver_initialized

    if _driver_initialized:
        return _driver

    _driver_initialized = True

    try:
        from neo4j import GraphDatabase  # type: ignore

        uri = os.getenv("GRAPH_NEO4J_URI", "bolt://neo4j:7687")
        user = os.getenv("GRAPH_NEO4J_USER", "neo4j")
        password = os.getenv("GRAPH_NEO4J_PASSWORD", "routedgraph")

        _driver = GraphDatabase.driver(uri, auth=(user, password))

        # Verify connectivity
        _driver.verify_connectivity()

        from backend.loggers.logger import get_logger
        get_logger(__name__).info(f"[KnowledgeGraph] Neo4j connected at {uri}")

    except Exception as exc:
        from backend.loggers.logger import get_logger
        get_logger(__name__).warning(f"[KnowledgeGraph] Neo4j unavailable — graph scoring disabled. ({exc})")
        _driver = None

    return _driver


def close_graph_driver():
    """Close the Neo4j driver on application shutdown."""
    global _driver, _driver_initialized
    if _driver:
        _driver.close()
        _driver = None
    _driver_initialized = False
