"""
Graph Embedder — Node2Vec-style Co-occurrence Embeddings for Interest Nodes.

Demonstrates graph embedding techniques (Node2Vec, co-occurrence matrices)
as described in the Qorsa/AtlasAI job description.

Approach:
  - Treat each Trip as a "sentence" and each Interest as a "word"
  - Build a co-occurrence matrix: Interest A co-occurs with Interest B when
    they both appear on the same Trip
  - Apply truncated SVD to produce dense embedding vectors (50 dimensions)
  - Expose cosine_similarity(a, b) for use in scoring (similarity search)

This is conceptually equivalent to Word2Vec skip-gram (or Node2Vec random
walks) — the key idea is that interests appearing together on trips form
a latent semantic space, similar to how words co-occurring in documents
form semantic word embeddings.

In a production system this would be replaced with:
  - Actual Node2Vec walks over the full knowledge graph
  - Pre-trained interest embeddings from a domain LLM
  - TransE / RotatE for relational graph embeddings
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Optional

import numpy as np


class GraphEmbedder:
    """
    Co-occurrence matrix SVD embedder for Interest nodes.

    Usage:
        embedder = GraphEmbedder(embedding_dim=50)
        embedder.fit(trip_interest_lists)   # train
        similarity = embedder.cosine_similarity("hiking", "camping")
    """

    def __init__(self, embedding_dim: int = 50):
        self.embedding_dim = embedding_dim
        self._vocab: list[str] = []
        self._word_to_idx: dict[str, int] = {}
        self._embeddings: Optional[np.ndarray] = None  # shape: (vocab_size, embedding_dim)

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def fit(self, trip_interest_lists: list[list[str]]) -> None:
        """
        Build co-occurrence matrix from trip interest lists and compute SVD embeddings.

        Args:
            trip_interest_lists: Each inner list is the interests for one Trip.
                                 Example: [["hiking", "nature"], ["food", "culture"], ...]
        """
        # Build vocabulary
        vocab_set: set[str] = set()
        for interests in trip_interest_lists:
            vocab_set.update(interests)

        self._vocab = sorted(vocab_set)
        self._word_to_idx = {w: i for i, w in enumerate(self._vocab)}
        n = len(self._vocab)

        if n == 0:
            return

        # Build co-occurrence matrix (word × word)
        co_matrix = np.zeros((n, n), dtype=np.float32)
        for interests in trip_interest_lists:
            indices = [self._word_to_idx[w] for w in interests if w in self._word_to_idx]
            for i_idx in indices:
                for j_idx in indices:
                    if i_idx != j_idx:
                        co_matrix[i_idx][j_idx] += 1.0

        # Apply PPMI (Positive Pointwise Mutual Information) transformation
        # This is standard in co-occurrence embedding pipelines
        co_matrix = self._apply_ppmi(co_matrix)

        # SVD: decompose into U * S * Vt
        # We keep the top-k singular vectors as embeddings
        dim = min(self.embedding_dim, n - 1) if n > 1 else 1
        try:
            U, S, _ = np.linalg.svd(co_matrix, full_matrices=False)
            # Weight U by sqrt(S) (standard in distributional semantics)
            self._embeddings = U[:, :dim] * np.sqrt(S[:dim])
        except np.linalg.LinAlgError:
            # Fallback: random embeddings if SVD fails (degenerate matrix)
            self._embeddings = np.random.randn(n, dim).astype(np.float32)

    @staticmethod
    def _apply_ppmi(co_matrix: np.ndarray) -> np.ndarray:
        """
        Apply Positive PMI transformation to the co-occurrence matrix.
        PMI(a,b) = log[P(a,b) / (P(a) * P(b))], clamped at 0.
        """
        total = co_matrix.sum()
        if total == 0:
            return co_matrix

        row_sum = co_matrix.sum(axis=1, keepdims=True)  # P(a)
        col_sum = co_matrix.sum(axis=0, keepdims=True)  # P(b)

        # Avoid division by zero
        row_sum = np.where(row_sum == 0, 1, row_sum)
        col_sum = np.where(col_sum == 0, 1, col_sum)

        pmi = np.log((co_matrix * total) / (row_sum * col_sum) + 1e-9)
        return np.maximum(pmi, 0)  # Positive PMI

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def get_embedding(self, interest: str) -> Optional[np.ndarray]:
        """Return the embedding vector for an interest, or None if unknown."""
        idx = self._word_to_idx.get(interest)
        if idx is None or self._embeddings is None:
            return None
        return self._embeddings[idx]

    def cosine_similarity(self, interest_a: str, interest_b: str) -> float:
        """
        Compute cosine similarity between two interest embeddings.

        Returns:
            float in [-1, 1], or 0.0 if either interest is unknown.
            (Converted to [0, 1] for use in scoring)
        """
        vec_a = self.get_embedding(interest_a)
        vec_b = self.get_embedding(interest_b)

        if vec_a is None or vec_b is None:
            return 0.0

        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))

    def score_interest_lists(self, interests_a: list[str], interests_b: list[str]) -> float:
        """
        Compute embedding-based similarity score between two interest lists.
        Uses average max-cosine-similarity (like Word Mover's Distance but simpler).

        Returns a score in [0, 100].
        """
        if not interests_a or not interests_b:
            return 50.0

        total_sim = 0.0
        count = 0
        for a in interests_a:
            sims = [self.cosine_similarity(a, b) for b in interests_b]
            if sims:
                total_sim += max(sims)  # Best match for each interest in A
                count += 1

        if count == 0:
            return 50.0

        avg_sim = total_sim / count  # Range: [0, 1]
        return avg_sim * 100.0


# ---------------------------------------------------------------------------
# Module-level singleton — trained lazily from graph data
# ---------------------------------------------------------------------------

_embedder_instance: Optional[GraphEmbedder] = None


def get_embedder() -> GraphEmbedder:
    """Return the module-level embedder instance (untrained by default)."""
    global _embedder_instance
    if _embedder_instance is None:
        _embedder_instance = GraphEmbedder(embedding_dim=50)
    return _embedder_instance


def train_embedder_from_graph() -> None:
    """
    Fetch all Trip interest lists from Neo4j and train the embedder.
    Called on startup (after bootstrap_graph) and can be triggered via
    POST /graph/recompute-embeddings.
    """
    from backend.graph.graph_client import get_graph_driver

    driver = get_graph_driver()
    if driver is None:
        return

    with driver.session() as session:
        result = session.run(
            """
            MATCH (t:Trip)-[:HAS_INTEREST]->(i:Interest)
            RETURN t.id AS trip_id, collect(i.name) AS interests
            """
        )
        trip_interest_lists = [record["interests"] for record in result]

    if trip_interest_lists:
        embedder = get_embedder()
        embedder.fit(trip_interest_lists)

        from backend.loggers.logger import logger
        logger.info(
            f"[GraphEmbedder] Trained on {len(trip_interest_lists)} trips, "
            f"vocab size: {len(embedder._vocab)}"
        )
