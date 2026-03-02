# Foreperson.ai — Refactor & Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Foreperson.ai from a broken dual-UI codebase into a clean, secure, and visually premium Next.js + FastAPI product.

**Architecture:** Next.js frontend proxies all `/api/*` calls to FastAPI backend. Streamlit removed. All secrets from env vars. Three commit layers: Critical → Quality → Polish → UI.

**Tech Stack:** Next.js 15, FastAPI, SQLite/SQLAlchemy, next-themes, slowapi, openai, python-jose, bcrypt

---

## Layer 1 — Critical Fixes

---

### Task 1: Delete Streamlit app and stale docs

**Files:**
- Delete: `app.py`
- Delete: `AWS_SETUP_GUIDE.md`, `CONSTRUCTION_SPECIFIC_OCR.md`, `DEPLOY_FROM_GIT.md`, `DEPLOY_INSTRUCTIONS.md`, `DEPLOY_NOW.md`, `DEPLOY_OCR.md`, `EC2_ACCESS_TROUBLESHOOTING.md`, `FIX_WEBSITE.md`, `IMPROVEMENT_PLAN.md`, `PRODUCT_ROADMAP.md`, `RECONNECT_AND_DEPLOY.md`, `TESSERACT_CONSTRUCTION_DETECTION.md`, `TESSERACT_SETUP.md`, `DEPLOYMENT_GUIDE.md`

**Step 1: Delete Streamlit app and stale markdown docs**

```bash
rm app.py
rm AWS_SETUP_GUIDE.md CONSTRUCTION_SPECIFIC_OCR.md DEPLOY_FROM_GIT.md \
   DEPLOY_INSTRUCTIONS.md DEPLOY_NOW.md DEPLOY_OCR.md \
   EC2_ACCESS_TROUBLESHOOTING.md FIX_WEBSITE.md IMPROVEMENT_PLAN.md \
   PRODUCT_ROADMAP.md RECONNECT_AND_DEPLOY.md TESSERACT_CONSTRUCTION_DETECTION.md \
   TESSERACT_SETUP.md DEPLOYMENT_GUIDE.md deploy-ocr.sh deploy-to-ec2.sh
rm -rf deploy/
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove Streamlit app and stale deployment docs"
```

---

### Task 2: Add Next.js catch-all API proxy

**Files:**
- Create: `frontend/src/app/api/[...path]/route.ts`

**Step 1: Create the directory and proxy route**

```bash
mkdir -p frontend/src/app/api/\[...path\]
```

Create `frontend/src/app/api/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

async function handler(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname.replace(/^\/api/, '')
  const url = `${BACKEND_URL}${path}${req.nextUrl.search}`

  const headers = new Headers(req.headers)
  headers.delete('host')

  const init: RequestInit = { method: req.method, headers }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body
    ;(init as RequestInit & { duplex: string }).duplex = 'half'
  }

  const upstream = await fetch(url, init)

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
```

**Step 2: Add BACKEND_URL to env.example**

Open `env.example` and add:
```
BACKEND_URL=http://localhost:8000
```

**Step 3: Commit**

```bash
git add frontend/src/app/api/ env.example
git commit -m "feat: add Next.js catch-all proxy to FastAPI"
```

---

### Task 3: Harden CORS and remove hardcoded SECRET_KEY

**Files:**
- Modify: `backend/api.py` (CORS config, lines ~40-48)
- Modify: `backend/auth.py` (SECRET_KEY, line ~15)
- Modify: `env.example`

**Step 1: Fix CORS in `backend/api.py`**

Replace:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

