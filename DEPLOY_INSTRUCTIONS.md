# Deployment Instructions

## Quick Deploy to EC2

### Step 1: Push to GitHub (from local machine)
```bash
cd /Users/raunakbalchandani/Downloads/foreperson-local
git add .
git commit -m "Add project management features"
git push
```

### Step 2: Update on EC2 (run these commands on EC2)

```bash
cd /opt/foreperson

# Download the latest code
wget -O repo.zip https://github.com/raunakbalchandani/constructr/archive/refs/heads/main.zip
unzip -o repo.zip
rm repo.zip

# Copy updated files
cp -r constructr-main/backend/api.py backend/api.py
cp -r constructr-main/frontend/src frontend/src/
rm -rf constructr-main

# Rebuild frontend
cd frontend
npm install
npm run build

# Copy standalone assets
if [ -d ".next/standalone" ]; then
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
    cp -r public .next/standalone/ 2>/dev/null || true
fi

# Restart services
cd /opt/foreperson
sudo supervisorctl restart foreperson-backend
sudo supervisorctl restart foreperson-frontend

# Check status
sudo supervisorctl status
```

### Step 3: Verify
```bash
# Check backend logs
tail -20 /opt/foreperson/logs/backend.out.log

# Check frontend logs  
tail -20 /opt/foreperson/logs/frontend.out.log

# Test the site
curl http://localhost:8000/health
```

## Alternative: Manual File Update (if GitHub is not accessible)

If you can't use GitHub, you can manually update the files:

### Update backend/api.py
```bash
cd /opt/foreperson
# You'll need to manually edit backend/api.py to add:
# 1. project_id: Optional[int] = None to ChatRequest class
# 2. Update the chat endpoint to filter by project_id
```

### Update frontend
```bash
cd /opt/foreperson/frontend
# Copy the updated src/app/dashboard/page.tsx file
# Then rebuild:
npm run build
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true
sudo supervisorctl restart foreperson-frontend
```
