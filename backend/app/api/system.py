from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import subprocess
import os

from app.db.session import get_db
from app.models import SystemSettings, SystemSecret, ServiceRequest, User
from app.schemas import (
    SystemSettingsBase, SystemSettingsResponse,
    SecretCreate, SecretUpdate, SecretResponse,
    StatisticsResponse, ServiceRequestResponse
)
from app.core.auth import get_current_admin, get_current_staff

router = APIRouter()


# ============ Settings ============

@router.get("/settings", response_model=SystemSettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Get system settings (public - for branding)"""
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        # Create default settings if none exist
        settings = SystemSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.post("/settings", response_model=SystemSettingsResponse)
async def update_settings(
    settings_data: SystemSettingsBase,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """Update system settings (admin only)"""
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = SystemSettings()
        db.add(settings)
    
    for field, value in settings_data.model_dump().items():
        setattr(settings, field, value)
    
    await db.commit()
    await db.refresh(settings)
    return settings


# ============ Secrets ============

@router.get("/secrets", response_model=List[SecretResponse])
async def list_secrets(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """List all secrets (admin only). Non-sensitive config values are returned."""
    # These keys can have their values exposed (they're config choices, not secrets)
    SAFE_TO_RETURN = {'SMS_PROVIDER', 'EMAIL_ENABLED', 'SMTP_USE_TLS', 'SMTP_PORT'}
    
    result = await db.execute(select(SystemSecret))
    secrets = result.scalars().all()
    
    response = []
    for secret in secrets:
        data = SecretResponse.model_validate(secret)
        # Only include key_value for non-sensitive config options
        if secret.key_name in SAFE_TO_RETURN and secret.is_configured:
            data.key_value = secret.key_value
        response.append(data)
    
    return response


@router.post("/secrets", response_model=SecretResponse)
async def create_or_update_secret(
    secret_data: SecretCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """Create or update a secret (admin only)"""
    result = await db.execute(
        select(SystemSecret).where(SystemSecret.key_name == secret_data.key_name)
    )
    secret = result.scalar_one_or_none()
    
    if secret:
        secret.key_value = secret_data.key_value
        secret.is_configured = bool(secret_data.key_value)
    else:
        secret = SystemSecret(
            key_name=secret_data.key_name,
            key_value=secret_data.key_value,
            description=secret_data.description,
            is_configured=bool(secret_data.key_value)
        )
        db.add(secret)
    
    await db.commit()
    await db.refresh(secret)
    return secret


@router.post("/secrets/sync")
async def sync_secrets(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """Add any missing secrets from the default list (admin only)"""
    from app.db.init_db import DEFAULT_SECRETS
    
    added = []
    for secret_data in DEFAULT_SECRETS:
        result = await db.execute(
            select(SystemSecret).where(SystemSecret.key_name == secret_data["key_name"])
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            secret = SystemSecret(
                key_name=secret_data["key_name"],
                description=secret_data.get("description", ""),
                is_configured=False
            )
            db.add(secret)
            added.append(secret_data["key_name"])
    
    await db.commit()
    return {"status": "success", "added_secrets": added, "count": len(added)}


# ============ Statistics ============

@router.get("/statistics", response_model=StatisticsResponse)
async def get_statistics(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_staff)
):
    """Get system statistics (staff only)"""
    # Total counts by status
    total = await db.execute(select(func.count(ServiceRequest.id)))
    total_count = total.scalar() or 0
    
    open_result = await db.execute(
        select(func.count(ServiceRequest.id)).where(ServiceRequest.status == "open")
    )
    open_count = open_result.scalar() or 0
    
    in_progress_result = await db.execute(
        select(func.count(ServiceRequest.id)).where(ServiceRequest.status == "in_progress")
    )
    in_progress_count = in_progress_result.scalar() or 0
    
    closed_result = await db.execute(
        select(func.count(ServiceRequest.id)).where(ServiceRequest.status == "closed")
    )
    closed_count = closed_result.scalar() or 0
    
    # Requests by category
    category_result = await db.execute(
        select(ServiceRequest.service_name, func.count(ServiceRequest.id))
        .group_by(ServiceRequest.service_name)
    )
    requests_by_category = {row[0]: row[1] for row in category_result.all()}
    
    # Recent requests
    recent_result = await db.execute(
        select(ServiceRequest)
        .order_by(ServiceRequest.requested_datetime.desc())
        .limit(10)
    )
    recent_requests = recent_result.scalars().all()
    
    return StatisticsResponse(
        total_requests=total_count,
        open_requests=open_count,
        in_progress_requests=in_progress_count,
        closed_requests=closed_count,
        requests_by_category=requests_by_category,
        requests_by_status={
            "open": open_count,
            "in_progress": in_progress_count,
            "closed": closed_count
        },
        recent_requests=recent_requests
    )


# ============ System Update ============

@router.post("/update")
async def update_system(_: User = Depends(get_current_admin)):
    """Pull updates from GitHub (admin only). Code changes reload automatically."""
    try:
        # Get the project root
        project_root = os.environ.get("PROJECT_ROOT", "/project")
        
        # Add safe directory to fix ownership issues in Docker
        subprocess.run(
            ["git", "config", "--global", "--add", "safe.directory", project_root],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # Pull latest code
        pull_result = subprocess.run(
            ["git", "pull", "origin", "main"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if pull_result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Git pull failed: {pull_result.stderr}"
            )
        
        # Check what was updated
        git_output = pull_result.stdout.strip()
        
        # Determine if restart is needed
        needs_restart = any(x in git_output.lower() for x in [
            'requirements.txt', 'dockerfile', 'docker-compose', 'package.json'
        ])
        
        return {
            "status": "success",
            "message": "Updates pulled successfully. " + (
                "Container restart may be needed for dependency changes." 
                if needs_restart 
                else "Code changes will reload automatically."
            ),
            "git_output": git_output,
            "needs_restart": needs_restart
        }
    
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Update operation timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============ Custom Domain ============

@router.post("/domain/configure")
async def configure_domain(
    domain: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """Generate Nginx config and setup script for custom domain"""
    import re
    
    # Validate domain format
    domain = domain.strip().lower()
    domain_regex = r'^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$'
    if not re.match(domain_regex, domain):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid domain format"
        )
    
    # Save domain to settings
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()
    if settings:
        settings.custom_domain = domain
        await db.commit()
    
    # Generate Nginx config
    nginx_config = f"""# Nginx config for {domain}
# Save this to: /etc/nginx/conf.d/{domain}.conf

server {{
    listen 80;
    server_name {domain} www.{domain};
    
    location /.well-known/acme-challenge/ {{
        root /var/www/certbot;
    }}
    
    location / {{
        return 301 https://$host$request_uri;
    }}
}}

server {{
    listen 443 ssl http2;
    server_name {domain} www.{domain};
    
    ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;
    
    location / {{
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }}
    
    location /api {{
        proxy_pass http://127.0.0.1:8000/api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""
    
    # Generate setup script
    setup_script = f"""#!/bin/bash
# Domain Setup Script for {domain}
# Run this on your server with: sudo bash setup-{domain}.sh

set -e

DOMAIN="{domain}"
EMAIL="admin@{domain}"

echo "🚀 Setting up domain: $DOMAIN"

# Step 1: Create directories
echo "📁 Creating required directories..."
mkdir -p /var/www/certbot

# Step 2: Create temporary HTTP config for certbot verification
echo "📝 Creating temporary Nginx config..."
cat > /etc/nginx/conf.d/${{DOMAIN}}.conf << 'NGINX_TEMP'
server {{
    listen 80;
    server_name {domain} www.{domain};
    
    location /.well-known/acme-challenge/ {{
        root /var/www/certbot;
    }}
    
    location / {{
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }}
}}
NGINX_TEMP

# Step 3: Test and reload Nginx
echo "🔄 Reloading Nginx..."
nginx -t && nginx -s reload

# Step 4: Get SSL certificate
echo "🔐 Requesting SSL certificate from Let's Encrypt..."
certbot certonly --webroot -w /var/www/certbot -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL

# Step 5: Create final HTTPS config
echo "📝 Creating HTTPS Nginx config..."
cat > /etc/nginx/conf.d/${{DOMAIN}}.conf << 'NGINX_HTTPS'
{nginx_config}
NGINX_HTTPS

# Step 6: Final reload
echo "🔄 Final Nginx reload..."
nginx -t && nginx -s reload

echo ""
echo "✅ SUCCESS! Domain configured with SSL."
echo "🌐 Your site is now available at: https://{domain}"
echo ""
echo "Note: SSL certificates auto-renew via certbot timer."
"""
    
    return {
        "status": "ready",
        "message": f"Configuration generated for {domain}. Run the setup script on your server.",
        "domain": domain,
        "nginx_config": nginx_config,
        "setup_script": setup_script,
        "instructions": [
            f"1. SSH into your server: ssh ubuntu@132.226.32.116",
            f"2. Create the script: nano setup-{domain}.sh",
            f"3. Paste the setup_script content and save",
            f"4. Run: sudo bash setup-{domain}.sh",
            f"5. Visit https://{domain} to verify"
        ]
    }


@router.get("/domain/status")
async def get_domain_status(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """Get current domain configuration status"""
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()
    
    return {
        "custom_domain": settings.custom_domain if settings else None,
        "server_ip": "132.226.32.116"
    }