With:
```python
_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Step 2: Remove hardcoded SECRET_KEY fallback in `backend/auth.py`**

Replace:
```python
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production-foreperson-ai-2024")
```

With:
```python
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is required. Set it in your .env file.")
```

**Step 3: Update `env.example`**

Add:
```
SECRET_KEY=change-me-generate-with-openssl-rand-hex-32
ALLOWED_ORIGINS=http://localhost:3000
```

**Step 4: Commit**

```bash
git add backend/api.py backend/auth.py env.example
git commit -m "fix: harden CORS and require SECRET_KEY from env"
```

---

### Task 4: Move OpenAI key to server env, remove from User model

**Files:**
- Modify: `ai_assistant.py`
- Modify: `backend/database.py`
- Modify: `backend/api.py` (remove update-api-key endpoint, remove openai_api_key from user response, pass env key to ConstructionAI)
- Modify: `env.example`

**Step 1: Update `ai_assistant.py` to read from env**

Replace the `__init__` signature:
```python
class ConstructionAI:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
```

With:
```python
import logging
logger = logging.getLogger(__name__)

class ConstructionAI:
    def __init__(self, model: str = "gpt-4o-mini"):
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable is required.")
```

And update the body:
```python
        self.client = openai.OpenAI(api_key=api_key)
        self.model = model
        self.documents = []
        self.max_context_chars = 12000
```

**Step 2: Remove `openai_api_key` column from `backend/database.py`**

Remove this line from the `User` model:
```python
    openai_api_key = Column(String(255), nullable=True)  # User's own OpenAI key
```

**Step 3: Remove the update-api-key endpoint from `backend/api.py`**

Find and delete the `PUT /auth/api-key` endpoint (search for `"api-key"` in the file).

Also find where `ConstructionAI` is instantiated (search for `ConstructionAI(`) and remove the `api_key=` argument — it now reads from env.

Also remove `openai_api_key` from any user response schemas (search for `openai_api_key` in `api.py`).

**Step 4: Add OPENAI_API_KEY to `env.example`**

```
OPENAI_API_KEY=sk-...
```

**Step 5: Commit**

```bash
git add ai_assistant.py backend/database.py backend/api.py env.example
git commit -m "fix: move OpenAI key to server env, remove from User model"
```

---

## Layer 2 — Code Quality

---

### Task 5: Create `backend/constants.py`

**Files:**
- Create: `backend/constants.py`

**Step 1: Create the constants file**

```python
# backend/constants.py
"""Shared constants for the Foreperson backend."""

MAX_CONTEXT_CHARS = 12_000       # Max chars of document text passed to AI
SAMPLE_SIZE = 3_000              # Chars used when sampling doc type
MAX_FILE_SIZE = 50 * 1024 * 1024 # 50 MB upload limit
DEFAULT_AI_MODEL = "gpt-4o-mini"
PAGINATION_DEFAULT_LIMIT = 20
PAGINATION_MAX_LIMIT = 100
CHAT_RATE_LIMIT = "10/minute"
CONFLICTS_RATE_LIMIT = "5/minute"
```

**Step 2: Replace magic numbers in `ai_assistant.py`**

At the top, add:
```python
from backend.constants import MAX_CONTEXT_CHARS, SAMPLE_SIZE, DEFAULT_AI_MODEL
```

Replace `12000` with `MAX_CONTEXT_CHARS`, `3000` with `SAMPLE_SIZE`, `"gpt-4o-mini"` with `DEFAULT_AI_MODEL`.

**Step 3: Replace magic numbers in `backend/api.py`**

Add:
```python
from backend.constants import MAX_FILE_SIZE, PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT
```

Replace `50 * 1024 * 1024` with `MAX_FILE_SIZE`.

**Step 4: Commit**

```bash
git add backend/constants.py ai_assistant.py backend/api.py
git commit -m "refactor: extract magic numbers to constants.py"
```

---

### Task 6: Create `AIProvider` abstraction

**Files:**
- Create: `backend/ai_provider.py`
- Modify: `ai_assistant.py`

**Step 1: Create `backend/ai_provider.py`**

```python
"""AI provider abstraction — swap LLM backends without touching business logic."""
from abc import ABC, abstractmethod
from typing import List


class AIProvider(ABC):
    @abstractmethod
    def complete(self, messages: List[dict], **kwargs) -> str:
        """Send messages and return the assistant's reply as a string."""
        ...


class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str) -> None:
        from openai import OpenAI
        self._client = OpenAI(api_key=api_key)
        self._model = model

    def complete(self, messages: List[dict], **kwargs) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            **kwargs,
        )
        return response.choices[0].message.content
