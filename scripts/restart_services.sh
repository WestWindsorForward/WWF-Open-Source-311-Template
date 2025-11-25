#!/bin/bash

# Emergency restart script for when the site is down
# This will restart all services and check their status

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infrastructure"

echo "================================================="
echo "Emergency Service Restart Script"
echo "================================================="
echo ""

cd "$INFRA_DIR"

echo "Step 1: Checking current container status..."
docker compose ps
echo ""

echo "Step 2: Stopping all services..."
docker compose down
echo ""

echo "Step 3: Starting all services..."
docker compose up -d
echo ""

echo "Step 4: Waiting for services to start (15 seconds)..."
sleep 15
echo ""

echo "Step 5: Checking container status..."
docker compose ps
echo ""

echo "Step 6: Checking Caddy logs..."
docker compose logs caddy --tail=30
echo ""

echo "Step 7: Checking backend logs..."
docker compose logs backend --tail=30
echo ""

echo "================================================="
echo "Services restarted!"
echo "================================================="
echo ""
echo "If you see 'healthy' or 'running' status above, the site should be back online."
echo "Wait 1-2 minutes for Caddy to generate SSL certificates."
echo ""
echo "Test your site: https://311.westwindsorforward.org"
echo ""
