#!/bin/bash

# One-Command Township Setup Script
# Usage: ./scripts/quick_setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "================================================="
echo "Township 311 - Quick Setup"
echo "================================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    exit 1
fi

echo "✅ Docker is installed"
echo ""

# Navigate to infrastructure directory
cd "$PROJECT_ROOT/infrastructure"

# Create flags directory for system updates
mkdir -p "$PROJECT_ROOT/flags"
echo "✅ Created flags directory"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        cat > .env <<EOF
# Township 311 Configuration
APP_DOMAIN=localhost
ADMIN_API_KEY=$(openssl rand -hex 32)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/township
REDIS_URL=redis://redis:6379/0
JWT_SECRET_KEY=$(openssl rand -hex 32)
EOF
    fi
    echo "✅ Created .env file"
else
    echo "✅ .env file already exists"
fi
echo ""

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
docker compose down 2>/dev/null || true
echo ""

# Start services
echo "🚀 Starting all services..."
docker compose up -d --build
echo ""

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 15

MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker compose exec -T db pg_isready -U postgres &>/dev/null; then
        echo "✅ Database is ready"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Waiting... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "❌ Database failed to start"
    exit 1
fi
echo ""

# Run migrations
echo "🔄 Running database migrations..."
docker compose exec -T backend alembic upgrade head
echo "✅ Migrations complete"
echo ""

# Check if admin user exists
echo "👤 Checking for admin user..."
ADMIN_EXISTS=$(docker compose exec -T db psql -U postgres -d township -tAc "SELECT COUNT(*) FROM users WHERE role = 'admin';" 2>/dev/null || echo "0")

if [ "$ADMIN_EXISTS" = "0" ] || [ -z "$ADMIN_EXISTS" ]; then
    echo "📝 Creating initial admin user..."
    echo ""
    echo "Enter admin email (default: admin@township.local):"
    read -r ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@township.local}
    
    echo "Enter admin password (default: admin123):"
    read -sr ADMIN_PASSWORD
    echo ""
    ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
    
    # Create admin user via API
    docker compose exec -T backend python -c "
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash

async def create_admin():
    async with AsyncSessionLocal() as session:
        admin = User(
            email='$ADMIN_EMAIL',
            hashed_password=get_password_hash('$ADMIN_PASSWORD'),
            display_name='System Administrator',
            role=UserRole.admin,
            is_active=True
        )
        session.add(admin)
        await session.commit()
        print('✅ Admin user created')

asyncio.run(create_admin())
" 2>&1 | grep -v "Warning" || echo "✅ Admin user created (or already exists)"
    
    echo ""
    echo "✅ Admin credentials:"
    echo "   Email: $ADMIN_EMAIL"
    echo "   Password: $ADMIN_PASSWORD"
else
    echo "✅ Admin user already exists"
fi
echo ""

# Check container status
echo "📊 Container Status:"
docker compose ps
echo ""

# Get server IP
SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || curl -s http://ifconfig.me 2>/dev/null || echo "localhost")

echo "================================================="
echo "✅ Setup Complete!"
echo "================================================="
echo ""
echo "🌐 Access your Township portal:"
echo "   http://$SERVER_IP"
echo "   or http://localhost (if local)"
echo ""
echo "🔧 Admin Portal:"
echo "   Navigate to: /admin"
echo "   Everything can now be configured through the UI!"
echo ""
echo "📋 Next Steps:"
echo "   1. Log in with your admin credentials"
echo "   2. Go to Admin Console"
echo "   3. Configure:"
echo "      • Runtime Config (Google Maps API key, etc.)"
echo "      • Branding & Logo"
echo "      • Departments"
echo "      • Issue Categories"
echo "      • Staff Accounts"
echo ""
echo "🔄 System Updates:"
echo "   Use the 'System Maintenance' section in Admin Console"
echo "   Click 'Update Now' to pull latest code and restart"
echo ""
echo "📊 Useful Commands:"
echo "   View logs:      cd ~/township/infrastructure && docker compose logs -f"
echo "   Restart:        cd ~/township/infrastructure && docker compose restart"
echo "   Stop:           cd ~/township/infrastructure && docker compose down"
echo "   Update code:    cd ~/township && git pull && cd infrastructure && docker compose up -d --build"
echo ""
echo "🔧 Troubleshooting:"
echo "   Check status:   docker compose ps"
echo "   View logs:      docker compose logs backend --tail=50"
echo "   Database:       docker compose exec db psql -U postgres -d township"
echo ""

# Ask about starting update watcher
echo "Would you like to start the system update watcher? (y/N)"
echo "(This allows updates from the Admin Portal)"
read -r START_WATCHER

if [ "$START_WATCHER" = "y" ] || [ "$START_WATCHER" = "Y" ]; then
    echo ""
    echo "🔄 Starting update watcher in background..."
    
    # Create systemd service if possible
    if command -v systemctl &> /dev/null && [ -w /etc/systemd/system ]; then
        sudo tee /etc/systemd/system/township-watcher.service > /dev/null <<EOF
[Unit]
Description=Township Update Watcher
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_ROOT
ExecStart=$PROJECT_ROOT/scripts/watch_updates.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable township-watcher
        sudo systemctl start township-watcher
        
        echo "✅ Update watcher installed as systemd service"
        echo "   Status: sudo systemctl status township-watcher"
        echo "   Logs:   sudo journalctl -u township-watcher -f"
    else
        # Run in background with nohup
        nohup "$PROJECT_ROOT/scripts/watch_updates.sh" > "$PROJECT_ROOT/update-watcher.log" 2>&1 &
        echo $! > "$PROJECT_ROOT/update-watcher.pid"
        echo "✅ Update watcher started in background"
        echo "   PID: $(cat $PROJECT_ROOT/update-watcher.pid)"
        echo "   Logs: tail -f $PROJECT_ROOT/update-watcher.log"
    fi
else
    echo ""
    echo "ℹ️  To start the update watcher later:"
    echo "   $PROJECT_ROOT/scripts/watch_updates.sh"
fi

echo ""
echo "🎉 Your Township 311 system is ready!"
echo "================================================="
