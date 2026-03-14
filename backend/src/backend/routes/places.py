"""
Place autocomplete using Nominatim (OpenStreetMap). No API key required.
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.config.limiter import limiter
from fastapi import Request

router = APIRouter()


class PlaceSuggestion(BaseModel):
	place_id: str
	display_name: str
	lat: float
	lon: float


@router.get("/autocomplete", response_model=list[PlaceSuggestion])
@limiter.limit("30/minute")
def autocomplete(
	request: Request,
	q: str = Query(..., min_length=2, max_length=200),
) -> list[PlaceSuggestion]:
	"""
	Search places by query string. Uses Nominatim (OpenStreetMap) - free, no API key.
	Returns display name and coordinates for map display and trip storage.
	"""
	query = q.strip()
	if len(query) < 2:
		return []
	return _autocomplete_nominatim(query)


def _autocomplete_nominatim(q: str) -> list[PlaceSuggestion]:
	"""Nominatim (OpenStreetMap) - free, no key."""
	url = "https://nominatim.openstreetmap.org/search"
	params = {
		"q": q,
		"format": "json",
		"limit": 8,
		"addressdetails": 0,
	}
	headers = {"User-Agent": "Routed-TripPlanner/1.0"}

	with httpx.Client(timeout=5.0) as client:
		resp = client.get(url, params=params, headers=headers)
		resp.raise_for_status()
		data = resp.json()

	out: list[PlaceSuggestion] = []
	for item in data:
		lat = item.get("lat")
		lon = item.get("lon")
		display = item.get("display_name", "")
		place_id = str(item.get("place_id", ""))
		if lat is not None and lon is not None:
			out.append(
				PlaceSuggestion(
					place_id=place_id,
					display_name=display,
					lat=float(lat),
					lon=float(lon),
				)
			)
	return out
