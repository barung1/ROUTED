"""
Interest routes — API for expressing and managing interest in trips.
"""

from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from backend.auth.jwt import get_current_user_id
from backend.config.db import get_db_session
from backend.models.interest import Interest, InterestStatus
from backend.models.trip import Trip
from backend.models.user import User
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


# ── API Models ──

class InterestCreateModel(BaseModel):
    tripId: UUID


class InterestResponseModel(BaseModel):
    id: UUID
    fromUserId: UUID
    fromUsername: str
    toUserId: UUID
    toUsername: str
    tripId: UUID
    tripLabel: str
    tripStartDate: str
    tripEndDate: str
    status: str
    createdAt: str


class InterestUpdateModel(BaseModel):
    status: str  # "accepted" or "declined"


def _to_response(interest: Interest, db: Session) -> InterestResponseModel:
    """Convert Interest model to response model."""
    from_user = db.execute(select(User).where(User.id == interest.from_user_id)).scalars().first()
    to_user = db.execute(select(User).where(User.id == interest.to_user_id)).scalars().first()
    trip = db.execute(select(Trip).where(Trip.id == interest.trip_id)).scalars().first()

    trip_label = "Trip"
    trip_start = ""
    trip_end = ""
    if trip:
        if trip.from_place and trip.to_place:
            trip_label = f"{trip.from_place} → {trip.to_place}"
        elif trip.to_place:
            trip_label = trip.to_place
        elif trip.from_place:
            trip_label = trip.from_place
        trip_start = str(trip.start_date)
        trip_end = str(trip.end_date)

    return InterestResponseModel(
        id=interest.id,
        fromUserId=interest.from_user_id,
        fromUsername=from_user.username if from_user else "unknown",
        toUserId=interest.to_user_id,
        toUsername=to_user.username if to_user else "unknown",
        tripId=interest.trip_id,
        tripLabel=trip_label,
        tripStartDate=trip_start,
        tripEndDate=trip_end,
        status=interest.status.value,
        createdAt=interest.created_at.isoformat() if interest.created_at else "",
    )


@router.post("/", response_model=InterestResponseModel)
def create_interest(
    body: InterestCreateModel,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db_session),
) -> InterestResponseModel:
    """
    Express interest in a trip. The trip owner will see it in their dashboard.
    """
    # Validate trip exists
    trip = db.execute(select(Trip).where(Trip.id == body.tripId)).scalars().first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    if not trip.user:
        # Load user via user_trips association
        from sqlalchemy.orm import selectinload
        trip = db.execute(
            select(Trip).where(Trip.id == body.tripId).options(selectinload(Trip.user))
        ).scalars().first()

    if not trip or not trip.user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trip has no owner")

    # Can't express interest in your own trip
    if trip.user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot express interest in your own trip")

    # Check for existing pending interest
    existing = db.execute(
        select(Interest).where(
            Interest.from_user_id == user_id,
            Interest.trip_id == body.tripId,
            Interest.status == InterestStatus.PENDING,
        )
    ).scalars().first()

    if existing:
        # Toggle off — remove the interest
        resp = _to_response(existing, db)
        db.delete(existing)
        db.commit()
        # Return the removed interest with status "removed" so the frontend knows
        resp.status = "removed"
        return resp

    # Create new interest
    new_interest = Interest(
        from_user_id=user_id,
        to_user_id=trip.user.id,
        trip_id=body.tripId,
        status=InterestStatus.PENDING,
    )
    db.add(new_interest)
    db.commit()
    db.refresh(new_interest)

    return _to_response(new_interest, db)


@router.get("/my-trip-ids", response_model=list[str])
def get_my_interested_trip_ids(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db_session),
) -> list[str]:
    """Return list of trip IDs the current user has a pending interest on."""
    interests = db.execute(
        select(Interest.trip_id).where(
            Interest.from_user_id == user_id,
            Interest.status == InterestStatus.PENDING,
        )
    ).scalars().all()
    return [str(tid) for tid in interests]


@router.get("/received", response_model=list[InterestResponseModel])
def get_received_interests(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db_session),
) -> list[InterestResponseModel]:
    """Get interests others have expressed in the current user's trips."""
    interests = db.execute(
        select(Interest).where(
            Interest.to_user_id == user_id,
            Interest.status == InterestStatus.PENDING,
        ).order_by(Interest.created_at.desc())
    ).scalars().all()

    return [_to_response(i, db) for i in interests]


@router.get("/given", response_model=list[InterestResponseModel])
def get_given_interests(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db_session),
) -> list[InterestResponseModel]:
    """Get interests the current user has expressed on others' trips."""
    interests = db.execute(
        select(Interest).where(
            Interest.from_user_id == user_id,
        ).order_by(Interest.created_at.desc())
    ).scalars().all()

    return [_to_response(i, db) for i in interests]


@router.get("/messages", response_model=list[InterestResponseModel])
def get_interest_messages(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db_session),
) -> list[InterestResponseModel]:
    """Get resolved interests (accepted/declined) visible to the current user."""
    interests = db.execute(
        select(Interest).where(
            or_(
                Interest.from_user_id == user_id,
                Interest.to_user_id == user_id,
            ),
            Interest.status.in_([InterestStatus.ACCEPTED, InterestStatus.DECLINED]),
        ).order_by(Interest.created_at.desc())
    ).scalars().all()

    return [_to_response(i, db) for i in interests]


@router.put("/{interest_id}", response_model=InterestResponseModel)
def update_interest(
    interest_id: UUID,
    body: InterestUpdateModel,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db_session),
) -> InterestResponseModel:
    """Accept or decline an interest. Only the trip owner (to_user) can do this."""
    interest = db.execute(select(Interest).where(Interest.id == interest_id)).scalars().first()
    if not interest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interest not found")

    if interest.to_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the trip owner can accept/decline")

    if body.status == "accepted":
        interest.status = InterestStatus.ACCEPTED
    elif body.status == "declined":
        interest.status = InterestStatus.DECLINED
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'accepted' or 'declined'")

    db.commit()
    db.refresh(interest)

    return _to_response(interest, db)


@router.delete("/{interest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interest(
    interest_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db_session),
) -> None:
    """Remove an interest (only the sender can do this)."""
    interest = db.execute(select(Interest).where(Interest.id == interest_id)).scalars().first()
    if not interest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interest not found")

    if interest.from_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the sender can delete an interest")

    db.delete(interest)
    db.commit()
