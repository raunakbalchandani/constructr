# Full App Gaps — Design Doc
**Date:** 2026-03-06
**Status:** Approved

## Overview

Seven feature areas to close the gap between current state and a production-ready construction PM app. OAuth excluded by user request.

---

## 1. Team Collaboration (Roles)

**New DB table — `ProjectMember`:** `id, project_id, user_id, invited_email, role, status, created_at`

- `role`: `owner` | `editor` | `viewer`
- `status`: `pending` | `active`

**Permissions:**
- Owner — full control, invite/remove members, delete project
- Editor — create/edit/delete RFIs, reports, action items, upload docs, chat
- Viewer — read-only: view docs, chat (no creating records)

**Invite flow:** Owner enters email in new "Team" tab → pending membership created + invite notification created for invitee → invitee logs in, sees invite notification, accepts → membership becomes active.

**Enforcement:** Every project endpoint checks membership. Wrong role or non-member → 403.

**New endpoints:**
- `GET /projects/{id}/members` — list members
- `POST /projects/{id}/members` — invite by email
- `PATCH /projects/{id}/members/{user_id}` — change role
- `DELETE /projects/{id}/members/{user_id}` — remove member
- `POST /projects/{id}/members/accept` — accept invite

---

## 2. In-App Notifications

**New DB table — `Notification`:** `id, user_id, project_id, type, message, read, created_at`

**Types:** `invite_received`, `rfi_created`, `rfi_overdue`, `action_item_overdue`, `member_joined`

**UI:** Bell icon in header with red unread count badge. Click opens dropdown with recent notifications. Clicking a notification marks it read and navigates to the relevant tab.

**Due date checker:** Background thread (Python `threading`, no new deps) starts with the server, runs every hour. Queries open RFIs and action items where `due_date < today`, creates overdue notifications for all active project members (deduped — one notification per record per user).

**New endpoints:**
- `GET /notifications` — list unread notifications for current user
- `GET /notifications/all` — all notifications (read + unread)
- `POST /notifications/{id}/read` — mark one read
- `POST /notifications/read-all` — mark all read

---

## 3. File Annotations

**New DB table — `Annotation`:** `id, document_id, project_id, user_id, type, data (JSON), created_at`

- `type`: `pin` | `box` | `line` | `text`
- `data`: JSON with `{ x, y, width, height, color, label, text }` — coordinates as percentages of document dimensions

**Canvas library:** Fabric.js (loaded via CDN in the preview page, no npm dependency needed).

**Toolbar tools:**
- Pin — click to drop numbered marker with text comment
- Box — drag to draw rectangle
- Line — click-drag to draw line with optional label
- Text — click to place free text overlay

**Annotation visibility:** All project members see all annotations. Creator or Owner can delete. Hover shows author name + timestamp.

**UI entry point:** "Annotate" button in document preview header toggles canvas mode. Normal preview mode unchanged.

**New endpoints:**
- `GET /projects/{id}/documents/{doc_id}/annotations` — list annotations
- `POST /projects/{id}/documents/{doc_id}/annotations` — create annotation
- `DELETE /projects/{id}/documents/{doc_id}/annotations/{ann_id}` — delete annotation

---

## 4. Voice Input

**Two modes, one recording flow:**

1. **Chat mic** — mic button next to send in chat. Hold to record, release to send. Browser `MediaRecorder` captures audio → `POST /voice/transcribe` → Whisper API → transcript inserted into chat input for user to review/edit before sending.

2. **Voice command** — waveform icon button in header. Same recording → transcript goes directly to `ConstructionAgent.run()` with `"Voice command: "` prefix → agent creates record and confirms.

**New endpoint:** `POST /voice/transcribe` — accepts `multipart/form-data` audio file, returns `{ transcript: string }`. Uses `openai.audio.transcriptions.create` (Whisper).

**Permissions:** Viewers can use chat mic but not voice commands.

**Fallback:** Whisper failure shows error toast. No silent failures.

---

## 5. Export

**PDF** — formatted report: project name, export date, clean table of all records. Uses `reportlab`.

**Excel** — single sheet, headers match field names, all records. Uses `openpyxl`.

**Endpoints:**
- `GET /projects/{id}/rfis/export?format=pdf|xlsx`
- `GET /projects/{id}/daily-reports/export?format=pdf|xlsx`

Both return file downloads (`Content-Disposition: attachment`).

**UI:** Download buttons (PDF / Excel) at top of RFIs tab and Daily Reports tab.

---

## 6. DWG Vision

Install LibreOffice on EC2 from the official RPM tarball (one-time server setup). The existing `_dwg_to_images()` code in `ai_assistant.py` already handles the conversion correctly — it just needs LibreOffice present on `$PATH`.

**Install command (EC2):**
```bash
sudo dnf install -y libGL libSM libX11 libXext
wget https://download.documentfoundation.org/libreoffice/stable/7.6.7/rpm/x86_64/LibreOffice_7.6.7_Linux_x86-64_rpm.tar.gz
tar xzf LibreOffice_7.6.7_Linux_x86-64_rpm.tar.gz
sudo rpm -ivh LibreOffice_7.6.7.2_Linux_x86-64_rpm/RPMS/*.rpm
sudo ln -sf /opt/libreoffice7.6/program/soffice /usr/local/bin/libreoffice
```

---

## 7. Large Drawing Sets + Mobile

**Drawing sets:** Raise `MAX_PDF_PAGES` from 10 to 20. Add smart page selection in `_pdf_to_images`: if user message contains a sheet number pattern (e.g. "A3.1", "sheet 5"), extract only matching pages first before falling back to sequential.

**Mobile:**
- Bottom nav bar on screens < 768px (replacing collapsed sidebar icon strip)
- Minimum 44px tap targets on all interactive elements
- Chat input pinned to bottom on mobile
- Grid view: single column on small screens
- Pure Tailwind responsive classes, no new libraries

---

## 8. Grid View Fix (UI)

Move the Preview button from the file icon overlay to beside the Delete button in grid view — matching the list view layout.

---

## Files Changed

| Area | Files |
|------|-------|
| Collaboration | `backend/database.py`, `backend/api.py`, `frontend/src/lib/api.ts`, `frontend/src/app/dashboard/page.tsx` |
| Notifications | `backend/database.py`, `backend/api.py`, `frontend/src/app/dashboard/page.tsx` |
| Annotations | `backend/database.py`, `backend/api.py`, `frontend/src/app/dashboard/page.tsx` |
| Voice | `backend/api.py`, `backend/requirements.txt`, `frontend/src/app/dashboard/page.tsx` |
| Export | `backend/api.py`, `backend/requirements.txt` |
| DWG vision | EC2 server setup only (no code changes) |
| Drawing sets + Mobile | `ai_assistant.py`, `frontend/src/app/dashboard/page.tsx` |
| Grid view fix | `frontend/src/app/dashboard/page.tsx` |
