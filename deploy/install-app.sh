#!/bin/bash
# Install application dependencies
# Run as: sudo bash install-app.sh

set -e

APP_DIR="/opt/foreperson"

echo "📦 Installing Foreperson.ai..."

# Backend setup
echo "Setting up Python backend..."
cd $APP_DIR

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install -r requirements.txt

# Initialize database
python -c "from backend.database import init_db; init_db()"

echo "✅ Backend installed"

# Frontend setup
echo "Setting up Next.js frontend..."
cd $APP_DIR/frontend

# Install Node dependencies
npm install

# Build production
npm run build

echo "✅ Frontend built"

# Create environment file if not exists
if [ ! -f $APP_DIR/.env ]; then
    cat > $APP_DIR/.env << 'EOF'
# Foreperson.ai Configuration
SECRET_KEY=change-this-to-a-secure-random-string
DATABASE_PATH=/opt/foreperson/foreperson.db
UPLOAD_DIR=/opt/foreperson/uploads
OPENAI_API_KEY=your-openai-key-optional
EOF
    echo "⚠️  Created .env file - PLEASE UPDATE SECRET_KEY!"
fi

echo "✅ Application installed"
echo ""
echo "📋 Next: Run setup-nginx.sh to configure the web server"