```

**Step 2: Update `ai_assistant.py` to use `AIProvider` via composition**

Replace the import and `__init__`:
```python
import openai  # remove this
```
With:
```python
from backend.ai_provider import AIProvider, OpenAIProvider
from backend.constants import MAX_CONTEXT_CHARS, DEFAULT_AI_MODEL
```

Update `__init__`:
```python
class ConstructionAI:
    def __init__(self, provider: AIProvider | None = None) -> None:
        if provider is None:
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY environment variable is required.")
            provider = OpenAIProvider(api_key=api_key, model=DEFAULT_AI_MODEL)
        self._provider = provider
        self.documents: list = []
        self.max_context_chars = MAX_CONTEXT_CHARS
```

Replace direct `self.client.chat.completions.create(...)` calls throughout the file with:
```python
self._provider.complete(messages=[...])
```

**Step 3: Commit**

```bash
git add backend/ai_provider.py ai_assistant.py
git commit -m "refactor: introduce AIProvider abstraction over OpenAI"
```

---

### Task 7: Consolidate document type detection

**Files:**
- Modify: `document_parser.py` (make `detect_document_type` the canonical version)
- Modify: `backend/api.py` (remove local `detect_document_type`, import from parser)
- Modify: `ai_assistant.py` (remove local `detect_document_type`, use parser)

**Step 1: Verify the canonical function in `document_parser.py`**

Open `document_parser.py` and confirm `detect_document_type` (or equivalent) exists as a standalone function or method. It should use keyword/pattern scoring — this is the one to keep.

**Step 2: Export it cleanly**

At the bottom of `document_parser.py` ensure it's accessible:
```python
# At module level, outside the class if it's currently a method:
def detect_document_type(text: str, filename: str = "") -> str:
    """Return document type string from text content and filename."""
    parser = ConstructionDocumentParser()
    return parser._detect_document_type(text, filename)
```

**Step 3: Remove from `backend/api.py`**

Search for `def detect_document_type` or `detect_document_type` in `backend/api.py` (~line 780) and delete the local function. Add import:
```python
from document_parser import detect_document_type
```

**Step 4: Remove from `ai_assistant.py`**

Search for `def detect_document_type` in `ai_assistant.py` (~line 117) and delete it. Use the import from `document_parser` instead.

**Step 5: Commit**

```bash
git add document_parser.py backend/api.py ai_assistant.py
git commit -m "refactor: consolidate document type detection to document_parser.py"
```

---

### Task 8: Replace print statements with logging

**Files:**
- Modify: `ai_assistant.py`, `document_parser.py`, `backend/api.py`, `backend/storage.py`

**Step 1: Add logging config to `backend/api.py`**

Near the top, after imports:
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)
```

**Step 2: Add module loggers to each file**

In each backend file, add at the top:
```python
import logging
logger = logging.getLogger(__name__)
```

**Step 3: Replace all `print(...)` calls**

- `print(f"AI Assistant: ...")` → `logger.info(...)`
- `print(f"Error: ...")` → `logger.error(...)`
- `print(f"Warning: ...")` → `logger.warning(...)`

Run to find them all:
```bash
grep -rn "^    print\|^print" ai_assistant.py document_parser.py backend/
```

**Step 4: Commit**

```bash
git add ai_assistant.py document_parser.py backend/api.py backend/storage.py
git commit -m "refactor: replace print statements with logging module"
```

---

### Task 9: Fix bare except clauses and remove dead code

