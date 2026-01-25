#!/bin/bash
# Script to manually update files on EC2
# Run this on your EC2 instance after copying the updated files

echo "🔄 Updating Foreperson.ai application..."

cd /opt/foreperson

# Update backend/api.py (add project_id to ChatRequest)
echo "Updating backend API..."

# Check if project_id already exists in ChatRequest
if ! grep -q "project_id: Optional\[int\]" backend/api.py; then
    echo "Updating ChatRequest model..."
    # This is complex - we'll need to manually update
    echo "⚠️  Please manually update backend/api.py ChatRequest class"
fi

# Rebuild frontend
echo "Rebuilding frontend..."
cd /opt/foreperson/frontend
npm run build

# Copy standalone assets if needed
if [ -d ".next/standalone" ]; then
    echo "Copying standalone assets..."
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
    cp -r public .next/standalone/ 2>/dev/null || true
fi

# Restart services
echo "Restarting services..."
sudo supervisorctl restart foreperson-backend
sudo supervisorctl restart foreperson-frontend

echo "✅ Update complete!"
echo "Check status: sudo supervisorctl status"
