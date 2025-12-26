from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models import ServiceRequest, SystemSecret
from app.services.notifications import notification_service
from app.services.geocoding import get_geocoding_service
from sqlalchemy import select
import asyncio


def run_async(coro):
    """Helper to run async functions in sync context"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def get_secret(db, key_name: str) -> str:
    """Get a secret value from database"""
    result = await db.execute(
        select(SystemSecret).where(SystemSecret.key_name == key_name)
    )
    secret = result.scalar_one_or_none()
    return secret.key_value if secret and secret.is_configured else ""


async def configure_notifications(db):
    """Configure notification service from database secrets"""
    # Configure SMS provider
    sms_provider = await get_secret(db, "SMS_PROVIDER")
    
    if sms_provider == "twilio":
        notification_service.configure_sms("twilio", {
            "account_sid": await get_secret(db, "TWILIO_ACCOUNT_SID"),
            "auth_token": await get_secret(db, "TWILIO_AUTH_TOKEN"),
            "from_number": await get_secret(db, "TWILIO_PHONE_NUMBER")
        })
    elif sms_provider == "http":
        notification_service.configure_sms("http", {
            "api_url": await get_secret(db, "SMS_HTTP_API_URL"),
            "api_key": await get_secret(db, "SMS_HTTP_API_KEY"),
            "from_number": await get_secret(db, "SMS_FROM_NUMBER")
        })
    
    # Configure Email provider
    email_enabled = await get_secret(db, "EMAIL_ENABLED")
    if email_enabled.lower() == "true":
        smtp_port_str = await get_secret(db, "SMTP_PORT")
        use_tls_str = await get_secret(db, "SMTP_USE_TLS")
        
        notification_service.configure_email({
            "smtp_host": await get_secret(db, "SMTP_HOST"),
            "smtp_port": int(smtp_port_str) if smtp_port_str else 587,
            "smtp_user": await get_secret(db, "SMTP_USER"),
            "smtp_password": await get_secret(db, "SMTP_PASSWORD"),
            "from_email": await get_secret(db, "SMTP_FROM_EMAIL"),
            "from_name": await get_secret(db, "SMTP_FROM_NAME") or "Township 311",
            "use_tls": use_tls_str.lower() != "false" if use_tls_str else True
        })


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
    """Geocode address to lat/long using configured service"""
    async def _geocode():
        async with SessionLocal() as db:
            result = await db.execute(
                select(ServiceRequest).where(ServiceRequest.id == request_id)
            )
            request = result.scalar_one_or_none()
            if not request or not request.address:
                return {"error": "Request or address not found"}
            
            # Get Google Maps API key
            api_key = await get_secret(db, "GOOGLE_MAPS_API_KEY")
            service = get_geocoding_service(api_key if api_key else None)
            
            # Geocode the address
            geo_result = await service.geocode(request.address)
            
            if geo_result:
                request.lat = geo_result.lat
                request.long = geo_result.lng
                await db.commit()
                return {
                    "status": "success",
                    "lat": geo_result.lat,
                    "lng": geo_result.lng,
                    "formatted_address": geo_result.formatted_address
                }
            else:
                return {"status": "geocoding_failed", "address": request.address}
    
    try:
        return run_async(_geocode())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task
def send_notification(request_id: int, notification_type: str):
    """Send notification (email/SMS) for request updates"""
    async def _notify():
        async with SessionLocal() as db:
            # Configure notification providers
            await configure_notifications(db)
            
            # Get the request
            result = await db.execute(
                select(ServiceRequest).where(ServiceRequest.id == request_id)
            )
            request = result.scalar_one_or_none()
            if not request:
                return {"error": "Request not found"}
            
            if notification_type == "confirmation":
                # Send confirmation for new request
                notification_service.send_request_confirmation(
                    request_id=str(request.service_request_id),
                    email=request.email,
                    phone=request.phone
                )
            elif notification_type == "status_update":
                # Send status update
                await notification_service.send_status_update(
                    request_id=str(request.service_request_id),
                    new_status=request.status,
                    email=request.email,
                    phone=request.phone
                )
            
            return {"status": "sent", "type": notification_type}
    
    try:
        return run_async(_notify())
    except Exception as e:
        return {"status": "error", "error": str(e)}


@celery_app.task
def send_department_notification(request_id: int, department_email: str):
    """Notify department of new request"""
    async def _notify():
        async with SessionLocal() as db:
            await configure_notifications(db)
            
            result = await db.execute(
                select(ServiceRequest).where(ServiceRequest.id == request_id)
            )
            request = result.scalar_one_or_none()
            if not request:
                return {"error": "Request not found"}
            
            subject = f"New Service Request: #{request.service_request_id} - {request.service_name}"
            body_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>New Service Request Received</h2>
                <p><strong>Request ID:</strong> {request.service_request_id}</p>
                <p><strong>Category:</strong> {request.service_name}</p>
                <p><strong>Description:</strong></p>
                <p>{request.description}</p>
                <p><strong>Address:</strong> {request.address or 'Not provided'}</p>
                <p><strong>Submitted:</strong> {request.requested_datetime}</p>
                <hr>
                <p>Please log in to the staff dashboard to manage this request.</p>
            </body>
            </html>
            """
            
            notification_service.send_email(
                to=department_email,
                subject=subject,
                body_html=body_html
            )
            
            return {"status": "sent", "to": department_email}
    
    try:
        return run_async(_notify())
    except Exception as e:
        return {"status": "error", "error": str(e)}
