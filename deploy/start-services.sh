#!/bin/bash
# Start Foreperson.ai services with Supervisor
# Run as: sudo bash start-services.sh

set -e

echo "🚀 Starting Foreperson.ai services..."

# Copy supervisor config
cp /opt/foreperson/deploy/supervisor.conf /etc/supervisor/conf.d/foreperson.conf

# Load environment
if [ -f /opt/foreperson/.env ]; then
    export $(cat /opt/foreperson/.env | grep -v '^#' | xargs)
fi

# Reload supervisor
supervisorctl reread
supervisorctl update

# Start services
supervisorctl start foreperson:*

echo "✅ Services started"
echo ""
echo "📊 Check status with: sudo supervisorctl status"
echo "📋 View logs with: tail -f /opt/foreperson/logs/*.log"