**Files:**
- Modify: `document_parser.py`
- Modify: `frontend/src/app/dashboard/page.tsx`

**Step 1: Fix bare `except:` in `document_parser.py`**

Find all `except:` or `except Exception:` with `pass`. Replace:
```python
except:
    pass
```
With specific exceptions. For OCR-related blocks use:
```python
except (OSError, ValueError) as e:
    logger.warning("OCR failed on page %s: %s", page_num, e)
```
For library import fallbacks use:
```python
except ImportError:
    pass
```

**Step 2: Remove Visual Annotations dead code from dashboard**

In `frontend/src/app/dashboard/page.tsx`, find the Visual Annotations tab section (search for `Visual Annotations` or `annotation`). Delete the entire tab button and its content panel — it's a placeholder with a disabled upload.

Also remove the commented-out plotly import if present.

**Step 3: Commit**

```bash
git add document_parser.py frontend/src/app/dashboard/page.tsx
git commit -m "refactor: fix bare except clauses, remove dead Visual Annotations tab"
```

---

### Task 10: Create frontend service layer

**Files:**
- Create: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/dashboard/page.tsx` (replace all fetch calls)

**Step 1: Create `frontend/src/lib/api.ts`**

```typescript
/**
 * API service layer — all fetch calls go through here.
 * The Next.js proxy routes /api/* to FastAPI automatically.
 */

function getToken(): string | null {
  return localStorage.getItem('token')
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name: string) =>
    request<{ access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  me: () => request<{ id: number; email: string; name: string }>('/auth/me'),
}

// Projects
export interface Project {
  id: number
  name: string
  description?: string
  created_at: string
}

export const projects = {
  list: () => request<Project[]>('/projects'),
  create: (name: string, description?: string) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  delete: (id: number) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
}

// Documents
export interface Document {
  id: number
  filename: string
  original_filename: string
  file_size: number
  document_type: string
  created_at: string
}

