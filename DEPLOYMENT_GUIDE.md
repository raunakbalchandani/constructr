# Foreperson.ai Deployment Guide

Complete guide to deploy Foreperson.ai on AWS EC2 with Cloudflare DNS.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Cloudflare    │────▶│   EC2        │────▶│   SQLite DB     │
│   (DNS + SSL)   │     │   (t2.micro) │     │   (local file)  │
└─────────────────┘     └──────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │   Uploads    │
                        │   (local)    │
                        └──────────────┘
```

## Cost Estimate

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| EC2 t2.micro | 12 months free | ~$8.50/month |
| Storage (30GB EBS) | 12 months free | ~$3/month |
| Cloudflare DNS | Always free | Free |
| **Total** | **$0** | **~$12/month** |

---

## Step 1: Create EC2 Instance

### 1.1 Launch Instance

1. Go to AWS Console → EC2 → **Launch Instance**
2. Configure:
   - **Name**: `foreperson-ai`
   - **AMI**: Ubuntu Server 22.04 LTS (Free tier eligible)
   - **Instance type**: `t2.micro` (Free tier)
   - **Key pair**: Create new or select existing
   - **Network**: Allow SSH (22), HTTP (80), HTTPS (443)
   - **Storage**: 30 GB (Free tier max)

3. Click **Launch Instance**

### 1.2 Connect to Instance

```bash
# Make key file secure
chmod 400 your-key.pem

# Connect via SSH
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## Step 2: Configure Cloudflare DNS

### 2.1 Add Domain to Cloudflare (if not done)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Add a Site** → Enter `foreperson.ai`
3. Select **Free** plan
4. Update your domain registrar's nameservers to Cloudflare's

### 2.2 Create DNS Records

In Cloudflare Dashboard → DNS → Records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | YOUR_EC2_PUBLIC_IP | ✅ Proxied |
| A | www | YOUR_EC2_PUBLIC_IP | ✅ Proxied |

### 2.3 SSL/TLS Settings

Go to SSL/TLS → Overview:
- Set encryption mode to **Full (strict)**

Go to SSL/TLS → Edge Certificates:
- Enable **Always Use HTTPS**
- Enable **Automatic HTTPS Rewrites**

---

## Step 3: Deploy Application

### 3.1 Initial Server Setup

```bash
# On EC2 instance
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y python3.11 python3.11-venv python3-pip nginx certbot python3-certbot-nginx git supervisor

# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Create app user and directory
sudo useradd -m -s /bin/bash foreperson
sudo mkdir -p /opt/foreperson
sudo chown foreperson:foreperson /opt/foreperson
```

### 3.2 Upload Your Code

**Option A: Git Clone** (if you have a repo)
```bash
cd /opt/foreperson
sudo -u foreperson git clone YOUR_REPO_URL .
```

**Option B: SCP Upload** (from your local machine)
```bash
# From your local machine
scp -i your-key.pem -r /path/to/foreperson-local/* ubuntu@YOUR_EC2_IP:/tmp/foreperson/
ssh -i your-key.pem ubuntu@YOUR_EC2_IP "sudo cp -r /tmp/foreperson/* /opt/foreperson/ && sudo chown -R foreperson:foreperson /opt/foreperson"
```

### 3.3 Install Application

```bash
cd /opt/foreperson

# Create virtual environment
sudo -u foreperson python3.11 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install -r requirements.txt

# Initialize database
python -c "from backend.database import init_db; init_db()"

# Setup frontend
cd frontend
sudo -u foreperson npm install
sudo -u foreperson npm run build
cd ..
```

### 3.4 Configure Environment

```bash
# Create .env file
sudo -u foreperson cat > /opt/foreperson/.env << 'EOF'
SECRET_KEY=GENERATE_A_RANDOM_64_CHAR_STRING_HERE
DATABASE_PATH=/opt/foreperson/foreperson.db
UPLOAD_DIR=/opt/foreperson/uploads
OPENAI_API_KEY=your-openai-key-if-you-have-one
EOF

# Create upload directory
sudo -u foreperson mkdir -p /opt/foreperson/uploads
sudo -u foreperson mkdir -p /opt/foreperson/logs
```

**Generate Secret Key:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 3.5 Configure Nginx

```bash
# Create Nginx config
sudo tee /etc/nginx/sites-available/foreperson << 'EOF'
server {
    listen 80;
    server_name foreperson.ai www.foreperson.ai;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/foreperson /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 3.6 Configure Supervisor

```bash
# Create supervisor config
sudo tee /etc/supervisor/conf.d/foreperson.conf << 'EOF'
[program:foreperson-backend]
command=/opt/foreperson/venv/bin/uvicorn backend.api:app --host 127.0.0.1 --port 8000
directory=/opt/foreperson
user=foreperson
autostart=true
autorestart=true
stderr_logfile=/opt/foreperson/logs/backend.err.log
stdout_logfile=/opt/foreperson/logs/backend.out.log

[program:foreperson-frontend]
command=/usr/bin/npm start
directory=/opt/foreperson/frontend
user=foreperson
autostart=true
autorestart=true
stderr_logfile=/opt/foreperson/logs/frontend.err.log
stdout_logfile=/opt/foreperson/logs/frontend.out.log
environment=NODE_ENV="production",PORT="3000"

[group:foreperson]
programs=foreperson-backend,foreperson-frontend
EOF

# Start services
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start foreperson:*
```

---

## Step 4: Verify Deployment

### 4.1 Check Services

```bash
# Check status
sudo supervisorctl status

# Should show:
# foreperson:foreperson-backend   RUNNING
# foreperson:foreperson-frontend  RUNNING

# Check health
curl http://localhost:8000/health
# Should return: {"status":"healthy","service":"foreperson-api"}
```

### 4.2 Test Website

1. Visit `https://foreperson.ai` in your browser
2. You should see the landing page
3. Test signup/login functionality
4. Test document upload

---

## Maintenance Commands

```bash
# View logs
tail -f /opt/foreperson/logs/*.log

# Restart services
sudo supervisorctl restart foreperson:*

# Stop services
sudo supervisorctl stop foreperson:*

# Update code
cd /opt/foreperson
git pull  # if using git
sudo supervisorctl restart foreperson:*

# Database backup
cp /opt/foreperson/foreperson.db /opt/foreperson/backups/foreperson-$(date +%Y%m%d).db
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check supervisor logs
sudo tail -f /var/log/supervisor/supervisord.log

# Check app logs
sudo tail -f /opt/foreperson/logs/*.log
```

### Nginx Errors

```bash
# Test config
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R foreperson:foreperson /opt/foreperson
```

### Database Issues

```bash
# Reinitialize database
cd /opt/foreperson
source venv/bin/activate
python -c "from backend.database import init_db; init_db()"
```

---

## Security Checklist

- [ ] Changed SECRET_KEY in .env
- [ ] SSH key-only access (disabled password auth)
- [ ] Firewall allows only 22, 80, 443
- [ ] Cloudflare proxy enabled (hides EC2 IP)
- [ ] Regular backups configured
- [ ] Logs monitored

---

## Done! 🎉

Your Foreperson.ai is now live at **https://foreperson.ai**
