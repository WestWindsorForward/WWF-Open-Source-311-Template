from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models import ServiceRequest
from sqlalchemy import select
import asyncio


def run_async(coro):
    """Helper to run async functions in sync context"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=3)
def analyze_request(self, request_id: int):
    """Analyze service request with AI (if enabled)"""
    async def _analyze():
        async with SessionLocal() as db:
            result = await db.execute(
                select(ServiceRequest).where(ServiceRequest.id == request_id)
            )
            request = result.scalar_one_or_none()
            if not request:
                return {"error": "Request not found"}
            
            # TODO: Implement actual Vertex AI analysis
            # For now, set a placeholder analysis
            analysis = {
                "priority": 5,
                "category_confidence": 0.85,
                "flagged": False,
                "summary": f"Request for {request.service_name}"
            }
            
            request.ai_analysis = analysis
            request.priority = analysis.get("priority", 5)
            request.flagged = analysis.get("flagged", False)
            
            await db.commit()
            return analysis
    
    try:
        return run_async(_analyze())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True)
def geocode_address(self, request_id: int):
    """Geocode address to lat/long (if configured)"""
    async def _geocode():
        async with SessionLocal() as db:
            result = await db.execute(
                select(ServiceRequest).where(ServiceRequest.id == request_id)
            )
            request = result.scalar_one_or_none()
            if not request or not request.address:
                return {"error": "Request or address not found"}
            
            # TODO: Implement actual geocoding via Google Maps API
            # For now, return placeholder
            return {"status": "geocoding_not_configured"}
    
    try:
        return run_async(_geocode())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task
def send_notification(request_id: int, notification_type: str):
    """Send notification (email/SMS) for request updates"""
    # TODO: Implement email/SMS notifications
    return {"status": "notifications_not_configured", "request_id": request_id}