export const documents = {
  list: (projectId: number, page = 1, limit = 20) =>
    request<Document[]>(`/projects/${projectId}/documents?page=${page}&limit=${limit}`),
  upload: (projectId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`/api/projects/${projectId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json()).detail ?? 'Upload failed')
      return res.json() as Promise<Document>
    })
  },
  delete: (projectId: number, documentId: number) =>
    request<void>(`/projects/${projectId}/documents/${documentId}`, { method: 'DELETE' }),
}

// Chat
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export const chat = {
  history: (projectId: number) =>
    request<ChatMessage[]>(`/projects/${projectId}/chat`),
  send: (projectId: number, message: string) =>
    request<{ response: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, message }),
    }),
  conflicts: (projectId: number) =>
    request<{ conflicts: unknown[] }>(`/projects/${projectId}/conflicts`, { method: 'POST' }),
}
```

**Step 2: Update `frontend/src/app/dashboard/page.tsx`**

Add at the top:
```typescript
import * as api from '@/lib/api'
```

Then replace every `fetch('/api/...')` call with the corresponding `api.*` function. For example:

```typescript
// Before:
const res = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
const data = await res.json()

// After:
const data = await api.projects.list()
```

Work through each of the 10 fetch calls found at lines: 702, 911, 1052, 1082, 1111, 1180, 1227, 1267, 1319, 1353.

Remove line 911 (the api-key update call) entirely — that endpoint no longer exists.

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/app/dashboard/page.tsx
git commit -m "refactor: extract all API calls into frontend service layer"
```

---

## Layer 3 — Polish

---

### Task 11: Add rate limiting with slowapi

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/api.py`

**Step 1: Add slowapi to requirements**

```bash
echo "slowapi==0.1.9" >> backend/requirements.txt
```

**Step 2: Add rate limiting to `backend/api.py`**

Add imports near the top:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from backend.constants import CHAT_RATE_LIMIT, CONFLICTS_RATE_LIMIT
```

After `app = FastAPI(...)`:
```python
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Decorate the chat endpoint:
```python
@app.post("/chat")
@limiter.limit(CHAT_RATE_LIMIT)
async def send_message(request: Request, ...):
```

Decorate the conflicts endpoint:
```python
@app.post("/projects/{project_id}/conflicts")
@limiter.limit(CONFLICTS_RATE_LIMIT)
async def analyze_conflicts(request: Request, ...):
```

Note: Both decorated endpoints need `request: Request` as a parameter (slowapi requirement).

**Step 3: Install and verify**

```bash
pip install slowapi==0.1.9
```

**Step 4: Commit**

```bash
git add backend/requirements.txt backend/api.py
git commit -m "feat: add slowapi rate limiting to chat and conflicts endpoints"
```

---

### Task 12: Add pagination to document list and DB indexes

**Files:**
- Modify: `backend/api.py`
- Modify: `backend/database.py`

**Step 1: Add pagination to the documents list endpoint in `backend/api.py`**

Find `GET /projects/{project_id}/documents` and update:
```python
@app.get("/projects/{project_id}/documents")
async def list_documents(
    project_id: int,
    page: int = 1,
    limit: int = PAGINATION_DEFAULT_LIMIT,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    limit = min(limit, PAGINATION_MAX_LIMIT)
    offset = (page - 1) * limit

    docs = (
        db.query(Document)
        .filter(Document.project_id == project_id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return docs
```

**Step 2: Add DB indexes to `backend/database.py`**

Update imports:
```python
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Index
```

After each model class, add indexes:
```python
class Project(Base):
    ...
    __table_args__ = (Index('ix_project_owner_id', 'owner_id'),)

class Document(Base):
    ...
    __table_args__ = (Index('ix_document_project_id', 'project_id'),)

class ChatMessage(Base):
    ...
    __table_args__ = (Index('ix_chatmessage_chat_id', 'chat_id'),)
```

**Step 3: Commit**

```bash
git add backend/api.py backend/database.py
git commit -m "feat: add pagination to document list and DB indexes on foreign keys"
```

---

## Layer 4 — UI Redesign

---

### Task 13: Install next-themes and set up CSS variables

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`

**Step 1: Install next-themes**

```bash
cd frontend && npm install next-themes
```

**Step 2: Replace `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        card: 'var(--card)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
```

**Step 3: Replace `frontend/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

/* ─── Light mode tokens (default) ─────────────────────────── */
:root {
  --bg:            #fafafa;
  --surface:       #f4f4f5;
  --card:          #ffffff;
  --border:        #e4e4e7;
  --accent:        #ea6c00;
  --text-primary:  #09090b;
  --text-secondary:#71717a;
  --glow:          rgba(234, 108, 0, 0.08);
}

/* ─── Dark mode tokens ─────────────────────────────────────── */
.dark {
  --bg:            #0a0a0a;
  --surface:       #111111;
  --card:          #1a1a1a;
  --border:        #222222;
  --accent:        #f97316;
  --text-primary:  #fafafa;
  --text-secondary:#a1a1aa;
  --glow:          rgba(249, 115, 22, 0.15);
}

html { scroll-behavior: smooth; }

body {
  background-color: var(--bg);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.15s ease, color 0.15s ease;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--surface); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }

/* Selection */
::selection { background: var(--glow); color: var(--text-primary); }

/* Focus */
*:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* ─── Utility classes ──────────────────────────────────────── */
@layer utilities {
  .text-gradient {
    background: linear-gradient(135deg, var(--accent), #fb923c);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .glow-accent {
    box-shadow: 0 0 20px var(--glow);
  }

  .border-subtle {
    border-color: var(--border);
  }

  .transition-theme {
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
}

/* ─── Component classes ────────────────────────────────────── */
@layer components {
  .btn-primary {
    @apply px-4 py-2 rounded-lg font-medium text-sm text-white transition-all duration-150;
    background-color: var(--accent);
  }
  .btn-primary:hover {
    filter: brightness(1.1);
    box-shadow: 0 0 16px var(--glow);
  }

  .btn-ghost {
    @apply px-4 py-2 rounded-lg font-medium text-sm transition-all duration-150;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover {
    background-color: var(--card);
    color: var(--text-primary);
  }

  .input {
    @apply px-3 py-2 rounded-lg text-sm transition-all duration-150;
    background-color: var(--card);
    border: 1px solid var(--border);
    color: var(--text-primary);
  }
  .input:focus {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 3px var(--glow);
  }
  .input::placeholder {
    color: var(--text-secondary);
  }

  .card {
    @apply rounded-xl p-4;
    background-color: var(--card);
    border: 1px solid var(--border);
  }
}
```

**Step 4: Update `frontend/src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import './globals.css'

export const metadata: Metadata = {
  title: 'Foreperson.ai - Construction Document Intelligence',
  description: 'AI-powered platform for construction professionals to analyze, understand, and manage project documents.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tailwind.config.js \
        frontend/src/app/globals.css frontend/src/app/layout.tsx
git commit -m "feat: install next-themes, set up CSS variable color system"
```

---

### Task 14: Redesign the sidebar

The sidebar lives inside `frontend/src/app/dashboard/page.tsx`. Find the sidebar JSX (look for `<aside` or `sidebarOpen` references) and replace with the new design.

**Sidebar structure:**

```tsx
{/* Sidebar */}
<aside
  className={`flex flex-col shrink-0 transition-all duration-200 ease-in-out
    ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}
    border-r border-subtle bg-surface`}
  style={{ borderColor: 'var(--border)' }}
>
  {/* Logo */}
  <div className="flex items-center gap-2 px-4 py-4 border-b border-subtle">
    <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
      Foreperson.ai
    </span>
  </div>

  {/* Project list */}
  <nav className="flex-1 overflow-y-auto py-2">
    <p className="px-4 py-2 text-xs font-medium uppercase tracking-widest"
       style={{ color: 'var(--text-secondary)' }}>
      Projects
    </p>

    {projects.map((project) => (
      <button
        key={project.id}
        onClick={() => setCurrentProject(project)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-theme text-left group"
        style={{
          backgroundColor: currentProject?.id === project.id ? 'var(--card)' : 'transparent',
          color: currentProject?.id === project.id ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderLeft: currentProject?.id === project.id ? '2px solid var(--accent)' : '2px solid transparent',
        }}
      >
        <FolderOpen size={15} />
        <span className="truncate flex-1">{project.name}</span>
        {/* Delete button — appears on hover */}
        <span
          onClick={(e) => { e.stopPropagation(); openDeleteModal(project) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-400"
        >
          <Trash2 size={13} />
        </span>
      </button>
    ))}
  </nav>

  {/* Footer */}
  <div className="p-4 border-t border-subtle flex items-center justify-between">
    {/* New project */}
    <button
      onClick={() => setShowAddProject(true)}
      className="flex items-center gap-2 text-sm transition-theme"
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
    >
      <Plus size={15} />
      New Project
    </button>

    {/* Theme toggle */}
    <ThemeToggle />
  </div>
</aside>
```

**ThemeToggle component** — add near the top of the file, before the main component:

```tsx
'use client'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to Light' : 'Switch to Dark'}
      className="p-1.5 rounded-lg transition-theme"
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      aria-label={isDark ? 'Switch to Light' : 'Switch to Dark'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
```

**Step: Commit after sidebar is done**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: redesign sidebar with amber accent, theme toggle with tooltip"
```

---

### Task 15: Redesign dashboard main area (tabs, documents, chat)

Still in `frontend/src/app/dashboard/page.tsx`.

**Tab bar** — replace pill/box tabs with underline style:

```tsx
<div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
  {(['Documents', 'AI Chat', 'Summaries', 'Compare'] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className="px-5 py-3 text-sm font-medium transition-theme relative"
      style={{
        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {tab}
      {activeTab === tab && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
          style={{ backgroundColor: 'var(--accent)' }}
        />
      )}
    </button>
  ))}
</div>
```

**Document list row** — replace current card layout:

```tsx
{docs.map((doc) => (
  <div
    key={doc.id}
    className="flex items-center gap-4 px-4 py-3 rounded-lg group transition-theme"
    style={{ border: '1px solid transparent' }}
    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
  >
    <FileText size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {doc.original_filename}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
        {doc.document_type} · {formatBytes(doc.file_size)} · {formatDate(doc.created_at)}
      </p>
    </div>
    {/* Actions — appear on hover */}
    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => handleDelete(doc.id)}
        className="p-1.5 rounded-lg transition-theme hover:text-red-400"
        style={{ color: 'var(--text-secondary)' }}
        title="Delete"
      >
        <Trash2 size={15} />
      </button>
    </div>
  </div>
))}
```

**Chat bubbles** — replace current bubble styles:

```tsx
{/* AI message */}
<div className="flex gap-3">
  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
       style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
    <MessageSquare size={13} style={{ color: 'var(--accent)' }} />
  </div>
  <div className="flex-1 rounded-xl px-4 py-3 text-sm"
       style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
    <ReactMarkdown>{msg.content}</ReactMarkdown>
  </div>
</div>

{/* User message */}
<div className="flex gap-3 justify-end">
  <div className="rounded-xl px-4 py-3 text-sm max-w-lg"
       style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
    {msg.content}
  </div>
</div>
```

**Empty states** — replace loading spinners and empty placeholders:

```tsx
{/* Empty documents */}
<div className="flex flex-col items-center justify-center py-20 gap-3">
  <FileText size={36} style={{ color: 'var(--border)' }} />
  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
    No documents yet
  </p>
  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
    Upload a PDF, DOCX, or XLSX to get started
  </p>
</div>
```

**Modals** — update DeleteProjectModal and AddProjectModal to use CSS variables:

Replace `bg-dark-800`, `border-dark-700`, `text-dark-300` classes with:
- `bg-dark-800` → `style={{ backgroundColor: 'var(--card)' }}`
- `border-dark-700` → `style={{ border: '1px solid var(--border)' }}`
- `text-dark-300` → `style={{ color: 'var(--text-secondary)' }}`

**Step: Commit after dashboard main area is done**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: redesign dashboard tabs, document list, chat bubbles, and modals"
```

---

### Task 16: Redesign landing page

**Files:**
- Modify: `frontend/src/app/page.tsx`

The landing page is a full rewrite. Replace the content of `page.tsx` with:

```tsx
'use client'

import Link from 'next/link'
import { FileText, MessageSquare, GitCompare, ArrowRight, Shield, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Nav */}
      <nav className="border-b border-subtle sticky top-0 z-50 backdrop-blur-sm"
           style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(10,10,10,0.8)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
            Foreperson.ai
          </span>
          <div className="flex items-center gap-4">
            <Link href="/login"
              className="text-sm transition-theme"
              style={{ color: 'var(--text-secondary)' }}>
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary text-sm">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-8"
             style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
          AI-powered construction intelligence
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6"
            style={{ color: 'var(--text-primary)' }}>
          Your documents,{' '}
          <span className="text-gradient">understood.</span>
        </h1>

        <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
          Upload contracts, RFIs, and specs. Ask questions. Find conflicts.
          Foreperson reads your construction docs so you don't have to.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link href="/signup"
            className="btn-primary inline-flex items-center gap-2 glow-accent px-6 py-3 text-base">
            Start for free
            <ArrowRight size={16} />
          </Link>
          <Link href="/login"
            className="btn-ghost inline-flex items-center gap-2 px-6 py-3 text-base">
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: FileText,
              title: 'Document Analysis',
              description: 'Parse PDFs, DOCX, and spreadsheets. Extract key info automatically.',
            },
            {
              icon: MessageSquare,
              title: 'AI Chat',
              description: 'Ask anything about your documents. Get precise, cited answers.',
            },
            {
              icon: GitCompare,
              title: 'Conflict Detection',
              description: 'Automatically surface contradictions between specs and contracts.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="card group hover:glow-accent transition-all duration-200">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                   style={{ backgroundColor: 'var(--surface)' }}>
                <Icon size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            © 2026 Foreperson.ai
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Built for construction professionals
          </span>
        </div>
      </footer>
    </div>
  )
}
```

**Step: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: redesign landing page with dark premium aesthetic"
```

---

### Task 17: Redesign login and signup pages

**Files:**
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/signup/page.tsx`

**Login page — full replacement:**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { access_token } = await auth.login(email, password)
      localStorage.setItem('token', access_token)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <span className="font-bold text-lg" style={{ color: 'var(--accent)' }}>
              Foreperson.ai
            </span>
          </Link>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Sign in to your workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5"
                   style={{ color: 'var(--text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5"
                   style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link href="/signup" style={{ color: 'var(--accent)' }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
```

**Signup page** — same structure, add `name` field, call `auth.register(name, email, password)`.

**Step: Commit**

```bash
git add frontend/src/app/login/page.tsx frontend/src/app/signup/page.tsx
git commit -m "feat: redesign login and signup pages with new design system"
```

---

### Task 18: Final verification and push to GitHub

**Step 1: Run the backend**

```bash
cd /path/to/repo
cp env.example .env  # fill in SECRET_KEY and OPENAI_API_KEY
pip install -r backend/requirements.txt
uvicorn backend.api:app --reload --port 8000
```

Expected: Server starts, no RuntimeError about missing env vars.

**Step 2: Run the frontend**

```bash
cd frontend
npm install
npm run dev
```

Expected: Compiles clean. Visit http://localhost:3000.

**Step 3: Smoke test**

- [ ] Landing page loads with dark theme
- [ ] Theme toggle switches dark ↔ light, tooltip shows correct label
- [ ] Signup creates an account
- [ ] Login redirects to dashboard
- [ ] Creating a project works
- [ ] Uploading a document works
- [ ] Chat sends a message and gets a response
- [ ] Deleting a document works
- [ ] Deleting a project works

**Step 4: Push to GitHub**

```bash
git push origin claude-code
```

**Step 5: Open PR**

```bash
gh pr create \
  --title "Refactor, harden, and redesign Foreperson.ai" \
  --body "$(cat <<'EOF'
## Summary
- Delete Streamlit app, commit to Next.js + FastAPI stack
- Add Next.js catch-all proxy so /api/* calls reach FastAPI (login/signup now work)
- Harden security: CORS restricted, SECRET_KEY required from env, OpenAI key server-side only
- AIProvider abstraction for swappable LLM backends
- Consolidated document type detection to single implementation
- Frontend service layer (lib/api.ts) extracted from 1458-line dashboard
- Replace print with logging, fix bare except clauses, remove dead code
- Rate limiting on /chat (10/min) and /conflicts (5/min) via slowapi
- Pagination on document list
- DB indexes on foreign keys
- Dark/light theme via next-themes + CSS variables (default dark, amber accent)
- Premium redesign: landing page, dashboard, login/signup, sidebar with theme toggle tooltip

## Test plan
- [ ] Backend starts with env vars set, RuntimeError if SECRET_KEY missing
- [ ] Login and signup work end-to-end
- [ ] Document upload, list, delete work
- [ ] Chat sends message and receives AI response
- [ ] Theme toggle switches cleanly, tooltip shows "Switch to Dark/Light"
- [ ] Rate limiting returns 429 after 10 chat requests/min
EOF
)"
```
