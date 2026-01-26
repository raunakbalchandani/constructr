#!/bin/bash
# Deployment script for Construction-Specific OCR
# Run this on your EC2 instance

set -e  # Exit on error

echo "=== Deploying Construction-Specific OCR ==="
echo ""

# Step 1: Install Tesseract OCR
echo "Step 1: Installing Tesseract OCR..."
sudo apt-get update -qq
sudo apt-get install -y tesseract-ocr

# Verify Tesseract installation
if command -v tesseract &> /dev/null; then
    echo "✓ Tesseract installed: $(tesseract --version | head -n1)"
else
    echo "✗ Tesseract installation failed!"
    exit 1
fi

# Step 2: Install Python dependencies
echo ""
echo "Step 2: Installing Python dependencies..."
cd /opt/foreperson

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✓ Virtual environment activated"
elif [ -d ".venv" ]; then
    source .venv/bin/activate
    echo "✓ Virtual environment activated"
else
    echo "⚠ No virtual environment found, using system Python"
fi

# Install/upgrade OCR packages
pip install --upgrade pytesseract==0.3.10 Pillow==10.2.0 --quiet

# Verify Python imports
echo ""
echo "Step 3: Verifying Python dependencies..."
python3 -c "import pytesseract; from PIL import Image; print('✓ OCR dependencies OK')" || {
    echo "✗ Python dependencies verification failed!"
    exit 1
}

# Step 4: Restart backend service
echo ""
echo "Step 4: Restarting backend service..."
sudo supervisorctl restart foreperson-backend

# Wait a moment for service to start
sleep 3

# Check status
echo ""
echo "Step 5: Checking service status..."
sudo supervisorctl status foreperson-backend

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "1. Check logs: tail -f /opt/foreperson/logs/backend.out.log"
echo "2. Upload a scanned construction drawing to test OCR"
echo "3. Verify document type detection improved"
echo ""
echo "To monitor OCR processing:"
echo "  tail -f /opt/foreperson/logs/backend.out.log | grep -i ocr"
