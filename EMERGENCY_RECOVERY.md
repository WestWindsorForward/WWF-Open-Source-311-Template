# Emergency Recovery - Site Down (SSL Error 525)

## Issue
Cloudflare shows SSL Error 525 - This means your origin server is not responding on HTTPS (port 443).

## Most Likely Causes
1. Docker containers are stopped/crashed
2. Caddy container is down
3. Server ran out of memory/disk space
4. Firewall blocking port 443

---

## Quick Fix - Run on Your Server

### Option 1: Use the Restart Script (Easiest)

```bash
cd /workspace
./scripts/restart_services.sh
```

### Option 2: Manual Commands

```bash
# Navigate to infrastructure directory
cd /workspace/infrastructure

# Check what's running
docker compose ps

# Check if anything crashed
docker compose ps -a

# View recent logs to see what failed
docker compose logs --tail=100

# Restart everything
docker compose down
docker compose up -d

# Watch logs for errors
docker compose logs -f
```

---

## Diagnostic Commands

### 1. Check Container Status
```bash
cd /workspace/infrastructure
docker compose ps
```

**What to look for:**
- All services should show "Up" or "running"
- If any show "Exit" or "Restarting", there's a problem

### 2. Check Specific Service Logs
```bash
# Caddy (SSL/proxy)
docker compose logs caddy --tail=50

# Backend (API)
docker compose logs backend --tail=50

# Frontend
docker compose logs frontend --tail=50

# Database
docker compose logs db --tail=50
```

### 3. Check System Resources
```bash
# Check disk space
df -h

# Check memory
free -h

# Check if any processes are using too much memory
docker stats --no-stream
```

### 4. Test Local Connectivity
```bash
# Test if backend is responding locally
curl http://localhost:8000/api/health || echo "Backend not responding"

# Test if Caddy is listening on port 443
netstat -tlnp | grep :443 || echo "Nothing listening on port 443"
```

---

## Full System Restart (If above doesn't work)

```bash
cd /workspace/infrastructure

# Stop everything
docker compose down

# Remove old volumes if needed (WARNING: This will reset data)
# docker volume prune -f

# Rebuild and start
docker compose up -d --build

# Watch for startup errors
docker compose logs -f
```

---

## Check Firewall Rules

```bash
# Check if firewall is blocking port 443
sudo iptables -L -n | grep 443

# If using UFW
sudo ufw status

# Allow ports if needed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## If Database Issues

```bash
cd /workspace/infrastructure

# Check database status
docker compose exec db pg_isready -U postgres

# Restart just the database
docker compose restart db

# Wait 10 seconds
sleep 10

# Restart backend to reconnect
docker compose restart backend
```

---

## Quick Health Check After Restart

```bash
# Wait 30 seconds for everything to start
sleep 30

# Check all containers are running
docker compose ps

# Test backend health endpoint
curl -k https://localhost/api/health

# Check Caddy generated certificates
docker compose exec caddy caddy list-certificates
```

---

## Expected Output When Working

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

## Still Not Working?

1. **Check server IP**: Make sure Cloudflare has the correct origin IP
2. **Check DNS**: Verify `311.westwindsorforward.org` points to your server IP
3. **Disable Cloudflare temporarily**: 
   - Set DNS to "DNS only" (gray cloud) to test direct connection
4. **Check server logs**: `journalctl -xe` for system errors

---

## Contact Information

If you need urgent help:
1. Check the logs first: `docker compose logs --tail=200 > /tmp/logs.txt`
2. Check disk space: `df -h`
3. Check memory: `free -h`
4. Save these outputs to share with support
