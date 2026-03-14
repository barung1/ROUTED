from typing import Literal
from uuid import UUID

from backend.auth.jwt import get_current_user_id
from pydantic import BaseModel
from fastapi import FastAPI, status, Depends, HTTPException
from fastapi.openapi.utils import get_openapi
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.config.db import get_db_session, engine # type: ignore
from backend.loggers.logger import get_logger # type: ignore
from backend.routes.user.user import router as user_router
from backend.routes.trip.trip import router as trip_router
from backend.routes.location import router as location_router
from backend.routes.match.match import router as match_router
from backend.routes.interest import router as interest_router
from fastapi.middleware.cors import CORSMiddleware

logger = get_logger(__name__, "app.log")

logger.info("Initializing FastAPI application...")

app = FastAPI(
	title="Routed API",
	description="Routed backend API with comprehensive OpenAPI documentation",
	logger=logger
)

logger.info("FastAPI application created successfully")

# Allow Vite dev server to access the API during development
origins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
]

app.add_middleware(
	CORSMiddleware,
	allow_origins=origins,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(user_router, prefix="/users", tags=["Users"])
app.include_router(trip_router, prefix="/trips", tags=["Trips"])
app.include_router(match_router, prefix="/matches", tags=["Matches"], dependencies=[Depends(get_current_user_id)])
app.include_router(location_router, prefix="/locations", tags=["Locations"],dependencies=[Depends(get_current_user_id)])
app.include_router(interest_router, prefix="/interests", tags=["Interests"])


# ---------------------------------------------------------------------------
# Graph lifecycle
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_graph():
	"""
	Bootstrap the Neo4j knowledge graph on application startup.
	Creates constraints/indexes and syncs existing data.
	Graceful: if Neo4j is unreachable the app still starts normally.
	"""
	try:
		from backend.graph import knowledge_graph, graph_embedder
		knowledge_graph.bootstrap_graph()
		graph_embedder.train_embedder_from_graph()
		logger.info("[startup] Knowledge graph bootstrap complete.")
	except Exception as exc:
		logger.warning(f"[startup] Graph bootstrap skipped: {exc}")


@app.on_event("shutdown")
async def shutdown_graph():
	"""Close the Neo4j driver cleanly on shutdown."""
	try:
		from backend.graph.graph_client import close_graph_driver
		close_graph_driver()
	except Exception:
		pass


# ---------------------------------------------------------------------------
# Knowledge Graph endpoints — demo/interview layer
# ---------------------------------------------------------------------------

@app.get(
	"/graph/explain/{match_id}",
	tags=["Knowledge Graph"],
	summary="Explain a match using the knowledge graph",
	description=(
		"Returns a human-readable explanation of why two trips were matched, "
		"structured for LLM/RAG augmentation. Shows shared Interest nodes, "
		"shared category paths, destination activities, and a natural-language "
		"context string ready for LLM prompting. Requires authentication."
	),
)
def graph_explain_match(
	match_id: UUID,
	db: Session = Depends(get_db_session),
	current_user_id: UUID = Depends(get_current_user_id),
):
	"""
	AtlasAI-style graph reasoning endpoint.

	Traverses the knowledge graph to surface:
	  1. Shared Interest nodes between the two matched trips
	  2. Shared InterestCategory nodes (semantic hierarchy)
	  3. Activities available at the destination location
	  4. A natural-language context string for LLM/RAG prompting

	This demonstrates the KG + LLM integration described in the Qorsa JD.
	"""
	from backend.models.match import Match
	from sqlalchemy import select

	# Fetch match and verify access
	match = db.execute(
		select(Match).where(Match.id == match_id)
	).scalars().first()

	if not match:
		raise HTTPException(status_code=404, detail="Match not found")

	if current_user_id not in (match.user_a_id, match.user_b_id):
		raise HTTPException(status_code=403, detail="Access denied")

	from backend.graph import knowledge_graph
	explanation = knowledge_graph.get_match_explanation(match.trip_a_id, match.trip_b_id)

	return {
		"match_id": str(match_id),
		"match_score": match.score,
		"match_status": match.status.value,
		**explanation,
	}


@app.post(
	"/graph/recompute-embeddings",
	tags=["Knowledge Graph"],
	summary="Retrain graph embeddings from current trip data",
	description=(
		"Fetches all Trip interest lists from Neo4j and retrains the "
		"Node2Vec-style co-occurrence embeddings. Call this after bulk "
		"data changes. Requires authentication."
	),
	status_code=status.HTTP_200_OK,
)
def recompute_embeddings(
	current_user_id: UUID = Depends(get_current_user_id),
):
	"""Trigger re-training of the graph interest embeddings."""
	try:
		from backend.graph import graph_embedder
		graph_embedder.train_embedder_from_graph()
		embedder = graph_embedder.get_embedder()
		return {
			"status": "ok",
			"vocab_size": len(embedder._vocab),
			"embedding_dim": embedder.embedding_dim,
		}
	except Exception as exc:
		raise HTTPException(status_code=503, detail=f"Embedding recompute failed: {exc}")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get(
	"/health",
	status_code=status.HTTP_200_OK,
	tags=["Health"],
	summary="Health Check",
	description="Check if the API, database, and knowledge graph are healthy"
)
def health(db: Session = Depends(get_db_session)):
	try:
		db.execute(text("SELECT 2"))
		db_status = "connected"
	except Exception as e:
		logger.error(f"Database health check failed: {e}")
		db_status = "not connected"

	# Check Neo4j
	try:
		from backend.graph.graph_client import get_graph_driver
		driver = get_graph_driver()
		graph_status = "connected" if driver is not None else "unavailable"
	except Exception:
		graph_status = "unavailable"

	return {
		"status": "ok",
		"database": db_status,
		"knowledge_graph": graph_status,
	}