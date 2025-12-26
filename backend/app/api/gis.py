"""
GIS and Geocoding API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import json

from app.db.session import get_db
from app.models import User, SystemSecret, SystemSettings
from app.core.auth import get_current_admin, get_current_staff
from app.services.geocoding import (
    GeocodingService, BoundaryService,
    get_geocoding_service, get_boundary_service
)

router = APIRouter()


async def get_google_api_key(db: AsyncSession) -> Optional[str]:
    """Get Google Maps API key from secrets"""
    result = await db.execute(
        select(SystemSecret).where(SystemSecret.key_name == "GOOGLE_MAPS_API_KEY")
    )
    secret = result.scalar_one_or_none()
    return secret.key_value if secret and secret.is_configured else None


@router.get("/geocode")
async def geocode_address(
    address: str,
    db: AsyncSession = Depends(get_db)
):
    """Geocode an address to coordinates"""
    api_key = await get_google_api_key(db)
    service = get_geocoding_service(api_key)
    
    result = await service.geocode(address)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not geocode address"
        )
    
    return {
        "lat": result.lat,
        "lng": result.lng,
        "formatted_address": result.formatted_address,
        "place_id": result.place_id
    }


@router.get("/reverse-geocode")
async def reverse_geocode(
    lat: float,
    lng: float,
    db: AsyncSession = Depends(get_db)
):
    """Convert coordinates to address"""
    api_key = await get_google_api_key(db)
    service = get_geocoding_service(api_key)
    
    result = await service.reverse_geocode(lat, lng)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not reverse geocode coordinates"
        )
    
    return {
        "lat": result.lat,
        "lng": result.lng,
        "formatted_address": result.formatted_address
    }


@router.get("/boundaries")
async def list_boundaries(
    db: AsyncSession = Depends(get_db)
):
    """List all configured boundaries"""
    api_key = await get_google_api_key(db)
    service = get_boundary_service(api_key)
    
    boundaries = service.get_all_boundaries()
    return [
        {
            "name": b.name,
            "bounds": b.bounds
        }
        for b in boundaries
    ]


@router.get("/boundaries/{name}")
async def get_boundary(
    name: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific boundary with full geometry"""
    api_key = await get_google_api_key(db)
    service = get_boundary_service(api_key)
    
    boundary = service.get_boundary(name)
    if not boundary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Boundary not found"
        )
    
    return {
        "name": boundary.name,
        "geometry": boundary.geometry,
        "bounds": boundary.bounds
    }


@router.post("/boundaries")
async def upload_boundary(
    name: str,
    file: UploadFile = File(...),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Upload a GeoJSON boundary file (admin only)"""
    try:
        content = await file.read()
        geojson = json.loads(content.decode())
        
        api_key = await get_google_api_key(db)
        service = get_boundary_service(api_key)
        service.load_boundary_from_geojson(name, geojson)
        
        return {"status": "success", "message": f"Boundary '{name}' loaded"}
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GeoJSON file"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/check-boundary")
async def check_point_in_boundary(
    lat: float,
    lng: float,
    boundary_name: str,
    db: AsyncSession = Depends(get_db)
):
    """Check if a point is within a boundary"""
    api_key = await get_google_api_key(db)
    service = get_boundary_service(api_key)
    
    is_inside = service.point_in_boundary(lat, lng, boundary_name)
    
    return {
        "lat": lat,
        "lng": lng,
        "boundary": boundary_name,
        "is_inside": is_inside
    }


@router.get("/config")
async def get_maps_config(db: AsyncSession = Depends(get_db)):
    """Get maps configuration for frontend"""
    api_key = await get_google_api_key(db)
    
    # Get township settings for default center
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()
    
    return {
        "has_google_maps": bool(api_key),
        "google_maps_api_key": api_key if api_key else None,
        "default_center": {
            "lat": 40.4168,  # Default to a central location
            "lng": -74.5430
        },
        "default_zoom": 12
    }
