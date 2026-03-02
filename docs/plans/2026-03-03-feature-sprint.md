# Feature Sprint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 9 product-quality features to Foreperson.ai — parse quality warnings, onboarding empty states, mobile layout fixes, dashboard analytics, document content search, bulk upload with progress, AI citations, conflict workflow (resolve/dismiss), and PDF export.

**Architecture:** All backend changes go in `backend/api.py`, `backend/database.py`, `ai_assistant.py`, or `document_parser.py`. All frontend changes go in `frontend/src/app/dashboard/page.tsx` (monolithic component) and `frontend/src/lib/api.ts`. There are no tests in this project — skip writing tests.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy + SQLite, Next.js 15, TypeScript strict, Tailwind, lucide-react, react-markdown

---

## Task 1: Parse Quality Warnings

Show a badge (POOR / EMPTY) on document rows when text extraction produced little or no content. This helps users know a file may need re-upload or manual review.

**Files:**
- Modify: `document_parser.py` — add `parse_quality` to returned dict
- Modify: `backend/database.py` — add `parse_quality` column to `Document` model
- Modify: `backend/api.py` — store `parse_quality`, add startup migration
- Modify: `frontend/src/app/dashboard/page.tsx` — show badge in FilesTab

**Step 1: Add parse_quality to document_parser.py**

In `document_parser.py`, find the `parse_document()` method return statement. The current return dict has at minimum `text_content`, `word_count`, `filename`, `file_path`, `document_type`. Add `parse_quality` before returning:

```python
# Near the end of parse_document(), before or at the return statement
word_count = len((result.get('text_content') or '').split())
if word_count == 0:
    parse_quality = 'empty'
elif word_count < 50:
    parse_quality = 'low'
else:
    parse_quality = 'good'
result['parse_quality'] = parse_quality
```

Search for where `parse_document` returns its dict and add this block. The exact location varies — look for `return {` containing `'text_content'` or `return result`.

**Step 2: Add parse_quality column to Document model**

In `backend/database.py`, in the `Document` class, add after the `summary` column:

```python
parse_quality = Column(String(20), default="good")  # 'good', 'low', 'empty'
```

**Step 3: Store parse_quality in upload endpoint and add migration**

In `backend/api.py`, in the `startup()` function (the `@app.on_event("startup")` handler), add a migration alongside the existing `chats.title` migration:

```python
try:
    conn.execute(__import__('sqlalchemy').text(
        "ALTER TABLE documents ADD COLUMN parse_quality VARCHAR(20) DEFAULT 'good'"
    ))
    conn.commit()
except Exception:
    pass  # Column already exists
```

In the `upload_document` endpoint, when creating the `Document` object, add:

```python
parse_quality=result.get('parse_quality', 'good') if DocumentParser and extracted_text is not None else 'good',
```

Also update `DocumentResponse` Pydantic model to include:

```python
parse_quality: Optional[str] = "good"
```

**Step 4: Show badge in FilesTab frontend**

In `frontend/src/app/dashboard/page.tsx`, in the `DocumentResponse` interface (or the inline rendering of file rows in FilesTab), find where each document row is rendered. After the filename/type display, add a quality badge:

```tsx
{doc.parse_quality === 'empty' && (
  <span style={{
    fontSize: '0.6rem', padding: '1px 5px',
    backgroundColor: 'rgba(248,113,113,0.15)',
    color: '#f87171', border: '1px solid rgba(248,113,113,0.3)',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.05em'
  }}>EMPTY</span>
)}
{doc.parse_quality === 'low' && (
  <span style={{
    fontSize: '0.6rem', padding: '1px 5px',
    backgroundColor: 'rgba(251,191,36,0.15)',
    color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.05em'
  }}>POOR</span>
)}
```

Also add `parse_quality?: string` to the `api.Document` interface in `frontend/src/lib/api.ts`.

**Step 5: Commit**

```bash
cd /Users/raunakbalchandani/Downloads/foreperson-local
git add document_parser.py backend/database.py backend/api.py frontend/src/app/dashboard/page.tsx frontend/src/lib/api.ts
git commit -m "feat: add parse quality warnings for poorly-extracted documents"
```

---

## Task 2: Onboarding Empty States

