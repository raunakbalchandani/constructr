#!/bin/bash
# EC2 Setup Script for Foreperson.ai
# Run this on a fresh Ubuntu 22.04 EC2 instance

set -e

echo "🚀 Setting up Foreperson.ai on EC2..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    nodejs \
    npm \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    supervisor

# Install Node 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Create app user
sudo useradd -m -s /bin/bash foreperson || true

# Create app directory
sudo mkdir -p /opt/foreperson
sudo chown foreperson:foreperson /opt/foreperson

echo "✅ System packages installed"

# Create directories
sudo -u foreperson mkdir -p /opt/foreperson/backend
sudo -u foreperson mkdir -p /opt/foreperson/frontend
sudo -u foreperson mkdir -p /opt/foreperson/uploads
sudo -u foreperson mkdir -p /opt/foreperson/logs

echo "✅ Directories created"

echo ""
echo "📋 Next steps:"
echo "1. Copy your code to /opt/foreperson/"
echo "2. Run: sudo bash /opt/foreperson/deploy/install-app.sh"
echo "3. Run: sudo bash /opt/foreperson/deploy/setup-nginx.sh foreperson.ai"
echo ""
