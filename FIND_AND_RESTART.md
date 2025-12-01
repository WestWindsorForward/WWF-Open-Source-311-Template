# Find Your Project and Restart Services

## Step 1: Find Where Your Project Is Located

Run these commands on your server to find the project:

```bash
# Try common locations
ls -la ~/township 2>/dev/null && echo "Found at: ~/township"
ls -la ~/311 2>/dev/null && echo "Found at: ~/311"
ls -la ~/westwindsor 2>/dev/null && echo "Found at: ~/westwindsor"
ls -la /opt/township 2>/dev/null && echo "Found at: /opt/township"
ls -la /var/www/township 2>/dev/null && echo "Found at: /var/www/township"

# Search for docker-compose.yml
find ~ -name "docker-compose.yml" 2>/dev/null | grep -v ".git"

# Or search for the infrastructure directory
find ~ -type d -name "infrastructure" 2>/dev/null | grep -v ".git"
```

## Step 2: Once You Find It, Go There

Replace `<PROJECT_DIR>` with the path you found above:

```bash
cd <PROJECT_DIR>
```

For example:
```bash
cd ~/township
# or
cd /opt/township
```

---

## Step 3: Restart All Services

### Option A: Quick Restart (From Project Root)

```bash
# Go to infrastructure directory
cd infrastructure

# Check current status
docker compose ps

# Restart everything
docker compose down
docker compose up -d

# Watch logs
docker compose logs -f
```

### Option B: If You're Not Sure Where You Are

```bash
# Find and go to infrastructure directory
cd $(find ~ -type d -name "infrastructure" -path "*/township/*" 2>/dev/null | head -1)

# Check if you're in the right place
pwd
ls -la

# Should see docker-compose.yml
# If you see it, continue:

docker compose down
docker compose up -d
docker compose ps
```

---

## Quick One-Liner (Try This First!)

This will find your project and restart services automatically:

```bash
INFRA_DIR=$(find ~ -type d -name "infrastructure" -path "*township*" 2>/dev/null | head -1); if [ -n "$INFRA_DIR" ]; then cd "$INFRA_DIR" && echo "Found at: $INFRA_DIR" && docker compose down && docker compose up -d && docker compose ps; else echo "ERROR: Could not find infrastructure directory"; fi
```

---

## Check If Services Are Running

After restarting, check status:

```bash
docker compose ps
```

**Expected output:**
```
NAME                STATUS              PORTS
backend            Up X minutes        0.0.0.0:8000->8000/tcp
caddy              Up X minutes        0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
celery-beat        Up X minutes        
celery-worker      Up X minutes        
clamav             Up X minutes        
db                 Up X minutes        
frontend           Up X minutes        
redis              Up X minutes        
```

---

## View Logs for Errors

```bash
# All services
docker compose logs --tail=100

# Just Caddy (SSL/HTTPS)
docker compose logs caddy --tail=50

# Just Backend (API)
docker compose logs backend --tail=50
```

---

## Still Can't Find the Project?

Try these:

```bash
# Search entire system (may take a minute)
sudo find / -name "docker-compose.yml" -path "*infrastructure*" 2>/dev/null

# Check running containers to get a clue
docker ps

# Check Docker volumes
docker volume ls | grep township
```

---

## If Docker Commands Don't Work

You might need to use `sudo`:

```bash
sudo docker compose ps
sudo docker compose down
sudo docker compose up -d
```

Or you might need to use the older syntax:

```bash
docker-compose ps
docker-compose down
docker-compose up -d
```

---

## After Restart

1. **Wait 1-2 minutes** for all services to start
2. **Check logs**: `docker compose logs -f`
3. **Test site**: Visit https://311.westwindsorforward.org
4. **Check Cloudflare**: Error should be gone

---

## Need More Help?

Share the output of these commands:

```bash
# Where am I?
pwd

# What's here?
ls -la

# Any Docker containers running?
docker ps -a

# Disk space ok?
df -h

# Memory ok?
free -h
```
