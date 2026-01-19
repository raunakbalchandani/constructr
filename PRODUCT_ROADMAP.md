# Foreperson.ai - Product Roadmap
## From Prototype to Consumer-Scale Product

---

## 🎯 Vision

**The Grammarly for Construction Documents** - An AI-powered platform that helps construction professionals understand, analyze, and manage their project documents instantly.

---

## 📊 Current State Assessment

### What You Have (Prototype)
| Feature | Status | Quality |
|---------|--------|---------|
| PDF/Word/Excel text extraction | ✅ Built | ⭐⭐⭐ Good |
| AI-powered Q&A about documents | ✅ Built | ⭐⭐⭐⭐ Excellent |
| Document type classification | ✅ Built | ⭐⭐⭐ Good |
| Document conflict detection | ✅ Built | ⭐⭐⭐⭐ Excellent |
| Visual annotation detection | ⚠️ Built | ⭐ Poor (needs ML) |
| User authentication | ❌ Missing | - |
| Database/storage | ❌ Missing | - |
| Multi-user support | ❌ Missing | - |
| Deployment | ❌ Missing | - |

### Core Problem
Your annotation detection uses basic computer vision (color detection, circle finding). This approach can never achieve production-quality accuracy. Real products use:
1. **Trained ML models** (YOLOv8, Faster R-CNN)
2. **Cloud APIs** (Azure Document Intelligence, AWS Textract)
3. **Or both combined**

---

## 🗺️ Product Roadmap

### PHASE 1: Foundation (Weeks 1-2)
**Goal: Stable, deployable MVP focusing on what works**

#### Week 1: Clean & Stabilize
- [ ] Fix all syntax errors and bugs
- [ ] Remove broken features (annotation detection) temporarily
- [ ] Clean up codebase (remove unused files)
- [ ] Write proper error handling
- [ ] Add loading states and user feedback

#### Week 2: Core Experience
- [ ] Improve document parsing reliability
- [ ] Add document organization (folders, tags)
- [ ] Better AI prompts for summaries
- [ ] Export features (PDF reports, Excel summaries)
- [ ] Mobile-responsive UI

**Deliverable**: Working demo you can show to potential users

---

### PHASE 2: Cloud Infrastructure (Weeks 3-4)
**Goal: Multi-user, persistent, scalable**

#### Week 3: Backend Setup
- [ ] Set up PostgreSQL database (Supabase or AWS RDS)
- [ ] User authentication (Supabase Auth or Auth0)
- [ ] File storage (AWS S3 or Supabase Storage)
- [ ] API layer (FastAPI backend)

#### Week 4: Integration
- [ ] Connect Streamlit to backend
- [ ] User accounts and login
- [ ] Project/workspace management
- [ ] Document persistence (files saved to cloud)
- [ ] Basic billing setup (Stripe)

**Deliverable**: Multi-user app with accounts and saved data

---

### PHASE 3: ML Pipeline for Annotations (Weeks 5-8)
**Goal: Accurate annotation detection**

#### Week 5-6: Data Collection & Annotation
- [ ] Collect 100+ real construction drawings
  - GSA.gov federal building plans
  - City planning departments (public records)
  - Partner with 1-2 construction companies for sample data
- [ ] Set up Roboflow workspace
- [ ] Annotate drawings (8 classes):
  - `callout_bubble` - Detail markers
  - `dimension` - Measurement lines
  - `drawing_grid` - Reference grid
  - `redline` - Markup corrections
  - `revision_cloud` - Change areas
  - `stamp` - Approval stamps
  - `text_box` - Notes
  - `title_block` - Drawing info

#### Week 7: Model Training
- [ ] Train YOLOv8 model on Roboflow
- [ ] Evaluate accuracy (target: 80%+ mAP)
- [ ] Export model for deployment
- [ ] Set up model inference API

#### Week 8: Integration
- [ ] Replace basic CV with trained model
- [ ] Add OCR for detected regions (EasyOCR)
- [ ] Combine with AI for intelligent interpretation
- [ ] A/B test against cloud APIs

**Deliverable**: 80%+ accurate annotation detection

---

### PHASE 4: Production Polish (Weeks 9-12)
**Goal: Production-ready product**

#### Week 9-10: Enterprise Features
- [ ] Team workspaces
- [ ] Role-based access control
- [ ] Audit logging
- [ ] SSO integration (optional)
- [ ] API for integrations

#### Week 11: Performance & Scale
- [ ] Optimize document processing (async, queues)
- [ ] CDN for file delivery
- [ ] Caching layer (Redis)
- [ ] Load testing
- [ ] Error monitoring (Sentry)

#### Week 12: Launch Prep
- [ ] Landing page and marketing site
- [ ] Pricing tiers
- [ ] Documentation
- [ ] Customer support system
- [ ] Analytics (Mixpanel/Amplitude)

**Deliverable**: Launch-ready product

---

## 💰 Business Model

### Target Users
1. **General Contractors** - Managing multiple subcontractors, need document coordination
2. **Architects** - Reviewing submittals, tracking revisions
3. **Project Managers** - Finding information quickly, avoiding delays
4. **Owners' Representatives** - Ensuring compliance, tracking changes

