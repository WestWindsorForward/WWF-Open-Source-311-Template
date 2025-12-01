#!/bin/bash

# Watch for update requests and trigger system updates
# This script should be run on the host machine (not inside a container)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FLAGS_DIR="$PROJECT_ROOT/flags"
UPDATE_FLAG="$FLAGS_DIR/update_requested"
INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"

echo "Starting update watcher..."
echo "Watching for flag file: $UPDATE_FLAG"
echo "Project root: $PROJECT_ROOT"

# Create flags directory if it doesn't exist
mkdir -p "$FLAGS_DIR"

while true; do
  if [ -f "$UPDATE_FLAG" ]; then
    echo "================================================="
    echo "Update requested at $(date)"
    echo "================================================="
    
    # Delete the flag file first
    rm -f "$UPDATE_FLAG"
    echo "Removed flag file"
    
    # Navigate to project root
    cd "$PROJECT_ROOT" || {
      echo "ERROR: Could not change to project root directory"
      sleep 5
      continue
    }
    
    # Pull latest code
    echo "Pulling latest code from git..."
    if git pull; then
      echo "Git pull successful"
    else
      echo "ERROR: Git pull failed"
      sleep 5
      continue
    fi
    
    # Navigate to infrastructure directory
    cd "$INFRASTRUCTURE_DIR" || {
      echo "ERROR: Could not change to infrastructure directory"
      sleep 5
      continue
    }
    
    # Rebuild and restart services
    echo "Rebuilding and restarting Docker services..."
    if docker compose up -d --build; then
      echo "Docker services restarted successfully"
    else
      echo "ERROR: Docker compose failed"
      sleep 5
      continue
    fi
    
    # Run database migrations
    echo "Running database migrations..."
    if docker compose exec -T backend alembic upgrade head; then
      echo "Database migrations completed successfully"
    else
      echo "WARNING: Database migrations failed (may be normal if no migrations)"
    fi
    
    echo "================================================="
    echo "Update completed at $(date)"
    echo "================================================="
  fi
  
  # Wait 5 seconds before checking again
  sleep 5
done
