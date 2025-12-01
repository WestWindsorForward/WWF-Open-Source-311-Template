# Township 311 - Quick Start Guide

## One-Command Setup

```bash
git clone <your-repo-url> ~/township
cd ~/township
./scripts/quick_setup.sh
```

That's it! The script will:
- ✅ Install and configure everything
- ✅ Create the database
- ✅ Set up an admin user
- ✅ Start all services
- ✅ Optionally start the update watcher

## After Setup

1. **Access your site**: `http://YOUR_SERVER_IP`
2. **Login to Admin Console**: Click "Admin Console" or go to `/admin`
3. **Configure everything through the UI**:
   - Google Maps API key
   - Branding & colors
   - Departments
   - Issue categories
   - Staff accounts

## Configure From Admin Portal

### Runtime Config (Required First!)
1. Go to: Admin Console → Runtime Config
2. Add your Google Maps API key
3. Configure other settings as needed
4. Click "Save Runtime Config"

### Branding
1. Go to: Admin Console → Branding & Logo
2. Set town name, colors, hero text
3. Upload logo and favicon
4. Click "Save Branding"

### Departments
1. Go to: Admin Console → Departments
2. Add departments (e.g., "Public Works", "Police")
3. Each department can have contact info

### Issue Categories
1. Go to: Admin Console → Issue Categories
2. Add categories (e.g., "Pothole", "Streetlight Out")
3. Assign to departments

### Staff Accounts
1. Go to: Admin Console → Staff Directory
2. Add staff members
3. Assign to departments
4. Set roles (admin/staff/resident)

## System Updates

Updates can be triggered from the Admin Portal:

1. Go to: Admin Console → System Maintenance
2. Click "Update Now"
3. The system will:
   - Pull latest code from git
   - Rebuild containers
   - Run database migrations
   - Restart automatically

**Note**: The update watcher must be running (setup script asks about this)

## Troubleshooting

### Check Logs
```bash
cd ~/township/infrastructure
docker compose logs backend -f
```

### Restart Services
```bash
cd ~/township/infrastructure
docker compose restart
```

### Check Database
```bash
cd ~/township/infrastructure
docker compose exec db psql -U postgres -d township
```

### Verify Configuration Saved
```bash
# Check if settings are in database
docker compose exec -T db psql -U postgres -d township -c "SELECT key, value FROM township_settings;"
```

## Manual Commands (If Needed)

These should NOT be needed in normal operation:

### Pull Latest Code
```bash
cd ~/township
git pull
cd infrastructure
docker compose up -d --build
```

### Reset Everything
```bash
cd ~/township/infrastructure
docker compose down -v  # WARNING: Deletes all data!
cd ~/township
./scripts/quick_setup.sh
```

## Support

If something isn't working:

1. Check logs: `docker compose logs backend --tail=100`
2. Check container status: `docker compose ps`
3. Verify database has data: See "Verify Configuration Saved" above
4. Check browser console (F12) for frontend errors

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: FastAPI + Python
- **Database**: PostgreSQL
- **Cache**: Redis
- **Web Server**: Caddy (automatic HTTPS)
- **Task Queue**: Celery
- **Antivirus**: ClamAV

All configured and managed through the Admin Portal!