Replace blank areas with helpful, action-oriented empty states. This dramatically improves first-run UX.

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx` — add empty states in 4 places

**Step 1: Empty state when no projects exist**

In the Sidebar component's project list, find:
```tsx
<p className="text-xs py-1 px-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>No projects</p>
```

Replace with:
```tsx
<div className="py-2 px-1 space-y-2">
  <p className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>No projects yet</p>
  <button onClick={onNew} className="text-xs underline" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
    + Create first project →
  </button>
</div>
```

**Step 2: Empty state in FilesTab when no documents**

Find the files list rendering (the area that maps over `files` or `documents`). Add a guard before the list:

```tsx
{files.length === 0 && (
  <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
    <Upload size={32} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No documents yet</p>
    <p className="text-xs max-w-xs" style={{ color: 'var(--text-secondary)' }}>
      Upload contracts, specs, RFIs, drawings, or any construction document to get started.
    </p>
    <label className="btn-primary cursor-pointer text-xs">
      Upload Document
      <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.dwg,.dxf,.png,.jpg" onChange={handleFileUpload} />
    </label>
  </div>
)}
```

**Step 3: Empty state in ChatTab when no messages**

Find where chat messages are rendered (the message list). Add before the messages map:

```tsx
{messages.length === 0 && (
  <div className="flex flex-col items-center justify-center flex-1 space-y-4 text-center px-4">
    <div className="w-12 h-12 flex items-center justify-center" style={{ backgroundColor: 'var(--accent)', opacity: 0.15 }}>
      <MessageSquare size={24} style={{ color: 'var(--accent)' }} />
    </div>
    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ask Foreperson anything</p>
    <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
      {[
        'Summarize all contracts',
        'What are the key deadlines?',
        'Find any scope conflicts',
        'Who are the key parties?',
      ].map((prompt) => (
        <button key={prompt} onClick={() => handleSendMessage(prompt)}
          className="text-xs px-3 py-2 text-left transition-colors"
          style={{
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
          {prompt} →
        </button>
      ))}
    </div>
  </div>
)}
```

**Step 4: Empty state in ConflictsTab when no conflicts found**

Find where conflicts are rendered (after the analyze button). Add a "no conflicts" state after a scan completes with zero results:

```tsx
{hasScanned && conflicts.length === 0 && (
  <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
    <CheckCircle2 size={28} style={{ color: '#34d399' }} />
    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No conflicts found</p>
    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your documents appear to be consistent with each other.</p>
  </div>
)}
```

You'll need to add a `hasScanned` boolean state that gets set to `true` after the conflicts API call completes (whether or not conflicts were found). Find the `handleAnalyzeConflicts` function and add `setHasScanned(true)` in the `finally` block.

**Step 5: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: add onboarding empty states across all tabs"
```

---

## Task 3: Mobile Layout Fixes

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx` — fix mobile issues

**Step 1: Fix mobile sidebar scroll lock**

When the sidebar overlay is open on mobile, body scrolling should be locked. Add a `useEffect` that toggles `document.body.style.overflow`:

```tsx
// Near other useEffects in the main Dashboard component
useEffect(() => {
  if (sidebarOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
  return () => { document.body.style.overflow = '' }
}, [sidebarOpen])
```

**Step 2: Fix chat input on mobile (prevent zoom on iOS)**

iOS Safari zooms when a font-size is < 16px. Find the chat textarea/input element and ensure `fontSize: '16px'` is in its style, or use a CSS class with `text-base`:

```tsx
// On the chat input textarea, add to style:
fontSize: '16px',
```

**Step 3: Fix chat messages scroll on mobile**

The messages container needs `-webkit-overflow-scrolling: touch` and proper height on mobile. Find the messages container div (the one with overflow-y-auto) and add to its style:

```tsx
style={{
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch' as const,
  // ensure it doesn't grow beyond viewport on mobile
}}
```

**Step 4: Fix files table/list on mobile**

If the files tab renders a table, it likely overflows on mobile. Find the files container and add horizontal scroll:

```tsx
// Wrap the files table/list in:
<div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as const }}>
  {/* existing files table */}
</div>
```

**Step 5: Add mobile-friendly conflict cards stacking**

Find the conflicts grid/layout and ensure it stacks on mobile. Replace any `grid-cols-2` or `flex` row with a responsive equivalent using `flex-col sm:flex-row` or CSS media query.

**Step 6: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "fix: mobile layout — scroll lock, iOS zoom, overflow fixes"
```

---

## Task 4: Dashboard Analytics

Add a stats section to the Overview tab showing document counts, word totals, chat activity, and memory facts.

**Files:**
- Modify: `backend/api.py` — add `GET /projects/{id}/analytics` endpoint
- Modify: `frontend/src/lib/api.ts` — add `analytics` API methods
- Modify: `frontend/src/app/dashboard/page.tsx` — load + display analytics in OverviewTab

**Step 1: Add analytics endpoint to backend**

In `backend/api.py`, add after the existing project routes:

```python
@app.get("/projects/{project_id}/analytics")
async def get_project_analytics(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return analytics summary for a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    docs = db.query(Document).filter(Document.project_id == project_id).all()

    # Document type breakdown
    type_breakdown: dict = {}
    total_words = 0
    for doc in docs:
        t = doc.document_type or 'unknown'
        type_breakdown[t] = type_breakdown.get(t, 0) + 1
        if doc.extracted_text:
            total_words += len(doc.extracted_text.split())

    chat_count = db.query(Chat).filter(
        Chat.project_id == project_id,
        Chat.user_id == current_user.id
    ).count()

    message_count = (
        db.query(ChatMessage)
        .join(Chat, Chat.id == ChatMessage.chat_id)
        .filter(Chat.project_id == project_id)
        .count()
    )

    memory_count = db.query(ProjectMemory).filter(
        ProjectMemory.project_id == project_id
    ).count()

    return {
        "doc_count": len(docs),
        "total_words": total_words,
        "type_breakdown": type_breakdown,
        "chat_count": chat_count,
        "message_count": message_count,
        "memory_fact_count": memory_count,
    }
```

**Step 2: Add analytics to api.ts**

In `frontend/src/lib/api.ts`, add after the `documents` export:

```typescript
export interface ProjectAnalytics {
  doc_count: number
  total_words: number
  type_breakdown: Record<string, number>
  chat_count: number
  message_count: number
  memory_fact_count: number
}

export const analytics = {
  get: (projectId: number) =>
    request<ProjectAnalytics>(`/projects/${projectId}/analytics`),
}
```

**Step 3: Load and display analytics in OverviewTab**

In `frontend/src/app/dashboard/page.tsx`:

Add state: `const [projectAnalytics, setProjectAnalytics] = useState<api.ProjectAnalytics | null>(null)`

Load it when current project changes (alongside other data loads):
```tsx
if (current) {
  api.analytics.get(parseInt(current.id)).then(setProjectAnalytics).catch(() => {})
}
```

In the OverviewTab render section, find where overview content is shown and add analytics cards. Look for the OverviewTab component/section and add:

```tsx
{projectAnalytics && (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
    {[
      { label: 'DOCUMENTS', value: projectAnalytics.doc_count, icon: FileText },
      { label: 'TOTAL WORDS', value: projectAnalytics.total_words.toLocaleString(), icon: Search },
      { label: 'CHAT THREADS', value: projectAnalytics.chat_count, icon: MessageSquare },
      { label: 'MESSAGES', value: projectAnalytics.message_count, icon: MessageSquare },
      { label: 'MEMORY FACTS', value: projectAnalytics.memory_fact_count, icon: HardHat },
    ].map(({ label, value, icon: Icon }) => (
      <div key={label} className="p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{label}</p>
        <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
      </div>
    ))}
  </div>
)}
```

Also add a doc type breakdown chart (simple bar visualization):
```tsx
{projectAnalytics && Object.keys(projectAnalytics.type_breakdown).length > 0 && (
  <div className="mb-6 p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
    <p className="label-mono mb-3" style={{ fontFamily: 'var(--font-mono)' }}>DOCUMENT TYPES</p>
    <div className="space-y-2">
      {Object.entries(projectAnalytics.type_breakdown)
        .sort(([,a],[,b]) => b - a)
        .map(([type, count]) => {
          const c = cat(type)
          const pct = Math.round((count / projectAnalytics.doc_count) * 100)
          return (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{c.label}</span>
              <div className="flex-1 h-1.5" style={{ backgroundColor: 'var(--border)' }}>
                <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} />
              </div>
              <span className="text-xs w-5 text-right" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{count}</span>
            </div>
          )
        })}
    </div>
  </div>
)}
```

**Step 4: Commit**

```bash
git add backend/api.py frontend/src/lib/api.ts frontend/src/app/dashboard/page.tsx
git commit -m "feat: add dashboard analytics — doc types, word count, chat stats"
```

---

## Task 5: Document Content Search

Let users search across all document text in a project. Shows matching snippets with the document name.

**Files:**
- Modify: `backend/api.py` — add `GET /projects/{id}/search?q=`
- Modify: `frontend/src/lib/api.ts` — add search method
- Modify: `frontend/src/app/dashboard/page.tsx` — add search UI in FilesTab

**Step 1: Add search endpoint**

In `backend/api.py`, add after the delete document route:

```python
@app.get("/projects/{project_id}/search")
async def search_documents(
    project_id: int,
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Full-text search across document content in a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not q or len(q.strip()) < 2:
        return {"results": []}

    term = q.strip().lower()
    docs = db.query(Document).filter(
        Document.project_id == project_id,
        Document.extracted_text.isnot(None)
    ).all()

    results = []
    for doc in docs:
        text = (doc.extracted_text or "").lower()
        idx = text.find(term)
        if idx == -1:
            continue
        # Build snippet (80 chars before and after match)
        start = max(0, idx - 80)
        end = min(len(text), idx + len(term) + 80)
        snippet = (doc.extracted_text or "")[start:end].strip()
        if start > 0:
            snippet = "…" + snippet
        if end < len(doc.extracted_text or ""):
            snippet = snippet + "…"
        results.append({
            "doc_id": doc.id,
            "filename": doc.original_filename,
            "document_type": doc.document_type or "unknown",
            "snippet": snippet,
            "match_count": text.count(term),
        })

    # Sort by match count descending
    results.sort(key=lambda r: r["match_count"], reverse=True)
    return {"results": results[:20]}  # Cap at 20 results
```

**Step 2: Add search to api.ts**

In `frontend/src/lib/api.ts`, add to the `documents` export:

```typescript
export interface SearchResult {
  doc_id: number
  filename: string
  document_type: string
  snippet: string
  match_count: number
}

// Add to documents object:
search: (projectId: number, q: string) =>
  request<{ results: SearchResult[] }>(`/projects/${projectId}/search?q=${encodeURIComponent(q)}`),
```

**Step 3: Add search UI in FilesTab**

In `frontend/src/app/dashboard/page.tsx`:

Add state in the main Dashboard: `const [searchQuery, setSearchQuery] = useState('')` and `const [searchResults, setSearchResults] = useState<api.SearchResult[] | null>(null)`

In the FilesTab section, add a search bar above the file list:

```tsx
<div className="flex items-center gap-2 mb-4" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
  <Search size={14} className="ml-3 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
  <input
    type="text"
    placeholder="Search document content…"
    value={searchQuery}
    onChange={(e) => {
      setSearchQuery(e.target.value)
      if (!e.target.value.trim()) { setSearchResults(null); return }
      // Debounce: simple approach with setTimeout
      clearTimeout((window as any).__searchTimeout)
      ;(window as any).__searchTimeout = setTimeout(async () => {
        if (!current) return
        const res = await api.documents.search(parseInt(current.id), e.target.value)
        setSearchResults(res.results)
      }, 400)
    }}
    className="flex-1 py-2 px-2 text-sm bg-transparent outline-none"
    style={{ color: 'var(--text-primary)' }}
  />
  {searchQuery && (
    <button onClick={() => { setSearchQuery(''); setSearchResults(null) }}
      className="mr-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
      <X size={13} />
    </button>
  )}
</div>
```

Then show search results when active:
```tsx
{searchResults !== null && (
  <div className="space-y-2 mb-4">
    {searchResults.length === 0
      ? <p className="text-sm py-2 px-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>No results for "{searchQuery}"</p>
      : searchResults.map((r) => (
        <div key={r.doc_id} className="p-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.filename}</span>
            <span className="label-mono" style={{ fontFamily: 'var(--font-mono)', color: cat(r.document_type).color }}>
              {cat(r.document_type).label}
            </span>
            <span className="label-mono ml-auto" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              {r.match_count} match{r.match_count !== 1 ? 'es' : ''}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.snippet}</p>
        </div>
      ))
    }
  </div>
)}
```

**Step 4: Commit**

```bash
git add backend/api.py frontend/src/lib/api.ts frontend/src/app/dashboard/page.tsx
git commit -m "feat: add document content search with snippet highlighting"
```

---

## Task 6: Bulk Upload with Progress

Allow selecting multiple files at once and show per-file upload progress.

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx` — multi-file input + progress tracking

**Step 1: Add upload progress state**

Add to the Dashboard component state:

```tsx
const [uploadQueue, setUploadQueue] = useState<Array<{ name: string; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }>>([])
```

**Step 2: Change file input to accept multiple**

Find the `<input type="file">` in the FilesTab (and any other upload inputs). Change:

```tsx
// Before:
<input type="file" className="hidden" accept="..." onChange={handleFileUpload} />

// After:
<input type="file" className="hidden" multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.dwg,.dxf,.png,.jpg,.jpeg" onChange={handleBulkUpload} />
```

**Step 3: Implement handleBulkUpload**

Replace or add alongside `handleFileUpload`:

```tsx
const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || [])
  if (!files.length || !current) return

  // Reset input so same files can be uploaded again
  e.target.value = ''

  const queue = files.map(f => ({ name: f.name, status: 'pending' as const }))
  setUploadQueue(queue)

  for (let i = 0; i < files.length; i++) {
    setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item))
    try {
      await api.documents.upload(parseInt(current.id), files[i])
      setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item))
    } catch (err) {
      setUploadQueue(prev => prev.map((item, idx) => idx === i ? {
        ...item, status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed'
      } : item))
    }
  }

  // Refresh file list after all done
  loadDocuments()
  // Clear queue after 3s
  setTimeout(() => setUploadQueue([]), 3000)
}
```

**Step 4: Show upload progress UI**

Add after the upload button area in FilesTab (or as a floating progress panel):

```tsx
{uploadQueue.length > 0 && (
  <div className="fixed bottom-4 right-4 w-72 z-50 shadow-lg"
    style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
    <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs font-semibold uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
        Uploading {uploadQueue.filter(f => f.status === 'done').length}/{uploadQueue.length}
      </span>
      {uploadQueue.every(f => f.status === 'done' || f.status === 'error') && (
        <button onClick={() => setUploadQueue([])} style={{ color: 'var(--text-secondary)' }}>
          <X size={12} />
        </button>
      )}
    </div>
    <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
      {uploadQueue.map((item, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          {item.status === 'uploading' && <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />}
          {item.status === 'done' && <CheckCircle2 size={12} className="flex-shrink-0" style={{ color: '#34d399' }} />}
          {item.status === 'error' && <X size={12} className="flex-shrink-0" style={{ color: '#f87171' }} />}
          {item.status === 'pending' && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--border)' }} />}
          <span className="text-xs truncate flex-1" style={{ color: item.status === 'error' ? '#f87171' : 'var(--text-secondary)' }}>
            {item.name}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 5: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: bulk upload with per-file progress panel"
```

---

## Task 7: AI Citations

Ask the AI to cite the source document and page number for each factual claim. Render citation markers as styled chips in the chat UI.

**Files:**
- Modify: `ai_assistant.py` — modify `ask_question()` prompt to request citations
- Modify: `frontend/src/app/dashboard/page.tsx` — render citation markers in messages

**Step 1: Add citation instructions to ask_question prompt**

In `ai_assistant.py`, in `ask_question()`, find the `prompt` variable that gets built (it starts with `cv_note + question + focus + entity_note`). Append citation instructions to the prompt:

```python
prompt = f"""{cv_note}{question}
{focus}{entity_note}

Project documents:
{context}

Use the documents if the question relates to them. If it doesn't, answer from your knowledge and ignore the document context. For drawings/images: look for callouts, dimensions, annotations, symbols. If a COMPUTER VISION RESULT is above, it is authoritative — cite it.

CITATION RULE: Whenever you state a fact from a document, append a citation in this exact format: [src:FILENAME] — e.g. [src:contract.pdf]. Include the citation inline right after the statement. If a fact comes from multiple docs, cite each one."""
```

**Step 2: Render citation chips in frontend**

In `frontend/src/app/dashboard/page.tsx`, find the `ReactMarkdown` component used to render assistant messages. Add a custom text renderer or post-process the content to transform `[src:filename]` patterns into styled chips.

The simplest approach is to preprocess the message content before passing to ReactMarkdown:

Create a helper function:
```tsx
function renderWithCitations(content: string): React.ReactNode {
  const parts = content.split(/(\[src:[^\]]+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[src:([^\]]+)\]$/)
    if (match) {
      return (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          padding: '0 5px', margin: '0 2px',
          backgroundColor: 'rgba(var(--accent-rgb, 74, 222, 128), 0.12)',
          border: '1px solid rgba(var(--accent-rgb, 74, 222, 128), 0.3)',
          fontSize: '0.65rem', fontFamily: 'var(--font-mono)',
          color: 'var(--accent)', verticalAlign: 'middle', borderRadius: '2px',
        }}>
          <FileText size={9} />
          {match[1]}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}
```

Then in the assistant message rendering, instead of passing raw `content` to `ReactMarkdown`, first extract and replace citations:

```tsx
// When rendering assistant message content, preprocess:
const contentWithCitations = msg.content
// Use ReactMarkdown for the text parts, render citations inline
// Simplest: replace [src:X] with a custom HTML span before passing to ReactMarkdown
const processed = msg.content.replace(/\[src:([^\]]+)\]/g,
  (_, fname) => `<span class="citation-chip">📄 ${fname}</span>`)
```

And add CSS (in a `<style>` tag or global CSS):
```css
.citation-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 5px;
  margin: 0 2px;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  font-size: 0.65rem;
  font-family: var(--font-mono);
  color: var(--accent);
  vertical-align: middle;
}
```

For ReactMarkdown, use the `rehype-raw` plugin to allow HTML in markdown, or use the custom component approach. The simplest reliable approach: preprocess the string with `.replace()` and pass `components={{ p: ({ children }) => <p>{children}</p> }}` with `rehypePlugins={[rehypeRaw]}`. But if rehype-raw isn't installed, just apply a simpler post-processing.

If rehype-raw isn't installed, use this approach instead — render each message through a custom function that splits on `[src:...]` and interleaves ReactMarkdown spans with citation chips:

```tsx
function MessageContent({ content }: { content: string }) {
  const segments = content.split(/(\[src:[^\]]+\])/g)
  return (
    <div>
      {segments.map((seg, i) => {
        const m = seg.match(/^\[src:([^\]]+)\]$/)
        if (m) {
          return (
            <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'2px', padding:'1px 5px', backgroundColor:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.3)', fontSize:'0.65rem', fontFamily:'var(--font-mono)', color:'var(--accent)', verticalAlign:'middle' }}>
              <FileText size={9}/> {m[1]}
            </span>
          )
        }
        return <ReactMarkdown key={i}>{seg}</ReactMarkdown>
      })}
    </div>
  )
}
```

Use `<MessageContent content={msg.content} />` in assistant message rendering instead of plain `<ReactMarkdown>{msg.content}</ReactMarkdown>`.

**Step 3: Commit**

```bash
git add ai_assistant.py frontend/src/app/dashboard/page.tsx
git commit -m "feat: AI citations — inline source chips in chat responses"
```

---

## Task 8: Conflict Workflow (Resolve/Dismiss)

Let users mark conflicts as resolved or dismissed so they can track which ones have been addressed.

**Files:**
- Modify: `backend/database.py` — add `ConflictStatus` model
- Modify: `backend/api.py` — add endpoints + startup migration
- Modify: `frontend/src/lib/api.ts` — add conflict status methods
- Modify: `frontend/src/app/dashboard/page.tsx` — add resolve/dismiss buttons

**Step 1: Add ConflictStatus model**

In `backend/database.py`, add after `ProjectMemory`:

```python
class ConflictStatus(Base):
    __tablename__ = "conflict_statuses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    conflict_hash = Column(String(64), nullable=False)  # hash of title
    status = Column(String(20), default="open")  # 'open', 'resolved', 'dismissed'
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('ix_conflictstatus_project_id', 'project_id'),
        UniqueConstraint('project_id', 'conflict_hash', name='uq_conflictstatus_project_conflict'),
    )
