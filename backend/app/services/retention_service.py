"""
Document Retention Service

Provides state-by-state record retention policies and enforcement logic
for municipal 311 service requests. Complies with state public records laws.

Key features:
- State-specific retention periods (embedded data)
- Legal hold support (prevents destruction during litigation)
- Automatic archival with PII anonymization
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ============================================================================
# STATE RETENTION POLICIES
# ============================================================================
# Based on research of state public records laws for municipal service requests.
# These are minimum retention periods - townships can extend but not shorten.

STATE_RETENTION_POLICIES: Dict[str, Dict[str, Any]] = {
    # Northeast
    "NJ": {"days": 7 * 365, "name": "New Jersey", "source": "NJ Public Records Law"},
    "NY": {"days": 6 * 365, "name": "New York", "source": "NY Arts & Cultural Affairs Law §57.25"},
    "PA": {"days": 7 * 365, "name": "Pennsylvania", "source": "PA Municipal Records Manual"},
    "MA": {"days": 3 * 365, "name": "Massachusetts", "source": "MA Municipal Records Schedule"},
    "CT": {"days": 6 * 365, "name": "Connecticut", "source": "CT Public Records Administrator"},
    
    # Southeast
    "FL": {"days": 5 * 365, "name": "Florida", "source": "FL Division of Library & Information Services"},
    "GA": {"days": 3 * 365, "name": "Georgia", "source": "GA Archives"},
    "NC": {"days": 5 * 365, "name": "North Carolina", "source": "NC DNCR"},
    "VA": {"days": 5 * 365, "name": "Virginia", "source": "Library of Virginia"},
    
    # Midwest
    "OH": {"days": 5 * 365, "name": "Ohio", "source": "OH Historical Society"},
    "IL": {"days": 5 * 365, "name": "Illinois", "source": "IL Local Records Commission"},
    "MI": {"days": 6 * 365, "name": "Michigan", "source": "MI Archives"},
    "IN": {"days": 5 * 365, "name": "Indiana", "source": "IN Commission on Public Records"},
    "WI": {"days": 7 * 365, "name": "Wisconsin", "source": "WI Public Records Board"},
    "MO": {"days": 5 * 365, "name": "Missouri", "source": "MO Secretary of State"},
    
    # Southwest
    "TX": {"days": 10 * 365, "name": "Texas", "source": "TX State Library & Archives Commission"},
    "AZ": {"days": 5 * 365, "name": "Arizona", "source": "AZ State Library"},
    "NM": {"days": 5 * 365, "name": "New Mexico", "source": "NM State Records Center"},
    
    # West
    "CA": {"days": 5 * 365, "name": "California", "source": "CA Secretary of State"},
    "WA": {"days": 6 * 365, "name": "Washington", "source": "WA State Archives"},
    "OR": {"days": 5 * 365, "name": "Oregon", "source": "OR State Archives"},
    "CO": {"days": 5 * 365, "name": "Colorado", "source": "CO State Archives"},
    
    # Default for unlisted states
    "DEFAULT": {"days": 7 * 365, "name": "Default", "source": "Conservative 7-year default"},
}


def get_all_states() -> List[Dict[str, Any]]:
    """Get list of all supported states with their retention policies."""
    states = []
    for code, policy in STATE_RETENTION_POLICIES.items():
        if code != "DEFAULT":
            states.append({
                "code": code,
                "name": policy["name"],
                "retention_days": policy["days"],
                "retention_years": policy["days"] // 365,
                "source": policy["source"]
            })
    return sorted(states, key=lambda x: x["name"])


def get_retention_policy(state_code: str) -> Dict[str, Any]:
    """
    Get retention policy for a specific state.
    
    Args:
        state_code: Two-letter state code (e.g., "NJ", "TX")
        
    Returns:
        Dict with days, name, source, and years
    """
    state_code = state_code.upper() if state_code else "DEFAULT"
    policy = STATE_RETENTION_POLICIES.get(state_code, STATE_RETENTION_POLICIES["DEFAULT"])
    
    return {
        "state_code": state_code,
        "name": policy["name"],
        "retention_days": policy["days"],
        "retention_years": policy["days"] // 365,
        "source": policy["source"]
    }


def calculate_retention_date(
    closed_date: datetime,
    state_code: str,
    override_days: Optional[int] = None
) -> datetime:
    """
    Calculate the date when a record can be archived/deleted.
    
    Args:
        closed_date: When the request was closed
        state_code: State for retention rules
        override_days: Optional override (must be >= state minimum)
        
    Returns:
        Datetime when record can be archived
    """
    policy = get_retention_policy(state_code)
    retention_days = policy["retention_days"]
    
    # Allow override only if it's longer than state minimum
    if override_days and override_days > retention_days:
        retention_days = override_days
    
    return closed_date + timedelta(days=retention_days)


async def get_records_for_archival(
    db: AsyncSession,
    state_code: str,
    override_days: Optional[int] = None,
    limit: int = 100
) -> List[Any]:
    """
    Get closed records that have exceeded their retention period.
    
    Args:
        db: Database session
        state_code: State for retention rules
        override_days: Optional custom retention period
        limit: Max records to return
        
    Returns:
        List of ServiceRequest records eligible for archival
    """
    from app.models import ServiceRequest
    
    policy = get_retention_policy(state_code)
    retention_days = override_days if override_days else policy["retention_days"]
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    
    # Query closed records older than retention period, not already archived,
    # not deleted, and not under legal hold
    query = select(ServiceRequest).where(
        and_(
            ServiceRequest.status == "closed",
            ServiceRequest.closed_datetime.isnot(None),
            ServiceRequest.closed_datetime < cutoff_date,
            ServiceRequest.archived_at.is_(None),
            ServiceRequest.deleted_at.is_(None),
            # Legal hold check - skip if flagged
            ServiceRequest.flagged == False
        )
    ).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


async def archive_record(
    db: AsyncSession,
    record_id: int,
    archive_mode: str = "anonymize"
) -> Dict[str, Any]:
    """
    Archive a record by anonymizing PII or marking for deletion.
    
    Args:
        db: Database session
        record_id: ID of record to archive
        archive_mode: "anonymize" (default) or "delete"
        
    Returns:
        Dict with status and details
    """
    from app.models import ServiceRequest
    
    result = await db.execute(
        select(ServiceRequest).where(ServiceRequest.id == record_id)
    )
    record = result.scalar_one_or_none()
    
    if not record:
        return {"status": "error", "message": "Record not found"}
    
    # Check for legal hold (flagged records)
    if record.flagged:
        return {
            "status": "skipped",
            "message": "Record under legal hold (flagged)",
            "record_id": record_id
        }
    
    if archive_mode == "delete":
        # Hard delete - remove from database entirely
        await db.delete(record)
        await db.commit()
        return {
            "status": "deleted",
            "record_id": record_id,
            "service_request_id": record.service_request_id
        }
    else:
        # Anonymize - remove PII but keep statistical data
        record.first_name = "[ARCHIVED]"
        record.last_name = "[ARCHIVED]"
        record.email = f"archived-{record.id}@retention.local"
        record.phone = None
        record.description = "[Content archived per retention policy]"
        record.staff_notes = None
        record.media_urls = []
        record.archived_at = datetime.utcnow()
        
        await db.commit()
        
        return {
            "status": "anonymized",
            "record_id": record_id,
            "service_request_id": record.service_request_id,
            "archived_at": record.archived_at.isoformat()
        }


async def get_retention_stats(
    db: AsyncSession,
    state_code: str,
    override_days: Optional[int] = None
) -> Dict[str, Any]:
    """
    Get statistics about records pending archival.
    
    Args:
        db: Database session
        state_code: State for retention rules
        override_days: Optional custom retention period
        
    Returns:
        Dict with counts and dates
    """
    from app.models import ServiceRequest
    from sqlalchemy import func
    
    policy = get_retention_policy(state_code)
    retention_days = override_days if override_days else policy["retention_days"]
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    
    # Count records eligible for archival
    eligible_query = select(func.count(ServiceRequest.id)).where(
        and_(
            ServiceRequest.status == "closed",
            ServiceRequest.closed_datetime.isnot(None),
            ServiceRequest.closed_datetime < cutoff_date,
            ServiceRequest.archived_at.is_(None),
            ServiceRequest.deleted_at.is_(None),
            ServiceRequest.flagged == False
        )
    )
    eligible_result = await db.execute(eligible_query)
    eligible_count = eligible_result.scalar() or 0
    
    # Count records under legal hold
    held_query = select(func.count(ServiceRequest.id)).where(
        and_(
            ServiceRequest.status == "closed",
            ServiceRequest.closed_datetime.isnot(None),
            ServiceRequest.closed_datetime < cutoff_date,
            ServiceRequest.archived_at.is_(None),
            ServiceRequest.deleted_at.is_(None),
            ServiceRequest.flagged == True
        )
    )
    held_result = await db.execute(held_query)
    held_count = held_result.scalar() or 0
    
    # Count already archived
    archived_query = select(func.count(ServiceRequest.id)).where(
        ServiceRequest.archived_at.isnot(None)
    )
    archived_result = await db.execute(archived_query)
    archived_count = archived_result.scalar() or 0
    
    return {
        "retention_policy": policy,
        "cutoff_date": cutoff_date.isoformat(),
        "eligible_for_archival": eligible_count,
        "under_legal_hold": held_count,
        "already_archived": archived_count,
        "next_run": "Daily at midnight UTC"
    }
