"""
Prometheus metrics for Routed observability.
"""

from prometheus_client import Counter, Histogram

# Match generation
match_generation_time = Histogram(
    "match_generation_seconds",
    "Time spent calculating matches for a trip",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
)
matches_created_total = Counter(
    "matches_created_total",
    "Total number of matches created",
)

# API latency (path will be added as label)
api_request_duration = Histogram(
    "api_request_duration_seconds",
    "API request duration in seconds",
    ["method", "path"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)
