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
    _: User = Depends(get_current_admin)
):
    """Configure a custom domain with Nginx and SSL certificate"""
    import re
    
    # Validate domain format
    domain = domain.strip().lower()
    domain_regex = r'^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$'
    if not re.match(domain_regex, domain):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid domain format"
        )
    
    # Nginx config template
    nginx_config = f"""
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
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }}
    
    location /api {{
        proxy_pass http://backend:8000/api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""
    
    config_path = f"/etc/nginx/conf.d/{domain}.conf"
    certbot_webroot = "/var/www/certbot"
    
    steps_completed = []
    
    try:
        # Step 1: Create webroot directory for certbot
        subprocess.run(
            ["sudo", "mkdir", "-p", certbot_webroot],
            check=True, timeout=10
        )
        steps_completed.append("Created certbot webroot")
        
        # Step 2: Write a temporary HTTP-only config for initial certificate request
        temp_config = f"""
server {{
    listen 80;
    server_name {domain} www.{domain};
    
    location /.well-known/acme-challenge/ {{
        root /var/www/certbot;
    }}
    
    location / {{
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }}
}}
"""
        # Write temp config
        temp_path = f"/tmp/{domain}.conf"
        with open(temp_path, 'w') as f:
            f.write(temp_config)
        
        subprocess.run(
            ["sudo", "cp", temp_path, config_path],
            check=True, timeout=10
        )
        steps_completed.append("Created temporary Nginx config")
        
        # Step 3: Test and reload Nginx
        subprocess.run(
            ["sudo", "nginx", "-t"],
            check=True, timeout=10
        )
        subprocess.run(
            ["sudo", "nginx", "-s", "reload"],
            check=True, timeout=10
        )
        steps_completed.append("Nginx config validated and reloaded")
        
        # Step 4: Request SSL certificate
        certbot_result = subprocess.run(
            [
                "sudo", "certbot", "certonly", "--webroot",
                "-w", certbot_webroot,
                "-d", domain,
                "-d", f"www.{domain}",
                "--non-interactive",
                "--agree-tos",
                "--email", "admin@" + domain,
                "--expand"
            ],
            capture_output=True, text=True, timeout=120
        )
        
        if certbot_result.returncode != 0:
            # Certbot failed - return info
            return {
                "status": "partial",
                "message": "Domain configured but SSL certificate request failed. DNS may not be propagated yet.",
                "steps_completed": steps_completed,
                "ssl_error": certbot_result.stderr,
                "next_steps": [
                    "Ensure DNS A record points to 132.226.32.116",
                    "Wait for DNS propagation (5-30 minutes)",
                    "Try again by clicking 'Configure SSL' button"
                ]
            }
        
        steps_completed.append("SSL certificate obtained")
        
        # Step 5: Write final HTTPS config
        with open(temp_path, 'w') as f:
            f.write(nginx_config)
        
        subprocess.run(
            ["sudo", "cp", temp_path, config_path],
            check=True, timeout=10
        )
        steps_completed.append("Updated Nginx with HTTPS config")
        
        # Step 6: Final reload
        subprocess.run(
            ["sudo", "nginx", "-t"],
            check=True, timeout=10
        )
        subprocess.run(
            ["sudo", "nginx", "-s", "reload"],
            check=True, timeout=10
        )
        steps_completed.append("Nginx reloaded with HTTPS")
        
        return {
            "status": "success",
            "message": f"Domain {domain} configured successfully with SSL!",
            "steps_completed": steps_completed,
            "url": f"https://{domain}"
        }
        
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Command failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/domain/status")
async def get_domain_status(
    _: User = Depends(get_current_admin)
):
    """Get current domain configuration status"""
    try:
        # Check for custom domain configs
        result = subprocess.run(
            ["ls", "/etc/nginx/conf.d/"],
            capture_output=True, text=True, timeout=10
        )
        
        custom_domains = []
        for filename in result.stdout.strip().split('\n'):
            if filename and filename.endswith('.conf') and filename != 'default.conf':
                domain = filename.replace('.conf', '')
                
                # Check if SSL cert exists
                cert_path = f"/etc/letsencrypt/live/{domain}/fullchain.pem"
                has_ssl = os.path.exists(cert_path)
                
                custom_domains.append({
                    "domain": domain,
                    "has_ssl": has_ssl,
                    "config_file": f"/etc/nginx/conf.d/{filename}"
                })
        
        return {
            "configured_domains": custom_domains,
            "server_ip": "132.226.32.116"
        }
    except Exception as e:
        return {
            "configured_domains": [],
            "server_ip": "132.226.32.116",
            "error": str(e)
        }
