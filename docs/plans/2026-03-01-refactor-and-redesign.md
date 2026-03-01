# Foreperson.ai — Refactor & Redesign
**Date:** 2026-03-01
**Status:** Approved

---

## 1. Goals

1. Fix the broken integration between Next.js frontend and FastAPI backend
2. Remove the orphaned Streamlit app
3. Harden security (CORS, secrets, API key handling)
4. Improve code quality and reduce duplication
5. Redesign the UI to be dark, minimal, and premium with amber/orange accent and theme switching

---

## 2. Architecture

### Target State

```
Browser
  └── Next.js (port 3000)
        ├── /api/[...path]/route.ts   ← catch-all proxy to FastAPI
        ├── /login, /signup           ← auth pages (now functional)
        └── /dashboard                ← main app

FastAPI (port 8000) — internal, not exposed to browser directly
  ├── /auth/*         JWT auth
  ├── /projects/*     project CRUD
  ├── /documents/*    upload, list, delete, download
  ├── /chat/*         AI chat + history
  └── /conflicts/*    conflict analysis

Backend internals:
  ├── constants.py        named constants (file size, context limits, model)
  ├── ai_provider.py      AIProvider ABC + OpenAIProvider implementation
  ├── ai_assistant.py     ConstructionAI uses AIProvider via composition
  ├── document_parser.py  single source of truth for doc type detection
  ├── database.py         + indexes on foreign keys
  ├── auth.py             SECRET_KEY required from env, no fallback
  └── storage.py          unchanged
```

### Removed
- `app.py` (Streamlit) — deleted entirely
- `PUT /auth/api-key` endpoint — no longer needed
- `openai_api_key` column from User model — OpenAI key is server-side only

---

## 3. Implementation Layers

### Layer 1 — Critical Fixes

| # | Change | File(s) |
|---|--------|---------|
| 1 | Delete Streamlit app | `app.py` → deleted |
| 2 | Add Next.js catch-all API proxy | `frontend/src/app/api/[...path]/route.ts` |
| 3 | Restrict CORS to env var `ALLOWED_ORIGINS` | `backend/api.py` |
| 4 | Remove hardcoded SECRET_KEY fallback | `backend/auth.py` |
| 5 | Move OpenAI key to server env var | `backend/ai_assistant.py`, `.env` |
| 6 | Remove `openai_api_key` from User model + update-api-key endpoint | `backend/database.py`, `backend/api.py` |
| 7 | Update `env.example` | `env.example` |

### Layer 2 — Code Quality

| # | Change | File(s) |
|---|--------|---------|
| 1 | `AIProvider` abstract base + `OpenAIProvider` | `backend/ai_provider.py` (new) |
| 2 | Wire `ConstructionAI` to use `AIProvider` | `backend/ai_assistant.py` |
| 3 | Consolidate doc type detection into `document_parser.py` | `backend/document_parser.py`, `backend/api.py`, `backend/ai_assistant.py` |
| 4 | Frontend service layer | `frontend/src/lib/api.ts` (new) |
| 5 | Replace `print()` with `logging` | all backend `.py` files |
| 6 | Remove dead code (Visual Annotations placeholder, plotly) | `frontend/src/app/dashboard/page.tsx` |
| 7 | Replace bare `except:` with typed exceptions | `backend/document_parser.py` |
| 8 | Magic numbers → named constants | `backend/constants.py` (new) |

### Layer 3 — Polish

| # | Change | File(s) |
|---|--------|---------|
| 1 | Rate limiting via `slowapi` (chat: 10/min, conflicts: 5/min) | `backend/api.py` |
| 2 | Pagination on document list (`?page&limit`) | `backend/api.py`, `frontend/src/lib/api.ts` |
| 3 | DB indexes on `project_id`, `owner_id`, `chat_id` | `backend/database.py` |
| 4 | Fix TypeScript `any` types | `frontend/src/app/dashboard/page.tsx` |
| 5 | Add `slowapi` to requirements | `backend/requirements.txt` |

---

## 4. UI Redesign

### Design Principles
- Dark-first, minimal, premium — think Linear/Vercel aesthetic
- Amber-orange accent (`#f97316`) as the sole brand color
- Depth via border + background layering, not drop shadows
- 150ms transitions throughout
- Identical layout in both themes — only colors change

### Color Tokens (CSS Variables)

| Token | Dark | Light |
|-------|------|-------|
| `--bg` | `#0a0a0a` | `#fafafa` |
| `--surface` | `#111111` | `#f4f4f5` |
| `--card` | `#1a1a1a` | `#ffffff` |
| `--border` | `#222222` | `#e4e4e7` |
| `--accent` | `#f97316` | `#ea6c00` |
| `--text-primary` | `#fafafa` | `#09090b` |
| `--text-secondary` | `#a1a1aa` | `#71717a` |
| `--glow` | `rgba(249,115,22,0.15)` | `rgba(234,108,0,0.08)` |

### Components

**Sidebar**
- Background: `--surface`
- Active project: 2px left amber border + `--card` bg
- Hover: subtle `--card` bg, 150ms transition
- Footer: theme toggle (sun/moon icon) + tooltip "Switch to Dark" / "Switch to Light"
- Collapsible with smooth width animation

**Dashboard Tabs**
- Underline-style active indicator in amber (not pill)
- Documents: list view, file type icon, name, size, date. Amber action buttons appear on row hover
- Chat: full-height, dark bubble for AI, amber-tinted bubble for user, streaming cursor in amber
- Empty states: centered icon + prompt text, no clutter

**Landing Page**
- Full dark hero, large bold Geist heading
- Amber gradient glow behind the primary CTA button
- Feature grid: dark cards with amber icon accents
- Pricing: amber highlight ring on recommended tier
- Nav: minimal, amber on active link

### Theme Toggle
- Location: sidebar footer
- Icon: sun (light mode) / moon (dark mode)
- Tooltip on hover: "Switch to Light" or "Switch to Dark"
- Implementation: `next-themes` + CSS variables
- Persistence: `localStorage`, no flash on load

### Typography
- Font: Geist (Next.js default)
- Headings: weight 600–700
- Body: weight 400, `--text-secondary` for supporting text
- Monospace: Geist Mono for file names, metadata, code

---

## 5. Dependencies Added

| Package | Purpose |
|---------|---------|
| `next-themes` | Theme switching with no flash |
| `slowapi` | FastAPI rate limiting |

---

## 6. Files Deleted

- `app.py` — Streamlit UI
- All `DEPLOY_*.md`, `FIX_WEBSITE.md`, `RECONNECT_AND_DEPLOY.md` etc. — stale docs

---

## 7. Success Criteria

- [ ] Login and signup work end-to-end through the Next.js proxy
- [ ] No hardcoded secrets anywhere in the codebase
- [ ] CORS allows only configured origins
- [ ] OpenAI key read from server env var only
- [ ] Document type detection has exactly one implementation
- [ ] All `print()` replaced with `logging`
- [ ] Theme switches cleanly between dark and light with amber accent
- [ ] Rate limiting active on `/chat` and `/conflicts`
- [ ] Pagination working on document list
