'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { useTheme } from 'next-themes'
import * as api from '@/lib/api'
import {
  FileText, MessageSquare, AlertTriangle, GitCompare,
  Upload, Search, Settings, LogOut, Plus, Send,
  FileSearch, Trash2, Filter, Loader2, X, Menu,
  Sun, Moon, Layers, Clock, DollarSign, ClipboardList,
  ChevronRight, HardHat, FileSignature, LayoutGrid,
  List, FolderOpen, Home
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────
interface UploadedFile {
  id: string
  name: string
  type: string
  size: string
  uploadedAt: string
}
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}
interface Project {
  id: string
  name: string
  fileCount: number
}

// ─── File category registry ─────────────────────────────────
const CATS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  drawing:       { label: 'Drawing',         color: '#818CF8', icon: Layers },
  floor_plan:    { label: 'Floor Plan',      color: '#A78BFA', icon: Layers },
  site_plan:     { label: 'Site Plan',       color: '#C084FC', icon: Layers },
  specification: { label: 'Specification',   color: '#F59E0B', icon: FileText },
  contract:      { label: 'Contract',        color: '#34D399', icon: FileSignature },
  rfi:           { label: 'RFI',             color: '#F87171', icon: ClipboardList },
  submittal:     { label: 'Submittal',       color: '#60A5FA', icon: FileSearch },
  change_order:  { label: 'Change Order',    color: '#FB923C', icon: DollarSign },
  schedule:      { label: 'Schedule',        color: '#A3E635', icon: Clock },
  budget:        { label: 'Budget',          color: '#4ADE80', icon: DollarSign },
  report:        { label: 'Report',          color: '#94A3B8', icon: HardHat },
  minutes:       { label: 'Meeting Minutes', color: '#22D3EE', icon: MessageSquare },
  punch_list:    { label: 'Punch List',      color: '#FB7185', icon: ClipboardList },
  unknown:       { label: 'Other',           color: '#6B7280', icon: FileText },
}
const cat = (type: string) => CATS[type] ?? CATS.unknown

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

// ─── Theme Toggle ───────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  const isDark = theme === 'dark'
  return (
    <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to Light' : 'Switch to Dark'}
      className="p-2 transition-colors"
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}

// ─── New Project Modal ──────────────────────────────────────
function NewProjectModal({ isOpen, onClose, onAdd }: {
  isOpen: boolean; onClose: () => void
  onAdd: (name: string, desc?: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setName(''); setDesc(''); setError('') }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true); setError('')
    try {
      await onAdd(name.trim(), desc.trim() || undefined)
      reset(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.')
    } finally { setLoading(false) }
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="label-mono mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>// NEW PROJECT</p>
            <h2 className="text-lg font-black uppercase" style={{ fontFamily: 'var(--font-display)' }}>Create Project</h2>
          </div>
          <button onClick={() => { reset(); onClose() }} style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block label-mono mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>PROJECT NAME *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="input" placeholder="North Tower — Phase 2" required autoFocus />
          </div>
          <div>
            <label className="block label-mono mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>DESCRIPTION</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
              className="input resize-none" style={{ minHeight: 72 }} placeholder="Optional" />
          </div>
          {error && (
            <div className="text-xs px-3 py-2" style={{
              color: '#f87171', backgroundColor: 'rgba(248,113,113,0.07)',
              border: '1px solid rgba(248,113,113,0.2)', fontFamily: 'var(--font-mono)'
            }}>{error}</div>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => { reset(); onClose() }} className="btn-ghost" disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Creating…' : 'Create →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Project Modal ───────────────────────────────────
function DeleteProjectModal({ isOpen, onClose, onConfirm, name }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => Promise<void>; name: string
}) {
  const [loading, setLoading] = useState(false)
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid rgba(248,113,113,0.3)' }}
        onClick={(e) => e.stopPropagation()}>
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)', color: '#f87171' }}>// DESTRUCTIVE</p>
        <h2 className="text-lg font-black uppercase mb-3" style={{ fontFamily: 'var(--font-display)', color: '#f87171' }}>Delete Project</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Delete <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>"{name}"</span> and all its files? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost" disabled={loading}>Cancel</button>
          <button disabled={loading} onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }}
            className="px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: '#f87171', color: '#fff' }}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ───────────────────────────────────────────────
const NAV = [
  { id: 'overview', icon: Home,         label: 'Overview' },
  { id: 'files',    icon: Layers,        label: 'Files' },
  { id: 'chat',     icon: MessageSquare, label: 'AI Chat' },
  { id: 'conflicts',icon: AlertTriangle, label: 'Conflicts' },
  { id: 'compare',  icon: GitCompare,    label: 'Compare' },
]

