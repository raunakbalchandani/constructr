# AWS Backend Setup Guide

## Overview

This guide walks you through setting up AWS services for Foreperson.ai:
- **RDS PostgreSQL** - Database for users, projects, documents
- **S3** - File storage for uploaded documents
- **Cognito** - User authentication

**Estimated Time**: 30-45 minutes
**Estimated Cost**: $0/month (free tier) or ~$20-50/month after

---

## Prerequisites

1. AWS Account (create at https://aws.amazon.com/free/)
2. AWS CLI installed (optional but helpful)

---

## Step 1: Create IAM User

1. Go to **AWS Console** → **IAM** → **Users**
2. Click **Create user**
3. Username: `foreperson-app`
4. Click **Next**
5. Select **Attach policies directly**
6. Search and attach these policies:
   - `AmazonRDSFullAccess`
   - `AmazonS3FullAccess`
   - `AmazonCognitoPowerUser`
7. Click **Next** → **Create user**
8. Click on the user → **Security credentials** → **Create access key**
9. Select **Application running outside AWS** → **Next**
10. **Download .csv file** with your credentials

**Save these values:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## Step 2: Create RDS PostgreSQL Database

1. Go to **AWS Console** → **RDS** → **Create database**

2. **Configuration:**
   - Engine: **PostgreSQL**
   - Template: **Free tier** ✅
   - DB instance identifier: `foreperson-db`
   - Master username: `postgres`
   - Master password: (create a strong password)
   - Instance class: `db.t3.micro` (free tier)
   - Storage: 20 GB (free tier)

3. **Connectivity:**
   - Public access: **Yes** (for development)
   - VPC security group: Create new → `foreperson-db-sg`

4. **Additional configuration:**
   - Initial database name: `foreperson`

5. Click **Create database** (takes 5-10 minutes)

6. Once created, click on the database and note:
   - **Endpoint**: `foreperson-db.xxxxxxxxx.us-east-1.rds.amazonaws.com`
   - **Port**: `5432`

7. **Configure Security Group:**
   - Click on the security group link
   - Edit inbound rules → Add rule:
     - Type: PostgreSQL
     - Source: My IP (or 0.0.0.0/0 for development only)
   - Save

**Save these values:**
- `DB_HOST` = endpoint
- `DB_PORT` = 5432
- `DB_NAME` = foreperson
- `DB_USER` = postgres
- `DB_PASSWORD` = your password

---

## Step 3: Create S3 Bucket

1. Go to **AWS Console** → **S3** → **Create bucket**

2. **Configuration:**
   - Bucket name: `foreperson-documents-YOUR-UNIQUE-ID` (must be globally unique)
   - Region: Same as RDS (e.g., us-east-1)
   - Block all public access: **Yes** ✅ (keep enabled)

3. Click **Create bucket**

**Save this value:**
- `S3_BUCKET` = your bucket name

---

## Step 4: Create Cognito User Pool

1. Go to **AWS Console** → **Cognito** → **Create user pool**

2. **Step 1 - Sign-in experience:**
   - Cognito user pool sign-in options: **Email** ✅
   - Click **Next**

3. **Step 2 - Security requirements:**
   - Password policy: Keep defaults or customize
   - MFA: **No MFA** (for simplicity, can add later)
   - Click **Next**

4. **Step 3 - Sign-up experience:**
   - Enable self-registration: **Yes** ✅
   - Required attributes: **email** ✅
   - Click **Next**

5. **Step 4 - Message delivery:**
   - Email: **Send email with Cognito** (for testing)
   - Click **Next**

6. **Step 5 - Integrate your app:**
   - User pool name: `foreperson-users`
   - App client name: `foreperson-web`
   - Client secret: **Don't generate** (for public client)
   - Click **Next**

7. **Step 6 - Review and create:**
   - Review settings → **Create user pool**

8. After creation, note:
   - **User pool ID**: `us-east-1_xxxxxxxxx`
   - Go to **App integration** → **App clients** → Note the **Client ID**

**Save these values:**
- `COGNITO_USER_POOL_ID` = user pool ID
- `COGNITO_CLIENT_ID` = app client ID

---

## Step 5: Configure Environment

1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` with your values:
   ```
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   
   DB_HOST=foreperson-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
   DB_PORT=5432
   DB_NAME=foreperson
   DB_USER=postgres
   DB_PASSWORD=your_password
   
   S3_BUCKET=foreperson-documents-xxxxx
   
   COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
   COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxx
   
   OPENAI_API_KEY=sk-...
   ```

---

## Step 6: Install Backend Dependencies

```bash
cd /Users/raunakbalchandani/Downloads/foreperson-local
source .venv/bin/activate
pip install -r backend/requirements.txt
```

---

## Step 7: Test Backend

```bash
# Load environment variables
export $(cat .env | xargs)

# Run the API
cd backend
uvicorn api:app --reload --port 8000
```

Open http://localhost:8000/docs for Swagger UI

---

## Step 8: Test Endpoints

### Health Check
```bash
curl http://localhost:8000/health
```

### Create User
```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!", "name": "Test User"}'
```

---

## Cost Breakdown

### Free Tier (12 months)
| Service | Free Tier Limit |
|---------|-----------------|
| RDS | 750 hours/month db.t3.micro |
| S3 | 5 GB storage |
| Cognito | 50,000 MAU |

### After Free Tier
| Service | Estimated Cost |
|---------|----------------|
| RDS db.t3.micro | ~$15/month |
| S3 (10 GB) | ~$0.25/month |
| Cognito | Free up to 50K users |
| **Total** | **~$15-20/month** |

---

## Troubleshooting

### Database Connection Failed
1. Check security group allows your IP
2. Verify DB is publicly accessible
3. Check credentials in .env

### S3 Upload Failed
1. Check bucket exists
2. Verify IAM permissions
3. Check bucket name is correct

### Cognito Auth Failed
1. Verify User Pool ID and Client ID
2. Check region matches
3. Ensure app client has correct settings

---

## Next Steps

1. ✅ AWS services configured
2. Run backend API locally
3. Connect Streamlit app to backend
4. Deploy to production (EC2, ECS, or Lambda)
