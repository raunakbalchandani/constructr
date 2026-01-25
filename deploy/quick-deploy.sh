#!/bin/bash
# Quick deployment script - Run this on EC2
# Make sure you've pushed your changes to GitHub first!

set -e

echo "🚀 Deploying Foreperson.ai updates..."

cd /opt/foreperson

# Download latest code from GitHub
echo "📥 Downloading latest code..."
wget -q -O repo.zip https://github.com/raunakbalchandani/constructr/archive/refs/heads/main.zip
unzip -q -o repo.zip
rm repo.zip

# Backup current files (optional)
echo "💾 Backing up current files..."
mkdir -p /tmp/foreperson-backup-$(date +%Y%m%d-%H%M%S) || true

# Copy updated backend
echo "📦 Updating backend..."
cp constructr-main/backend/api.py backend/api.py

# Copy updated frontend
echo "📦 Updating frontend..."
cp -r constructr-main/frontend/src frontend/src/

# Clean up
rm -rf constructr-main

# Rebuild frontend
echo "🔨 Rebuilding frontend..."
cd frontend
npm install --silent
npm run build

# Copy standalone assets
if [ -d ".next/standalone" ]; then
    echo "📋 Copying standalone assets..."
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
    cp -r public .next/standalone/ 2>/dev/null || true
fi

# Restart services
echo "🔄 Restarting services..."
cd /opt/foreperson
sudo supervisorctl restart foreperson-backend
sudo supervisorctl restart foreperson-frontend

# Wait a moment for services to start
sleep 2

# Check status
echo ""
echo "📊 Service Status:"
sudo supervisorctl status

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Check logs with:"
echo "   tail -f /opt/foreperson/logs/backend.out.log"
echo "   tail -f /opt/foreperson/logs/frontend.out.log"