function Sidebar({ open, onClose, onToggle, tab, setTab, projects, current, setCurrent, onNew, onDelete }: {
  open: boolean; onClose: () => void; onToggle: () => void
  tab: string; setTab: (t: string) => void
  projects: Project[]; current: Project | null; setCurrent: (p: Project) => void
  onNew: () => void; onDelete: (id: string) => void
}) {
  const navBtn = (id: string, Icon: React.ElementType, label: string) => {
    const active = tab === id
    return (
      <button key={id} onClick={() => { setTab(id); onClose() }}
        className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
        style={{
          borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
          backgroundColor: active ? 'var(--card)' : 'transparent',
          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--card)' } }}
        onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' } }}>
        <Icon size={14} style={{ flexShrink: 0 }} />
        <span className="text-xs uppercase font-medium" style={{ letterSpacing: '0.07em' }}>{label}</span>
      </button>
    )
  }

  return (
    <>
      {open && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col ${open ? 'w-60' : 'w-0 lg:w-14'} transition-all duration-200 overflow-hidden`}
        style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

        {/* Logo row */}
        <div className="flex items-center justify-between px-3 h-14 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', minWidth: open ? 240 : undefined }}>
          {open ? (
            <>
              <Link href="/" className="flex items-center gap-2 hover:opacity-80">
                <div className="w-6 h-6 flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                  <span style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-mono)', fontSize: '0.5rem', fontWeight: 700 }}>FP</span>
                </div>
                <span className="text-xs font-black uppercase" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>Foreperson</span>
              </Link>
              <button onClick={onToggle} className="p-1.5 transition-colors" style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
                <Menu size={15} />
              </button>
            </>
          ) : (
            <div className="w-full flex justify-center">
              <button onClick={onToggle} className="p-1.5 transition-colors" style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
                <Menu size={15} />
              </button>
            </div>
          )}
        </div>

        {open && (
          <>
            {/* Projects section */}
            <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>PROJECTS</span>
                <button onClick={onNew} className="transition-colors" style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
                  <Plus size={13} />
                </button>
              </div>
              <div className="space-y-px">
                {projects.length === 0
                  ? <p className="text-xs py-1 px-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>No projects</p>
                  : projects.map((p) => {
                    const isActive = current?.id === p.id
                    return (
                      <div key={p.id}
                        className="group flex items-center gap-1.5 px-2 py-2 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isActive ? 'var(--card)' : 'transparent',
                          borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                        }}
                        onClick={() => setCurrent(p)}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--card)' }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}>
                        <ChevronRight size={9} style={{ color: isActive ? 'var(--accent)' : 'transparent', flexShrink: 0 }} />
                        <span className="flex-1 text-xs truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.name}</span>
                        <div className="flex items-center gap-1">
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.55rem' }}>{p.fileCount}</span>
                          {projects.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); onDelete(p.id) }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: 'var(--text-secondary)' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-3 space-y-px overflow-y-auto">
              <span className="label-mono block mb-2 px-1" style={{ fontFamily: 'var(--font-mono)' }}>WORKSPACE</span>
              {NAV.map(({ id, icon, label }) => navBtn(id, icon, label))}
            </nav>

            {/* Footer */}
            <div className="px-3 py-3 space-y-px flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              {navBtn('settings', Settings, 'Settings')}
              <div className="flex items-center justify-between px-2 pt-1">
                <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/login' }}
                  className="flex items-center gap-2 text-xs transition-colors py-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
                  <LogOut size={13} />
                  <span className="uppercase" style={{ letterSpacing: '0.06em' }}>Sign out</span>
                </button>
                <ThemeToggle />
              </div>
            </div>
          </>
        )}

        {/* Collapsed icon strip */}
        {!open && (
          <div className="hidden lg:flex flex-col items-center gap-1 py-3">
            {NAV.map(({ id, icon: Icon, label }) => (
              <button key={id} title={label} onClick={() => setTab(id)}
                className="p-2.5 transition-colors w-full flex justify-center"
                style={{ color: tab === id ? 'var(--accent)' : 'var(--text-secondary)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = tab === id ? 'var(--accent)' : 'var(--text-secondary)' }}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}

// ─── Overview Tab ───────────────────────────────────────────
function OverviewTab({ project, files, setTab }: {
  project: Project | null; files: UploadedFile[]; setTab: (t: string) => void
}) {
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <FolderOpen size={40} className="mb-4" style={{ color: 'var(--text-secondary)' }} />
        <p className="label-mono mb-2" style={{ fontFamily: 'var(--font-mono)' }}>// NO PROJECT SELECTED</p>
        <h2 className="text-2xl font-black uppercase mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Create a project to start
        </h2>
        <p className="text-sm max-w-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
          Projects are your workspace. Add drawings, specs, contracts — everything for a single project lives here.
        </p>
      </div>
    )
  }

  // File type breakdown
  const typeCounts: Record<string, number> = {}
  files.forEach((f) => { typeCounts[f.type] = (typeCounts[f.type] ?? 0) + 1 })

  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return (
    <div className="space-y-8">
      {/* Project name header */}
      <div>
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// PROJECT OVERVIEW</p>
        <h1 className="text-4xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>
          {project.name}
        </h1>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
        {[
          { label: 'Total Files', value: files.length.toString(), action: () => setTab('files') },
          { label: 'File Types', value: Object.keys(typeCounts).length.toString(), action: () => setTab('files') },
          { label: 'AI Ready', value: project ? 'Yes' : '—', action: () => setTab('chat') },
          { label: 'Conflicts', value: '—', action: () => setTab('conflicts') },
        ].map(({ label, value, action }) => (
          <button key={label} onClick={action}
            className="p-6 text-left transition-colors group"
            style={{ backgroundColor: 'var(--card)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--card)' }}>
            <p className="label-mono mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{label}</p>
            <p className="text-3xl font-black uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>{value}</p>
          </button>
        ))}
      </div>

      {/* File breakdown */}
      {topTypes.length > 0 && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <span className="label-mono-accent" style={{ fontFamily: 'var(--font-mono)' }}>// FILE BREAKDOWN</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          </div>
          <div className="grid md:grid-cols-3 gap-px" style={{ backgroundColor: 'var(--border)' }}>
            {topTypes.map(([type, count]) => {
              const c = cat(type)
              const CatIcon = c.icon
              return (
                <div key={type} className="flex items-center gap-4 p-5 transition-colors"
                  style={{ backgroundColor: 'var(--card)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--card)' }}>
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: c.color + '15', border: `1px solid ${c.color}30` }}>
                    <CatIcon size={16} style={{ color: c.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide truncate" style={{ letterSpacing: '0.06em' }}>{c.label}</p>
                    <p className="text-xl font-black" style={{ fontFamily: 'var(--font-display)', color: c.color }}>{count}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <div className="flex items-center gap-4 mb-4">
          <span className="label-mono-accent" style={{ fontFamily: 'var(--font-mono)' }}>// QUICK ACTIONS</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="grid md:grid-cols-3 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          {[
            { label: 'Upload Files', desc: 'Add drawings, specs, contracts, RFIs, schedules', action: () => setTab('files'), icon: Upload },
            { label: 'Ask the AI', desc: 'Chat about your project, ask construction questions', action: () => setTab('chat'), icon: MessageSquare },
            { label: 'Detect Conflicts', desc: 'Find contradictions between drawings and specs', action: () => setTab('conflicts'), icon: AlertTriangle },
          ].map(({ label, desc, action, icon: Icon }) => (
            <button key={label} onClick={action}
              className="p-6 text-left transition-colors group"
              style={{ backgroundColor: 'var(--card)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--card)' }}>
              <Icon size={18} className="mb-4" style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ letterSpacing: '0.06em' }}>{label}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Getting started if no files */}
      {files.length === 0 && (
        <div className="p-8 text-center" style={{ border: '2px dashed var(--border)' }}>
          <Upload size={28} className="mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <p className="label-mono-accent mb-2" style={{ fontFamily: 'var(--font-mono)' }}>// GET STARTED</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Upload your project files — drawings, specs, contracts, RFIs, anything — to get started.
          </p>
          <button onClick={() => setTab('files')} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">
            <Upload size={14} /> Upload Files
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Files Tab ─────────────────────────────────────────────
const FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'drawing', label: 'Drawings' },
  { value: 'floor_plan', label: 'Floor Plans' },
  { value: 'site_plan', label: 'Site Plans' },
  { value: 'specification', label: 'Specs' },
  { value: 'contract', label: 'Contracts' },
  { value: 'rfi', label: 'RFIs' },
  { value: 'submittal', label: 'Submittals' },
  { value: 'change_order', label: 'Change Orders' },
  { value: 'schedule', label: 'Schedules' },
  { value: 'budget', label: 'Budgets' },
  { value: 'report', label: 'Reports' },
  { value: 'minutes', label: 'Meeting Minutes' },
  { value: 'punch_list', label: 'Punch Lists' },
]

function FilesTab({ files, onUpload, onDelete, isUploading }: {
  files: UploadedFile[]; onUpload: (f: FileList) => void
  onDelete: (id: string) => void; isUploading: boolean
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const shown = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) &&
    (filter === 'all' || f.type === filter)
  )

  // Type counts for filter pills
  const counts: Record<string, number> = {}
  files.forEach((f) => { counts[f.type] = (counts[f.type] ?? 0) + 1 })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// PROJECT FILES</p>
          <h1 className="text-3xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>
            {files.length === 0 ? 'No Files Yet' : `${files.length} Files`}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setView('grid')} className="p-2 transition-colors"
            style={{ color: view === 'grid' ? 'var(--accent)' : 'var(--text-secondary)', backgroundColor: view === 'grid' ? 'var(--card)' : 'transparent', border: '1px solid var(--border)' }}>
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setView('list')} className="p-2 transition-colors"
            style={{ color: view === 'list' ? 'var(--accent)' : 'var(--text-secondary)', backgroundColor: view === 'list' ? 'var(--card)' : 'transparent', border: '1px solid var(--border)' }}>
            <List size={14} />
          </button>
          <button onClick={() => inputRef.current?.click()} disabled={isUploading}
            className="btn-primary flex items-center gap-2">
            {isUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {isUploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        <input ref={inputRef} type="file" multiple
          accept=".pdf,.docx,.xlsx,.doc,.xls,.png,.jpg,.jpeg,.dwg,.dxf,.csv"
          className="hidden"
          onChange={(e) => e.target.files && onUpload(e.target.files)} />
      </div>

      {/* Stats strip */}
      {files.length > 0 && (
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide" style={{ borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setFilter('all')}
            className="flex items-center gap-2 px-4 py-2.5 transition-colors flex-shrink-0 text-xs font-medium"
            style={{
              borderBottom: filter === 'all' ? '2px solid var(--accent)' : '2px solid transparent',
              color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
            ALL <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>({files.length})</span>
          </button>
          {Object.entries(counts).map(([type, count]) => {
            const c = cat(type)
            const isActive = filter === type
            return (
              <button key={type} onClick={() => setFilter(type)}
                className="flex items-center gap-1.5 px-4 py-2.5 transition-colors flex-shrink-0 text-xs font-medium whitespace-nowrap"
                style={{
                  borderBottom: isActive ? `2px solid ${c.color}` : '2px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.color, display: 'inline-block', flexShrink: 0 }} />
                {c.label.toUpperCase()} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files…" className="input pl-9" />
      </div>

      {/* Drop zone */}
      <div onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); e.dataTransfer.files.length && onUpload(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed py-6 text-center cursor-pointer transition-all"
        style={{
          borderColor: dragging ? 'var(--accent)' : 'var(--border)',
          backgroundColor: dragging ? 'var(--glow)' : 'transparent',
        }}>
        <Upload size={20} className="mx-auto mb-2" style={{ color: dragging ? 'var(--accent)' : 'var(--text-secondary)' }} />
        <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>
          Drop files or <span style={{ color: 'var(--accent)' }}>browse</span>
        </p>
        <p className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>
          PDF · DOCX · XLSX · PNG · JPG · DWG · DXF · CSV
        </p>
      </div>

      {/* File grid / list */}
      {shown.length === 0 ? (
        <div className="text-center py-14" style={{ border: '1px solid var(--border)' }}>
          <FileSearch size={28} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {files.length === 0 ? 'Upload your first file to get started' : 'No files match your search'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          {shown.map((f) => {
            const c = cat(f.type)
            const CatIcon = c.icon
            return (
              <div key={f.id} className="group relative p-5 transition-colors"
                style={{ backgroundColor: 'var(--card)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--card)' }}>
                {/* Delete on hover */}
                <button onClick={() => onDelete(f.id)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
                  <Trash2 size={12} />
                </button>

                {/* Icon */}
                <div className="w-10 h-10 flex items-center justify-center mb-4"
                  style={{ backgroundColor: c.color + '18', border: `1px solid ${c.color}25` }}>
                  <CatIcon size={16} style={{ color: c.color }} />
                </div>

                {/* Name */}
                <p className="text-xs font-medium leading-snug mb-2 pr-6"
                  style={{ color: 'var(--text-primary)', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {f.name}
                </p>

                {/* Meta */}
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <span className="text-xs px-1.5 py-0.5 flex-shrink-0"
                    style={{ backgroundColor: c.color + '18', color: c.color, fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
                    {c.label.toUpperCase()}
                  </span>
                  <span className="label-mono flex-shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>{f.size}</span>
                </div>
                <p className="label-mono mt-1" style={{ fontFamily: 'var(--font-mono)' }}>{f.uploadedAt}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-[1fr_140px_80px_70px_32px] gap-4 px-4 py-2"
            style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
            <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>NAME</span>
            <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>TYPE</span>
            <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>SIZE</span>
            <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>DATE</span>
            <span />
          </div>
          {shown.map((f) => {
            const c = cat(f.type)
            const CatIcon = c.icon
            return (
              <div key={f.id} className="group grid grid-cols-[1fr_140px_80px_70px_32px] gap-4 items-center px-4 py-3 transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <CatIcon size={13} style={{ color: c.color, flexShrink: 0 }} />
                  <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                </div>
                <span className="text-xs px-1.5 py-0.5 inline-block"
                  style={{ backgroundColor: c.color + '18', color: c.color, fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
                  {c.label.toUpperCase()}
                </span>
                <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>{f.size}</span>
                <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>{f.uploadedAt}</span>
                <button onClick={() => onDelete(f.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Chat Tab ─────────────────────────────────────────────
const PROMPTS_BY_CATEGORY = [
  { cat: 'CONTRACTS', items: ["What are the liquidated damages provisions?", "Summarize the payment schedule", "What are the owner's termination rights?"] },
  { cat: 'DRAWINGS', items: ["Describe the structural system shown in the drawings", "What does the ground floor plan show?", "List all drawing revisions"] },
  { cat: 'SPECIFICATIONS', items: ["What's the concrete compressive strength spec?", "List submittals required in Division 22", "What are the quality control requirements?"] },
  { cat: 'PROJECT STATUS', items: ["Summarize all open RFIs by trade", "What submittals are still outstanding?", "List all schedule milestones and deadlines"] },
]

function ChatTab({ files, currentProject, messages, isLoading, onSendMessage }: {
  files: UploadedFile[]; currentProject: Project | null
  messages: Message[]; isLoading: boolean
  onSendMessage: (msg: string) => Promise<void>
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || isLoading || !currentProject) return
    const msg = input; setInput('')
    await onSendMessage(msg)
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// AI ASSISTANT</p>
          <h1 className="text-3xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>Ask Foreperson</h1>
        </div>
        {files.length > 0 && (
          <div className="text-right">
            <p className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>CONTEXT</p>
            <p className="text-xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
              {files.length} FILES
            </p>
          </div>
        )}
      </div>

      {/* Prompt suggestions — show when chat is fresh */}
      {messages.length <= 1 && (
        <div className="flex-shrink-0 mb-4 space-y-3 overflow-y-auto" style={{ maxHeight: '35vh' }}>
          {PROMPTS_BY_CATEGORY.map(({ cat: catLabel, items }) => (
            <div key={catLabel}>
              <p className="label-mono mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>{catLabel}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((p) => (
                  <button key={p} onClick={() => setInput(p)}
                    className="text-xs px-3 py-1.5 transition-colors"
                    style={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'assistant' ? (
              <div className="flex gap-3 max-w-4xl">
                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: 'var(--accent)' }}>
                  <span style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-mono)', fontSize: '0.5rem', fontWeight: 700 }}>FP</span>
                </div>
                <div className="flex-1 text-sm leading-relaxed"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                  <ReactMarkdown components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    code: ({ children }) => <code className="px-1.5 py-0.5 text-xs" style={{ backgroundColor: 'var(--surface)', fontFamily: 'var(--font-mono)' }}>{children}</code>,
                    h2: ({ children }) => <h2 className="font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 pl-3 my-2 italic" style={{ borderColor: 'var(--accent)' }}>{children}</blockquote>,
                  }}>
                    {msg.content}
                  </ReactMarkdown>
                  <p className="text-xs mt-2 opacity-40">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-end max-w-4xl ml-auto">
                <div className="text-sm max-w-lg"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-dark)', padding: '0.75rem 1rem' }}>
                  <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                  <p className="text-xs mt-1.5 opacity-50">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
              <span style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-mono)', fontSize: '0.5rem', fontWeight: 700 }}>FP</span>
            </div>
            <div className="flex items-center px-4 py-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
              <Loader2 size={15} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2 flex-shrink-0">
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={!currentProject ? 'Select a project first…' : files.length === 0 ? 'Ask a general construction question or upload files for project context…' : 'Ask anything about your project…'}
          disabled={!currentProject || isLoading}
          className="input flex-1" />
        <button onClick={send}
          disabled={!input.trim() || isLoading || !currentProject}
          className="btn-primary p-3">
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Conflicts Tab ──────────────────────────────────────────
function ConflictsTab({ files, currentProject }: { files: UploadedFile[]; currentProject: Project | null }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [error, setError] = useState('')

  const analyze = async () => {
    if (!currentProject || files.length < 2) { setError('Need at least 2 files for conflict analysis'); return }
    setAnalyzing(true); setError('')
    try {
      const data = await api.chat.conflicts(parseInt(currentProject.id))
      setConflicts(data.conflicts ?? [])
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed.')
    } finally { setAnalyzing(false) }
  }

  const bySeverity = (s: string) => conflicts.filter((c) => c.severity === s)
  const highCount = bySeverity('high').length
  const medCount = bySeverity('medium').length
  const lowCount = bySeverity('low').length

  const sevStyle: Record<string, { bg: string; text: string; border: string }> = {
    high:   { bg: 'rgba(248,113,113,0.06)', text: '#f87171', border: 'rgba(248,113,113,0.2)' },
    medium: { bg: 'rgba(245,200,0,0.06)',   text: 'var(--accent)', border: 'rgba(245,200,0,0.2)' },
    low:    { bg: 'rgba(96,165,250,0.06)',   text: '#60a5fa', border: 'rgba(96,165,250,0.2)' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// CONFLICT DETECTION</p>
          <h1 className="text-3xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>Conflicts</h1>
        </div>
        <button onClick={analyze} disabled={analyzing || files.length < 2}
          className="btn-primary flex items-center gap-2 flex-shrink-0">
          {analyzing ? <><Loader2 size={13} className="animate-spin" /> Analyzing…</> : <><AlertTriangle size={13} /> Run Analysis</>}
        </button>
      </div>

      {/* Summary stats — only show after analysis */}
      {conflicts.length > 0 && (
        <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          {[
            { label: 'High Severity', count: highCount, color: '#f87171' },
            { label: 'Medium', count: medCount, color: 'var(--accent)' },
            { label: 'Low', count: lowCount, color: '#60a5fa' },
          ].map(({ label, count, color }) => (
            <div key={label} className="p-5" style={{ backgroundColor: 'var(--card)' }}>
              <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{label}</p>
              <p className="text-3xl font-black" style={{ fontFamily: 'var(--font-display)', color }}>{count}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-xs px-3 py-2" style={{
          color: '#f87171', backgroundColor: 'rgba(248,113,113,0.07)',
          border: '1px solid rgba(248,113,113,0.2)', fontFamily: 'var(--font-mono)'
        }}>{error}</div>
      )}

      {files.length < 2 ? (
        <div className="text-center py-16" style={{ border: '1px solid var(--border)' }}>
          <FileSearch size={28} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Upload at least 2 files to detect conflicts</p>
        </div>
      ) : conflicts.length === 0 && !analyzing ? (
        <div className="text-center py-16" style={{ border: '1px solid var(--border)' }}>
          <AlertTriangle size={28} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            {files.length} files ready — click Run Analysis to scan for conflicts between drawings, specs, and contracts
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((c) => {
            const s = sevStyle[c.severity] ?? sevStyle.medium
            return (
              <div key={c.id} className="p-5" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
                  <span className="text-xs px-2 py-0.5 flex-shrink-0"
                    style={{ color: s.text, border: `1px solid ${s.border}`, fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.08em' }}>
                    {c.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.documents.map((doc: string, i: number) => (
                    <span key={i} className="text-xs px-2 py-0.5"
                      style={{ backgroundColor: 'var(--card)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Compare Tab ────────────────────────────────────────────
function CompareTab({ files }: { files: UploadedFile[] }) {
  const [f1, setF1] = useState('')
  const [f2, setF2] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [comparing, setComparing] = useState(false)

  const compare = async () => {
    if (!f1 || !f2) return
    setComparing(true)
    await new Promise((r) => setTimeout(r, 1600))
    const n1 = files.find((f) => f.id === f1)?.name ?? 'File 1'
    const n2 = files.find((f) => f.id === f2)?.name ?? 'File 2'
    setResult(`## ${n1} vs ${n2}\n\n### Key Differences\n- Scope items differ between the two documents\n- Timeline specifications vary\n- Payment terms are defined differently\n\n### Similarities\n- Both reference the same project specifications\n- Identical insurance requirements`)
    setComparing(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// DOCUMENT COMPARE</p>
        <h1 className="text-3xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>Compare</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-px" style={{ backgroundColor: 'var(--border)' }}>
        {[{ val: f1, other: f2, set: setF1, label: 'First File' }, { val: f2, other: f1, set: setF2, label: 'Second File' }].map(
          ({ val, other, set, label }) => (
            <div key={label} className="p-5" style={{ backgroundColor: 'var(--card)' }}>
              <label className="block label-mono mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{label}</label>
              <select value={val} onChange={(e) => set(e.target.value)} className="input appearance-none">
                <option value="">Select a file…</option>
                {files.filter((f) => f.id !== other).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )
        )}
      </div>

      <button onClick={compare} disabled={!f1 || !f2 || comparing} className="btn-primary flex items-center gap-2">
        {comparing ? <><Loader2 size={13} className="animate-spin" /> Comparing…</> : <><GitCompare size={13} /> Compare Files</>}
      </button>

      {result ? (
        <div className="p-6 text-sm leading-relaxed" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      ) : files.length < 2 ? (
        <div className="text-center py-16" style={{ border: '1px solid var(--border)' }}>
          <GitCompare size={28} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Upload at least 2 files to compare them</p>
        </div>
      ) : null}
    </div>
  )
}

// ─── Settings Tab ───────────────────────────────────────────
function SettingsTab() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// ACCOUNT SETTINGS</p>
        <h1 className="text-3xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>
      </div>

      <div style={{ border: '1px solid var(--border)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>PROFILE</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block label-mono mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>NAME</label>
            <input type="text" className="input" placeholder="Your name" />
          </div>
          <div>
            <label className="block label-mono mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>EMAIL</label>
            <input type="email" className="input" placeholder="you@company.com" />
          </div>
          <button className="btn-primary text-xs px-5 py-2">Save Changes</button>
        </div>
      </div>

      <div style={{ border: '1px solid rgba(248,113,113,0.25)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(248,113,113,0.2)', backgroundColor: 'rgba(248,113,113,0.04)' }}>
          <p className="label-mono" style={{ fontFamily: 'var(--font-mono)', color: '#f87171' }}>DANGER ZONE</p>
        </div>
        <div className="p-6">
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Permanently delete your account and all project data. This cannot be undone.</p>
          <button className="text-xs px-4 py-2 transition-colors"
            style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────
export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tab, setTab] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('fp-tab') ?? 'overview') : 'overview'
  )
  const [projects, setProjects] = useState<Project[]>([])
  const [current, setCurrent] = useState<Project | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [toDelete, setToDelete] = useState<Project | null>(null)
  const [chatMsgs, setChatMsgs] = useState<Message[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatLoaded, setChatLoaded] = useState<Record<string, boolean>>({})

  useEffect(() => { loadProjects() }, [])
  useEffect(() => {
    if (current) { loadFiles(); setChatLoaded((p) => ({ ...p, [current.id]: false })) }
    else { setFiles([]); setChatMsgs([]) }
  }, [current])
  useEffect(() => {
    if (tab === 'chat' && current && !chatLoaded[current.id]) loadChatHistory()
  }, [tab, current])

  const changeTab = (t: string) => {
    setTab(t); localStorage.setItem('fp-tab', t)
  }

  const loadProjects = async () => {
    try {
      const data = await api.projects.list()
      const list = data.map((p: any) => ({ id: p.id.toString(), name: p.name, fileCount: p.document_count ?? 0 }))
      setProjects(list)
      if (list.length > 0) setCurrent(list[0])
      else { try { await addProject('My First Project') } catch { /* no-op */ } }
    } catch (e) { console.error(e) }
  }

  const loadFiles = async () => {
    if (!current) return
    try {
      const data = await api.documents.list(parseInt(current.id))
      setFiles(data.map((d: any) => ({
        id: d.id.toString(), name: d.original_filename,
        type: d.document_type ?? 'unknown',
        size: formatSize(d.file_size ?? 0),
        uploadedAt: d.created_at?.split('T')[0] ?? '—',
      })))
    } catch (e) { console.error(e) }
  }

  const loadChatHistory = async () => {
    if (!current) return
    try {
      const data = await api.chat.history(parseInt(current.id))
      const msgs = (data as any).messages
      if (msgs?.length > 0) {
        setChatMsgs(msgs.map((m: any) => ({ id: m.id.toString(), role: m.role, content: m.content, timestamp: new Date(m.created_at) })))
      } else {
        setChatMsgs([{ id: '0', role: 'assistant', content: 'Hello! I\'m Foreperson — your AI construction assistant. Upload project files for project-specific answers, or ask me anything about construction in general.', timestamp: new Date() }])
      }
      setChatLoaded((p) => ({ ...p, [current.id]: true }))
    } catch {
      setChatMsgs([{ id: '0', role: 'assistant', content: 'Hello! I\'m Foreperson — your AI construction assistant. Ask me anything about construction, or upload files for project-specific answers.', timestamp: new Date() }])
    }
  }

  // Throws on failure so modal can show error
  const addProject = async (name: string, desc?: string) => {
    const p = await api.projects.create(name, desc)
    const proj = { id: p.id.toString(), name: p.name, fileCount: 0 }
    setProjects((prev) => [...prev, proj])
    setCurrent(proj)
  }

  const requestDelete = (id: string) => {
    if (projects.length <= 1) { alert('Cannot delete the last project. Create another first.'); return }
    setToDelete(projects.find((p) => p.id === id) ?? null)
    setShowDelete(true)
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    await api.projects.delete(parseInt(toDelete.id))
    const rem = projects.filter((p) => p.id !== toDelete.id)
    setProjects(rem)
    if (current?.id === toDelete.id) setCurrent(rem[0] ?? null)
    setShowDelete(false); setToDelete(null)
  }

  const handleUpload = async (fileList: FileList) => {
    if (!current) return
    setUploading(true)
    for (const file of Array.from(fileList)) {
      try {
        const doc = await api.documents.upload(parseInt(current.id), file)
        setFiles((p) => [{ id: doc.id.toString(), name: doc.original_filename, type: doc.document_type ?? 'unknown', size: formatSize(doc.file_size ?? 0), uploadedAt: new Date().toISOString().split('T')[0] }, ...p])
        setProjects((p) => p.map((pr) => pr.id === current.id ? { ...pr, fileCount: pr.fileCount + 1 } : pr))
      } catch (e) { console.error(e) }
    }
    setUploading(false)
  }

  const handleDeleteFile = async (id: string) => {
    if (!current) return
    try {
      await api.documents.delete(parseInt(current.id), parseInt(id))
      setFiles((p) => p.filter((f) => f.id !== id))
      setProjects((p) => p.map((pr) => pr.id === current.id ? { ...pr, fileCount: Math.max(0, pr.fileCount - 1) } : pr))
    } catch (e) { console.error(e) }
  }

  const handleSendMessage = async (msg: string) => {
    if (!current) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() }
    setChatMsgs((p) => [...p, userMsg])
    setChatLoading(true)
    try {
      const data = await api.chat.send(parseInt(current.id), msg)
      setChatMsgs((p) => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response ?? 'No response.', timestamp: new Date() }])
      setChatLoaded((p) => ({ ...p, [current.id]: true }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred. Please try again.'
      setChatMsgs((p) => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', content: msg, timestamp: new Date() }])
    } finally { setChatLoading(false) }
  }

  const renderContent = () => {
    switch (tab) {
      case 'overview':  return <OverviewTab project={current} files={files} setTab={changeTab} />
      case 'files':     return <FilesTab files={files} onUpload={handleUpload} onDelete={handleDeleteFile} isUploading={uploading} />
      case 'chat':      return <ChatTab files={files} currentProject={current} messages={chatMsgs} isLoading={chatLoading} onSendMessage={handleSendMessage} />
      case 'conflicts': return <ConflictsTab files={files} currentProject={current} />
      case 'compare':   return <CompareTab files={files} />
      case 'settings':  return <SettingsTab />
      default:          return <OverviewTab project={current} files={files} setTab={changeTab} />
    }
  }

  const TAB_LABELS: Record<string, string> = { overview: 'Overview', files: 'Files', chat: 'Chat', conflicts: 'Conflicts', compare: 'Compare', settings: 'Settings' }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <NewProjectModal isOpen={showNew} onClose={() => setShowNew(false)} onAdd={addProject} />
      <DeleteProjectModal isOpen={showDelete} onClose={() => { setShowDelete(false); setToDelete(null) }} onConfirm={confirmDelete} name={toDelete?.name ?? ''} />

      <Sidebar
        open={sidebarOpen} onClose={() => setSidebarOpen(false)} onToggle={() => setSidebarOpen(!sidebarOpen)}
        tab={tab} setTab={changeTab}
        projects={projects} current={current} setCurrent={setCurrent}
        onNew={() => setShowNew(true)} onDelete={requestDelete}
      />

      <main className="flex-1 min-w-0 flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
        {/* Top bar */}
        <div className="flex items-stretch flex-shrink-0"
          style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', height: '3.5rem' }}>
          {/* Mobile menu (hidden on desktop) */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden px-4 transition-colors" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
            <Menu size={16} />
          </button>

          {/* Project breadcrumb */}
          <div className="flex items-center px-5 gap-2 flex-1">
            <FolderOpen size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span className="label-mono whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)' }}>
              {current?.name ?? 'No project'}
            </span>
            {current && (
              <span className="label-mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                / {TAB_LABELS[tab] ?? tab}
              </span>
            )}
          </div>

          {/* Tabs — only shown when sidebar is collapsed */}
          {!sidebarOpen && (
            <div className="hidden lg:flex items-stretch overflow-x-auto scrollbar-hide" style={{ borderLeft: '1px solid var(--border)' }}>
              {['overview', 'files', 'chat', 'conflicts', 'compare'].map((t) => (
                <button key={t} onClick={() => changeTab(t)}
                  className="h-full px-5 text-xs font-medium uppercase tracking-wider relative transition-colors flex-shrink-0"
                  style={{
                    color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.07em',
                    background: 'none', border: 'none',
                  }}>
                  {TAB_LABELS[t]}
                  {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: 'var(--accent)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}
