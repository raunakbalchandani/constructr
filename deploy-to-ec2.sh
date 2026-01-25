#!/bin/bash
# Deployment script - Run from your LOCAL machine
# Usage: ./deploy-to-ec2.sh YOUR_EC2_IP

EC2_IP=${1:-"YOUR_EC2_IP"}
EC2_USER="ubuntu"
EC2_PATH="/opt/foreperson"

if [ "$EC2_IP" == "YOUR_EC2_IP" ]; then
    echo "❌ Please provide your EC2 IP address"
    echo "Usage: ./deploy-to-ec2.sh YOUR_EC2_IP"
    exit 1
fi

echo "🚀 Deploying to EC2 ($EC2_IP)..."

# Copy backend files
echo "📦 Copying backend files..."
scp backend/api.py ${EC2_USER}@${EC2_IP}:${EC2_PATH}/backend/api.py

# Copy frontend files
echo "📦 Copying frontend files..."
scp -r frontend/src ${EC2_USER}@${EC2_IP}:${EC2_PATH}/frontend/

# Copy package.json if changed
scp frontend/package.json ${EC2_USER}@${EC2_IP}:${EC2_PATH}/frontend/package.json 2>/dev/null || true

echo "📦 Rebuilding frontend on EC2..."
ssh ${EC2_USER}@${EC2_IP} << 'ENDSSH'
cd /opt/foreperson/frontend
npm install
npm run build

# Copy standalone assets
if [ -d ".next/standalone" ]; then
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
    cp -r public .next/standalone/ 2>/dev/null || true
fi

# Restart services
sudo supervisorctl restart foreperson-backend
sudo supervisorctl restart foreperson-frontend

echo "✅ Deployment complete!"
sudo supervisorctl status
ENDSSH

echo "✅ Deployment finished!"
