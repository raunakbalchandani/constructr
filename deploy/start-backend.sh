#!/bin/bash
# Wrapper script to start backend with environment variables loaded
# This script loads .env and starts uvicorn

cd /opt/foreperson

# Load environment variables from .env file
if [ -f /opt/foreperson/.env ]; then
    export $(cat /opt/foreperson/.env | grep -v '^#' | xargs)
fi

# Start uvicorn with the loaded environment
exec /opt/foreperson/venv/bin/uvicorn backend.api:app --host 127.0.0.1 --port 8000