```

Also add `from backend.database import ... ConflictStatus` to the import in `backend/api.py`.

**Step 2: Add API endpoints**

In `backend/api.py`, add after the `analyze_conflicts` endpoint:

```python
@app.get("/projects/{project_id}/conflict-statuses")
async def get_conflict_statuses(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all conflict status overrides for a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    statuses = db.query(ConflictStatus).filter(
        ConflictStatus.project_id == project_id
    ).all()
    return {s.conflict_hash: s.status for s in statuses}


@app.post("/projects/{project_id}/conflict-statuses/{conflict_hash}")
async def set_conflict_status(
    project_id: int,
    conflict_hash: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set open/resolved/dismissed status for a conflict."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_status = body.get("status", "open")
    if new_status not in ("open", "resolved", "dismissed"):
        raise HTTPException(status_code=400, detail="status must be open, resolved, or dismissed")

    existing = db.query(ConflictStatus).filter(
        ConflictStatus.project_id == project_id,
        ConflictStatus.conflict_hash == conflict_hash
    ).first()

    if existing:
        existing.status = new_status
    else:
        db.add(ConflictStatus(
            project_id=project_id,
            conflict_hash=conflict_hash,
            status=new_status
        ))
    db.commit()
    return {"conflict_hash": conflict_hash, "status": new_status}
```

Add a startup migration in the `startup()` function:
```python
# ConflictStatus table is created by init_db() via Base.metadata.create_all
# No ALTER needed since it's a new table
```

Actually `init_db()` already calls `Base.metadata.create_all(bind=engine)` which creates new tables automatically. No migration needed.

**Step 3: Add to api.ts**

In `frontend/src/lib/api.ts`, add to the `chat` export (or as a new `conflicts` export):

```typescript
export const conflictStatuses = {
  getAll: (projectId: number) =>
    request<Record<string, string>>(`/projects/${projectId}/conflict-statuses`),
  set: (projectId: number, conflictHash: string, status: 'open' | 'resolved' | 'dismissed') =>
    request<{ conflict_hash: string; status: string }>(
      `/projects/${projectId}/conflict-statuses/${conflictHash}`,
      { method: 'POST', body: JSON.stringify({ status }) }
    ),
}
```

**Step 4: Add resolve/dismiss buttons in ConflictsTab**

In `frontend/src/app/dashboard/page.tsx`:

Add state: `const [conflictStatusMap, setConflictStatusMap] = useState<Record<string, string>>({})`

Load statuses when conflicts are fetched:
```tsx
// After fetching conflicts, also fetch statuses:
const statuses = await api.conflictStatuses.getAll(parseInt(current.id))
setConflictStatusMap(statuses)
```

Create a hash helper (simple: use the conflict title since IDs are sequential and could change):
```tsx
const conflictHash = (title: string) => {
  // Simple hash: encode title to base64 and take first 16 chars
  return btoa(unescape(encodeURIComponent(title))).slice(0, 16).replace(/[+/=]/g, '_')
}
```

On each conflict card, add status buttons:
```tsx
{/* In the conflict card footer */}
{(() => {
  const hash = conflictHash(conflict.title)
  const status = conflictStatusMap[hash] || 'open'
  return (
    <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <span className="text-xs flex-1" style={{
        fontFamily: 'var(--font-mono)',
        color: status === 'resolved' ? '#34d399' : status === 'dismissed' ? 'var(--text-secondary)' : '#f87171'
      }}>
        {status.toUpperCase()}
      </span>
      {status !== 'resolved' && (
        <button onClick={async () => {
          await api.conflictStatuses.set(parseInt(current!.id), hash, 'resolved')
          setConflictStatusMap(prev => ({ ...prev, [hash]: 'resolved' }))
        }} className="text-xs px-2 py-1 transition-colors"
          style={{ border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontFamily: 'var(--font-mono)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(52,211,153,0.1)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}>
          RESOLVE
        </button>
      )}
      {status !== 'dismissed' && (
        <button onClick={async () => {
          await api.conflictStatuses.set(parseInt(current!.id), hash, 'dismissed')
          setConflictStatusMap(prev => ({ ...prev, [hash]: 'dismissed' }))
        }} className="text-xs px-2 py-1 transition-colors"
          style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--card)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}>
          DISMISS
        </button>
      )}
      {(status === 'resolved' || status === 'dismissed') && (
        <button onClick={async () => {
          await api.conflictStatuses.set(parseInt(current!.id), hash, 'open')
          setConflictStatusMap(prev => ({ ...prev, [hash]: 'open' }))
        }} className="text-xs px-2 py-1 transition-colors"
          style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          REOPEN
        </button>
      )}
    </div>
  )
})()}
```

Also add a filter dropdown above the conflicts list to filter by `status` (all / open / resolved / dismissed).

**Step 5: Commit**

```bash
git add backend/database.py backend/api.py frontend/src/lib/api.ts frontend/src/app/dashboard/page.tsx
git commit -m "feat: conflict workflow — resolve, dismiss, reopen status tracking"
```

---

## Task 9: Export to PDF

Allow users to print/export conflict reports and compare results using browser print functionality with a clean print stylesheet.

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx` — add print button + print CSS

**Step 1: Add print stylesheet**

In `frontend/src/app/globals.css` (or wherever global CSS lives), add:

```css
@media print {
  /* Hide everything except the main content area */
  aside,
  header,
  .no-print,
  button,
  input,
  select {
    display: none !important;
  }

  body {
    background: white !important;
    color: black !important;
  }

  .print-content {
    display: block !important;
  }

  /* Conflict cards */
  .conflict-card {
    break-inside: avoid;
    border: 1px solid #ccc !important;
    margin-bottom: 1rem;
    padding: 1rem;
    background: white !important;
    color: black !important;
  }
}
```

**Step 2: Add print-target wrapper and export button in ConflictsTab**

In the ConflictsTab section, wrap the conflicts list in a `<div className="print-content" id="print-target">`.

Add an export button next to the Analyze button:

```tsx
<button
  onClick={() => {
    // Add print class to body temporarily
    document.body.classList.add('printing-conflicts')
    window.print()
    document.body.classList.remove('printing-conflicts')
  }}
  className="btn-ghost flex items-center gap-2 text-xs"
  title="Export as PDF"
  style={{ fontFamily: 'var(--font-mono)' }}
>
  <ArrowRight size={12} />
  EXPORT PDF
</button>
```

**Step 3: Add print title and metadata**

Before the conflicts list (inside the print wrapper), add a header that's visible in print:

```tsx
<div className="hidden print:block mb-4" style={{ display: 'none' }} id="print-header">
  <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
    Conflict Analysis Report
  </h1>
  <p style={{ color: '#666', fontSize: '0.85rem' }}>
    Project: {current?.name} — {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  </p>
  <p style={{ color: '#666', fontSize: '0.85rem' }}>
    {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found
  </p>
  <hr style={{ margin: '1rem 0', borderColor: '#ccc' }} />
</div>
```

Make the header visible during print by adding to the print CSS:
```css
@media print {
  #print-header { display: block !important; }
}
```

**Step 4: Add export button to CompareTab too**

Same pattern: wrap compare results in a printable div, add an Export PDF button.

**Step 5: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx frontend/src/app/globals.css
git commit -m "feat: export conflicts and compare results to PDF via browser print"
```

---

## Deploy

After all tasks are complete:

```bash
cd /Users/raunakbalchandani/Downloads/foreperson-local
git push origin claude-code
```

Then SSH to EC2 and run deploy:
```bash
ssh -i ~/Downloads/foreperson+clawdbot.pem ec2-user@3.235.101.55 "cd /opt/foreperson && bash deploy.sh"
```

Monitor services:
```bash
ssh -i ~/Downloads/foreperson+clawdbot.pem ec2-user@3.235.101.55 "sudo systemctl status foreperson-backend foreperson-frontend"
```
