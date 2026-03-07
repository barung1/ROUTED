"""
Knowledge Graph module for Routed — Neo4j-powered semantic matching.

Components:
- graph_client      : Neo4j driver singleton
- knowledge_graph   : Schema management, Cypher queries, scoring
- entity_resolver   : Interest entity normalization / NER-style linking
- graph_embedder    : Node2Vec-style co-occurrence embeddings for Interest nodes
"""