### Pricing Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0/mo | 5 documents, basic Q&A |
| **Pro** | $49/mo | Unlimited docs, annotation detection, exports |
| **Team** | $199/mo | 5 users, shared workspace, conflict detection |
| **Enterprise** | Custom | Unlimited users, SSO, API, dedicated support |

### Revenue Projections (Conservative)
- Month 1-3: 50 free users, 5 paid ($245/mo)
- Month 6: 200 free users, 30 paid ($1,470/mo)
- Month 12: 500 free users, 100 paid ($4,900/mo)

---

## 🏗️ Technical Architecture

### Current (Prototype)
```
[Streamlit App] → [Local Files] → [OpenAI API]
```

### Target (Production)
```
                    ┌─────────────────┐
                    │   CDN (Files)   │
                    └────────▲────────┘
                             │
┌─────────────┐    ┌────────┴────────┐    ┌─────────────┐
│   Frontend  │───►│   FastAPI       │───►│  PostgreSQL │
│  (React/    │    │   Backend       │    │  (Users,    │
│   Next.js)  │    │                 │    │   Projects) │
└─────────────┘    └────────┬────────┘    └─────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ OpenAI   │ │ ML Model │ │   S3     │
        │ API      │ │ (YOLO)   │ │ Storage  │
        └──────────┘ └──────────┘ └──────────┘
```

### Tech Stack Recommendation

| Layer | Current | Recommended |
|-------|---------|-------------|
| Frontend | Streamlit | Next.js + Tailwind (or keep Streamlit for MVP) |
| Backend | None | FastAPI (Python) |
| Database | None | PostgreSQL (Supabase) |
| Auth | None | Supabase Auth or Clerk |
| Storage | Local | AWS S3 or Supabase Storage |
| AI/LLM | OpenAI | OpenAI (keep) |
| ML Model | Basic CV | YOLOv8 (Roboflow) |
| OCR | EasyOCR | EasyOCR + Azure (hybrid) |
| Hosting | Local | Vercel (frontend) + Railway (backend) |

---

## 🎯 Key Metrics to Track

### Product Metrics
- **Documents processed** - Core usage
- **Questions asked** - AI engagement
- **Annotations detected** - ML feature usage
- **Time saved** - User value

### Business Metrics
- **MRR** - Monthly recurring revenue
- **Churn rate** - Users leaving
- **CAC** - Cost to acquire customer
- **LTV** - Lifetime value

---

## ⚡ Quick Wins (Do First)

### This Week
1. **Remove annotation detection tab** - It's broken, remove until fixed
2. **Polish the Q&A feature** - This actually works well
3. **Add document comparison** - High value, low effort
4. **Create demo video** - Show potential users/investors

### Before Showing to Anyone
1. Make sure it doesn't crash
2. Handle errors gracefully
3. Add sample documents for demo
4. Clean up the UI

---

## 🚀 Decision Points

### Decision 1: Keep Streamlit or Rebuild Frontend?
**Keep Streamlit if:**
- You want to launch fast (weeks not months)
- You're comfortable with Python
- MVP is the priority

**Rebuild with React/Next.js if:**
- You want a polished consumer experience
- You're planning significant frontend customization
- You have frontend development resources

**Recommendation**: Keep Streamlit for now, rebuild later if needed

### Decision 2: Build ML Model or Use Cloud API?
**Build Custom ML Model if:**
- You need specific annotation types
- You want lower per-document costs at scale
- You have time (4-6 weeks)

**Use Azure Document Intelligence if:**
- You want accuracy NOW
- You're okay with ~$1.50/1000 pages cost
- You need general document understanding

**Recommendation**: Start with Azure for immediate value, train custom model in parallel for cost savings at scale

### Decision 3: Solo or Team?
**Solo if:**
- You're learning and building skills
- You want full control
- Budget is very limited

**Find Co-founder/Team if:**
- You want to move fast
- You have funding or can raise
- You lack skills in certain areas (ML, frontend, sales)

---

## 📅 30-60-90 Day Plan

### Day 1-30: Validate
- [ ] Fix bugs, clean code
- [ ] Build 3 demo documents
- [ ] Record demo video
- [ ] Talk to 10 construction professionals
- [ ] Get 3 companies to try it
- [ ] Collect feedback

### Day 31-60: Build
- [ ] Implement top 3 requested features
- [ ] Set up cloud infrastructure
- [ ] Add user accounts
- [ ] Deploy to production URL
- [ ] Start ML data collection

### Day 61-90: Launch
- [ ] Train and deploy ML model
- [ ] Set up billing
- [ ] Create landing page
- [ ] Launch to 50 beta users
- [ ] Iterate based on feedback

---

## 🎬 Next Steps (Right Now)

1. **Read this roadmap** and decide which path
2. **Tell me your decision**:
   - A) MVP fast (keep Streamlit, focus on Q&A, skip annotations)
   - B) Full product (rebuild, ML model, cloud infrastructure)
   - C) Hybrid (fix current, add Azure for annotations, deploy)
3. **I'll help you execute** whichever path you choose

---

## Questions?

Let me know:
- Your timeline (when do you need this working?)
- Your budget (for cloud services, APIs)
- Your skills (what can you build vs need help with?)
- Your goal (learning project, startup, job portfolio?)

This will help me tailor the roadmap to your situation.
