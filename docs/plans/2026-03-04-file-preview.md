# File Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Preview button to every file in FilesTab that opens a rendered preview in a new browser tab — PDF/images served natively, DOCX/XLSX/CSV rendered as HTML, DWG/DXF rendered as SVG, and IFC/BIM shown with a metadata panel + interactive 3D viewer.

**Architecture:** A single backend endpoint `GET /projects/{id}/documents/{docId}/preview?token=JWT` handles all file types by dispatching on file extension. JWT is accepted as a query param (since new tabs can't send Bearer headers). Frontend adds a Preview button to both grid and list views in FilesTab that constructs the URL using the stored token and opens it via `window.open`.

**Tech Stack:** Python 3.11, FastAPI, python-docx, pandas, ezdxf, ifcopenshell, web-ifc-viewer (CDN), Next.js 15, TypeScript strict, lucide-react

---

## Task 1: Backend — Preview Endpoint (PDF, Images, DOCX, XLSX/CSV, DWG/DXF)

**Files:**
- Modify: `backend/auth.py` — add `get_user_from_token_param` dependency
- Modify: `backend/api.py` — add preview endpoint with per-type dispatch
- Modify: `backend/requirements.txt` — no new deps needed for this task

**Context:**
- `backend/auth.py` has `decode_token(token: str) -> Optional[dict]` at line 51
- `backend/auth.py` has `get_current_user` at line 60 which uses `HTTPBearer` (header only)
- `backend/api.py` download endpoint is at line 527 — reference for ownership check pattern
- Files stored at `uploads/<user_id>/<project_id>/<uuid>.<ext>` — `document.file_path` is the full local path
- `document.original_filename` has the original name (e.g. `specs.docx`)
- Already installed: `pymupdf`, `python-docx`, `openpyxl`, `pandas`, `ezdxf`, `Pillow`

**Step 1: Add `get_user_from_token_param` to `backend/auth.py`**

After the existing `get_current_user` function, add:

```python
async def get_user_from_token_param(
    token: str,
    db: Session = Depends(get_db)
) -> User:
    """Authenticate via ?token= query param (for file preview in new tab)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    user_id: int = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise credentials_exception
    return user
```

Also export it in the same file (it's imported directly so no extra action needed).

**Step 2: Add the preview endpoint to `backend/api.py`**

Add these imports near the top of `backend/api.py` (after existing imports):

```python
from fastapi.responses import HTMLResponse, Response
from backend.auth import get_user_from_token_param
```

Then add the preview endpoint after the download endpoint (after line 556):

```python
@app.get("/projects/{project_id}/documents/{document_id}/preview")
async def preview_document(
    project_id: int,
    document_id: int,
    token: str,
    raw: bool = False,
    current_user: User = Depends(get_user_from_token_param),
    db: Session = Depends(get_db)
):
    """Render a document preview in the browser."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    document = db.query(Document).filter(
        Document.id == document_id,
        Document.project_id == project_id
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = document.file_path
    original_name = document.original_filename or ""
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""

    # raw=True: serve the raw file bytes (used by IFC 3D viewer to load the model)
    if raw:
        with open(file_path, "rb") as f:
            content = f.read()
        return Response(content=content, media_type="application/octet-stream")

    # PDF — serve directly, browser renders natively
    if ext == "pdf":
        return FileResponse(file_path, media_type="application/pdf", headers={
            "Content-Disposition": f'inline; filename="{original_name}"'
        })

    # Images — serve directly
    if ext in ("png", "jpg", "jpeg", "gif", "webp"):
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "gif": "image/gif", "webp": "image/webp"}.get(ext, "image/jpeg")
        return FileResponse(file_path, media_type=mime, headers={
            "Content-Disposition": f'inline; filename="{original_name}"'
        })

    # DOCX / DOC
    if ext in ("docx", "doc"):
        html = _render_docx_html(file_path, original_name)
        return HTMLResponse(content=html)

    # XLSX / XLS / CSV
    if ext in ("xlsx", "xls", "csv"):
        html = _render_spreadsheet_html(file_path, original_name, ext)
        return HTMLResponse(content=html)

    # DWG / DXF
    if ext in ("dxf", "dwg"):
        html = _render_dxf_html(file_path, original_name)
        return HTMLResponse(content=html)

    # IFC / BIM
    if ext in ("ifc",):
        preview_url = f"/api/projects/{project_id}/documents/{document_id}/preview?token={token}&raw=true"
        html = _render_ifc_html(file_path, original_name, preview_url)
        return HTMLResponse(content=html)

    # Fallback — unsupported type
    return HTMLResponse(content=_unsupported_html(original_name))
```

**Step 3: Add `_render_docx_html` helper to `backend/api.py`**

Add after the endpoint (helpers at module level, not inside the endpoint):

```python
def _preview_page(title: str, body: str, extra_head: str = "") -> str:
    """Wrap content in a clean preview HTML page."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
{extra_head}
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f8f7f3; color: #1c1b18; padding: 0; }}
  .header {{ background: #1c1b18; color: #f0ede4; padding: 12px 24px;
             display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }}
  .header .filename {{ font-size: 0.8rem; font-family: 'SF Mono', monospace;
                       opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
  .header .badge {{ font-size: 0.6rem; font-family: monospace; letter-spacing: 0.1em;
                    padding: 2px 8px; border: 1px solid rgba(255,255,255,0.2);
                    color: #f5c800; border-color: rgba(245,200,0,0.4); flex-shrink: 0; }}
  .content {{ max-width: 900px; margin: 0 auto; padding: 32px 24px; }}
</style>
</head>
<body>
<div class="header">
  <span class="badge">FOREPERSON</span>
  <span class="filename">{title}</span>
</div>
<div class="content">{body}</div>
</body>
</html>"""


def _render_docx_html(file_path: str, name: str) -> str:
    try:
        from docx import Document as DocxDocument
        doc = DocxDocument(file_path)
        parts = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                parts.append("<br>")
                continue
            style = para.style.name if para.style else ""
            if style.startswith("Heading 1"):
                parts.append(f"<h1 style='font-size:1.6rem;font-weight:700;margin:1.5rem 0 0.5rem'>{text}</h1>")
            elif style.startswith("Heading 2"):
                parts.append(f"<h2 style='font-size:1.2rem;font-weight:600;margin:1.2rem 0 0.4rem'>{text}</h2>")
            elif style.startswith("Heading 3"):
                parts.append(f"<h3 style='font-size:1rem;font-weight:600;margin:1rem 0 0.3rem'>{text}</h3>")
            else:
                parts.append(f"<p style='margin:0.4rem 0;line-height:1.7;font-size:0.92rem'>{text}</p>")
        body = "\n".join(parts) or "<p style='color:#999'>Document appears to be empty.</p>"
    except Exception as e:
        body = f"<p style='color:#ef4444'>Could not render document: {e}</p>"
    return _preview_page(name, body)
```

**Step 4: Add `_render_spreadsheet_html` helper**

```python
def _render_spreadsheet_html(file_path: str, name: str, ext: str) -> str:
    try:
        import pandas as pd
        if ext == "csv":
            df = pd.read_csv(file_path, nrows=500)
        else:
            df = pd.read_excel(file_path, nrows=500)
        # Convert to HTML table
        table_html = df.to_html(
            index=False,
            border=0,
            classes="data-table",
            na_rep="",
        )
        body = f"""
<style>
  .data-table {{ border-collapse: collapse; width: 100%; font-size: 0.8rem; }}
  .data-table th {{ background: #1c1b18; color: #f0ede4; padding: 8px 12px;
                    text-align: left; font-family: monospace; font-size: 0.7rem;
                    letter-spacing: 0.06em; white-space: nowrap; }}
  .data-table td {{ padding: 7px 12px; border-bottom: 1px solid #e0ddd4;
                    color: #1c1b18; vertical-align: top; }}
  .data-table tr:hover td {{ background: #f0ede4; }}
  .row-count {{ font-family: monospace; font-size: 0.7rem; color: #7a7268;
                margin-bottom: 12px; }}
</style>
<p class="row-count">Showing {min(len(df), 500)} rows × {len(df.columns)} columns</p>
<div style="overflow-x:auto">{table_html}</div>"""
    except Exception as e:
        body = f"<p style='color:#ef4444'>Could not render spreadsheet: {e}</p>"
    return _preview_page(name, body)
```

**Step 5: Add `_render_dxf_html` helper**

```python
def _render_dxf_html(file_path: str, name: str) -> str:
    try:
        import ezdxf
        from ezdxf import recover as ezdxf_recover
        import io, base64
        try:
            doc, _ = ezdxf_recover.readfile(file_path)
        except Exception:
            doc = ezdxf.readfile(file_path)

        # Render to SVG via ezdxf's drawing addon
        from ezdxf.addons.drawing import RenderContext, Frontend
        from ezdxf.addons.drawing.svg import SVGBackend
        context = RenderContext(doc)
        backend = SVGBackend()
        Frontend(context, backend).draw_layout(doc.modelspace())
        svg_xml = backend.get_xml_root()
        import xml.etree.ElementTree as ET
        svg_str = ET.tostring(svg_xml, encoding="unicode")
        body = f"""
<style>
  .svg-wrap {{ background: white; border: 1px solid #e0ddd4; padding: 16px;
              border-radius: 2px; overflow: auto; }}
  .svg-wrap svg {{ max-width: 100%; height: auto; display: block; }}
</style>
<div class="svg-wrap">{svg_str}</div>"""
    except Exception as e:
        body = f"<p style='color:#ef4444'>Could not render drawing: {e}</p><p style='color:#7a7268;font-size:0.85rem;margin-top:8px'>DWG files may require conversion. Try re-exporting as DXF.</p>"
    return _preview_page(name, body)
```

**Step 6: Add `_unsupported_html` helper**

```python
def _unsupported_html(name: str) -> str:
    body = """
<div style='text-align:center;padding:60px 0'>
  <p style='font-size:2rem;margin-bottom:16px'>📄</p>
  <p style='font-size:1rem;font-weight:600;margin-bottom:8px'>Preview not available</p>
  <p style='color:#7a7268;font-size:0.85rem'>This file type cannot be previewed in the browser.</p>
</div>"""
    return _preview_page(name, body)
```

**Step 7: Commit**

```bash
cd /Users/raunakbalchandani/Downloads/foreperson-local
git add backend/auth.py backend/api.py
git commit -m "feat: add file preview endpoint (PDF, images, DOCX, XLSX, DXF)"
```

---

## Task 2: Backend — IFC/BIM Preview (Metadata + 3D Viewer)

**Files:**
- Modify: `backend/api.py` — add `_render_ifc_html` helper
- Modify: `backend/requirements.txt` — add `ifcopenshell`

**Context:**
- `ifcopenshell` is a Python library for parsing IFC files. Install with `pip install ifcopenshell`.
- The 3D viewer uses `web-ifc-viewer` loaded from CDN (no npm install).
- The preview HTML page layout: left panel = metadata, right panel = Three.js canvas with web-ifc-viewer.
- `preview_url` (passed in) is the `/preview?token=...&raw=true` URL the viewer uses to load the IFC binary.

**Step 1: Add ifcopenshell to requirements.txt**

In `backend/requirements.txt`, add after the existing AI provider deps:

```
# BIM / IFC support
ifcopenshell>=0.7.0
```

**Step 2: Add `_render_ifc_html` helper to `backend/api.py`**

```python
def _render_ifc_html(file_path: str, name: str, preview_url: str) -> str:
    # Extract metadata with ifcopenshell
    metadata_html = ""
    try:
        import ifcopenshell
        ifc = ifcopenshell.open(file_path)

        # Project info
        projects = ifc.by_type("IfcProject")
        proj_name = projects[0].Name if projects else "Unknown"
        proj_desc = projects[0].Description if projects and projects[0].Description else ""

        # Element counts
        def count(ifc_type):
            try:
                return len(ifc.by_type(ifc_type))
            except Exception:
                return 0

        elements = {
            "Storeys": count("IfcBuildingStorey"),
            "Spaces": count("IfcSpace"),
            "Walls": count("IfcWall"),
            "Slabs": count("IfcSlab"),
            "Columns": count("IfcColumn"),
            "Beams": count("IfcBeam"),
            "Doors": count("IfcDoor"),
            "Windows": count("IfcWindow"),
            "Stairs": count("IfcStair"),
            "Roofs": count("IfcRoof"),
        }

        rows = "".join(
            f"<tr><td class='label'>{k}</td><td class='val'>{v}</td></tr>"
            for k, v in elements.items() if v > 0
        )

        metadata_html = f"""
<div class="meta-panel">
  <div class="meta-header">
    <div class="meta-badge">BIM</div>
    <h2 class="meta-title">{proj_name or name}</h2>
    {f'<p class="meta-desc">{proj_desc}</p>' if proj_desc else ''}
  </div>
  <table class="meta-table">
    <tbody>{rows}</tbody>
  </table>
  <p class="meta-file">{name}</p>
</div>"""
    except Exception as e:
        metadata_html = f"""
<div class="meta-panel">
  <div class="meta-header">
    <div class="meta-badge">BIM</div>
    <h2 class="meta-title">{name}</h2>
  </div>
  <p style="color:#7a7268;font-size:0.8rem;padding:16px">Could not parse metadata: {e}</p>
</div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{name}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{ height: 100%; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }}
  body {{ display: flex; flex-direction: column; background: #111110; color: #f0ede4; }}

  .header {{ background: #1c1b18; padding: 10px 20px; display: flex; align-items: center;
             gap: 12px; border-bottom: 1px solid #313130; flex-shrink: 0; }}
  .header .badge {{ font-size: 0.6rem; font-family: monospace; letter-spacing: 0.1em;
                    padding: 2px 8px; color: #f5c800; border: 1px solid rgba(245,200,0,0.4); }}
  .header .filename {{ font-size: 0.8rem; font-family: monospace; opacity: 0.6;
                       overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}

  .main {{ display: flex; flex: 1; overflow: hidden; }}

  .meta-panel {{ width: 280px; flex-shrink: 0; background: #1a1a18; border-right: 1px solid #313130;
                 overflow-y: auto; display: flex; flex-direction: column; }}
  .meta-header {{ padding: 20px; border-bottom: 1px solid #313130; }}
  .meta-badge {{ font-size: 0.55rem; font-family: monospace; letter-spacing: 0.12em;
                 color: #f5c800; border: 1px solid rgba(245,200,0,0.3); padding: 2px 6px;
                 display: inline-block; margin-bottom: 10px; }}
  .meta-title {{ font-size: 1rem; font-weight: 700; line-height: 1.3; color: #f0ede4; }}
  .meta-desc {{ font-size: 0.75rem; color: #7a7268; margin-top: 6px; line-height: 1.5; }}
  .meta-table {{ width: 100%; border-collapse: collapse; }}
  .meta-table tr {{ border-bottom: 1px solid #232320; }}
  .meta-table td {{ padding: 10px 20px; font-size: 0.8rem; }}
  .meta-table .label {{ color: #7a7268; font-family: monospace; font-size: 0.7rem;
                         letter-spacing: 0.06em; width: 50%; }}
  .meta-table .val {{ color: #f0ede4; font-weight: 600; font-family: monospace; text-align: right; }}
  .meta-file {{ font-family: monospace; font-size: 0.65rem; color: #4a4a48;
                padding: 16px 20px; margin-top: auto; }}

  .viewer-wrap {{ flex: 1; position: relative; background: #0d0d0c; }}
  #viewer-canvas {{ width: 100%; height: 100%; display: block; }}
  .viewer-loading {{ position: absolute; inset: 0; display: flex; align-items: center;
                      justify-content: center; flex-direction: column; gap: 12px;
                      background: #0d0d0c; z-index: 5; }}
  .viewer-loading p {{ font-family: monospace; font-size: 0.75rem; color: #7a7268;
                        letter-spacing: 0.08em; }}
  .spinner {{ width: 32px; height: 32px; border: 2px solid #313130;
              border-top-color: #f5c800; border-radius: 50%;
              animation: spin 0.8s linear infinite; }}
  @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
  .viewer-error {{ position: absolute; inset: 0; display: none; align-items: center;
                   justify-content: center; flex-direction: column; gap: 8px; }}
  .viewer-error p {{ font-size: 0.85rem; color: #7a7268; font-family: monospace; }}
</style>
</head>
<body>
<div class="header">
  <span class="badge">FOREPERSON · BIM</span>
  <span class="filename">{name}</span>
</div>
<div class="main">
  {metadata_html}
  <div class="viewer-wrap">
    <div class="viewer-loading" id="loading">
      <div class="spinner"></div>
      <p>LOADING 3D MODEL…</p>
    </div>
    <div class="viewer-error" id="error">
      <p>3D viewer unavailable</p>
      <p style="font-size:0.7rem;color:#4a4a48">Metadata shown on left panel</p>
    </div>
    <canvas id="viewer-canvas"></canvas>
  </div>
</div>

<script type="module">
  // Use web-ifc-viewer via CDN
  import {{ IfcViewerAPI }} from 'https://unpkg.com/web-ifc-viewer@1.0.220/dist/index.js';
  import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

  const container = document.querySelector('.viewer-wrap');
  const loading = document.getElementById('loading');
  const errorEl = document.getElementById('error');

  try {{
    const viewer = new IfcViewerAPI({{
      container,
      backgroundColor: new THREE.Color(0x0d0d0c),
    }});

    viewer.axes.setAxes();
    viewer.grid.setGrid();
    viewer.IFC.setWasmPath('https://unpkg.com/web-ifc@0.0.44/');

    await viewer.IFC.loadIfcUrl('{preview_url}', true, (progress) => {{
      if (progress.total > 0) {{
        const pct = Math.round((progress.loaded / progress.total) * 100);
        document.querySelector('#loading p').textContent = `LOADING 3D MODEL… ${{pct}}%`;
      }}
    }});

    loading.style.display = 'none';
  }} catch (e) {{
    console.error('IFC viewer error:', e);
    loading.style.display = 'none';
    errorEl.style.display = 'flex';
  }}
</script>
</body>
</html>"""
```

**Step 3: Install ifcopenshell on EC2**

After committing, SSH to EC2 and install:
```bash
ssh -i ~/Downloads/foreperson+clawdbot.pem ec2-user@44.223.71.110 \
  "cd /opt/foreperson && source .venv/bin/activate && pip install ifcopenshell && sudo systemctl restart foreperson-backend"
```

If `ifcopenshell` isn't available via pip for the Python version, use conda or the official wheel:
```bash
pip install ifcopenshell --extra-index-url https://blenderbim.org/pypi/
```

**Step 4: Commit**

```bash
git add backend/api.py backend/requirements.txt
git commit -m "feat: IFC/BIM preview — metadata panel + web-ifc 3D viewer"
```

---

## Task 3: Frontend — Preview Button in FilesTab

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx` — add Preview button in grid + list views, update accept list
- Modify: `frontend/src/lib/api.ts` — add `previewUrl` helper

**Context:**
- Token is stored in `localStorage.getItem('token')` (see `frontend/src/lib/api.ts` line 8)
- Grid cards are at `page.tsx` lines 682–743, list rows at lines 756–800
- Each file has `f.id` (the document ID as string) and `currentProject.id` (project ID as string)
- The preview URL is: `/api/projects/{projectId}/documents/{docId}/preview?token={jwt}`
- Grid card: delete button is top-right absolutely positioned. Add Preview button to bottom of card.
- List row: grid is `grid-cols-[1fr_140px_80px_70px_32px]` — add a new column for Preview.
- Import `Eye` from lucide-react for the preview button icon.

**Step 1: Add `Eye` to lucide-react import**

Find the lucide-react import line (line ~14) and add `Eye` to it:
```tsx
import { ..., Eye, ... } from 'lucide-react'
```

**Step 2: Add `previewUrl` helper to `frontend/src/lib/api.ts`**

At the bottom of `frontend/src/lib/api.ts`, add:

```typescript
export function previewUrl(projectId: number, documentId: number): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return `/api/projects/${projectId}/documents/${documentId}/preview?token=${token ?? ''}`
}
```

**Step 3: Add Preview button to grid cards**

In `page.tsx`, find the grid card section. The delete button is:
```tsx
<button onClick={() => onDelete(f.id)}
  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5"
```

Add a Preview button right before it (also absolutely positioned, top-left):
```tsx
<button
  onClick={() => window.open(previewUrl(parseInt(currentProject!.id), parseInt(f.id)), '_blank')}
  className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5"
  style={{ color: 'var(--text-secondary)' }}
  title="Preview"
  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
  <Eye size={12} />
</button>
```

Note: `currentProject` is not available inside `FilesTab` directly — it's passed as a prop. Check if FilesTab receives `currentProject`. Looking at the component signature at line 477:
```tsx
function FilesTab({ files, onUpload, onDelete, isUploading, onSearch, searchQuery, searchResults }
```

It does NOT have `currentProject`. You need to:
1. Add `currentProject: Project | null` to the FilesTab props interface
2. Pass it when rendering FilesTab at line 2253:
   ```tsx
   <FilesTab ... currentProject={current} />
   ```

**Step 4: Add Preview button to list rows**

In the list view, find the grid column definition:
```tsx
<div className="grid grid-cols-[1fr_140px_80px_70px_32px] gap-4 px-4 py-2"
```

Change to:
```tsx
<div className="grid grid-cols-[1fr_140px_80px_70px_32px_32px] gap-4 px-4 py-2"
```

Add a header cell for the new column:
```tsx
<span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>PREVIEW</span>
```

In each list row, find the identical grid definition and update it too. Then add a Preview button cell before the delete button:

```tsx
<button
  onClick={() => window.open(previewUrl(parseInt(currentProject!.id), parseInt(f.id)), '_blank')}
  className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
  style={{ color: 'var(--text-secondary)' }}
  title="Preview"
  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
  <Eye size={12} />
</button>
```

**Step 5: Update file accept attribute to include .ifc**

Find all `accept=` attributes in FilesTab (there are 2 — the hidden input and the drop zone label). Add `.ifc`:
```tsx
accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.dwg,.dxf,.ifc,.png,.jpg,.jpeg"
```

Also update the text label showing accepted types from `PDF · DOCX · XLSX · PNG · JPG · DWG · DXF · CSV` to include `IFC`.

**Step 6: Import `previewUrl` in page.tsx**

At the top of `page.tsx`, find the api import line:
```tsx
import * as api from '@/lib/api'
```

Change to also import the helper:
```tsx
import * as api from '@/lib/api'
import { previewUrl } from '@/lib/api'
```

**Step 7: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx frontend/src/lib/api.ts
git commit -m "feat: add Preview button to file grid and list views"
```

---

## Task 4: Deploy

**Step 1: Push and deploy**

```bash
git push origin main
ssh -i ~/Downloads/foreperson+clawdbot.pem ec2-user@44.223.71.110 \
  "cd /opt/foreperson && bash deploy.sh"
```

**Step 2: Install ifcopenshell on EC2 if not done in Task 2**

```bash
ssh -i ~/Downloads/foreperson+clawdbot.pem ec2-user@44.223.71.110 \
  "cd /opt/foreperson && source .venv/bin/activate && pip install ifcopenshell && sudo systemctl restart foreperson-backend"
```

**Step 3: Verify**

- Upload a PDF → click Preview → should open PDF in new tab
- Upload a DOCX → click Preview → should open styled HTML page
- Upload a CSV or XLSX → click Preview → should show HTML table
- Upload a DXF → click Preview → should show SVG rendering
- Upload an IFC → click Preview → should show metadata panel + 3D viewer loading

---
