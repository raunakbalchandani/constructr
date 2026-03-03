'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { useTheme } from 'next-themes'
import * as api from '@/lib/api'
import {
  FileText, MessageSquare, AlertTriangle, GitCompare,
  Upload, Search, Settings, LogOut, Plus, Send,
  FileSearch, Trash2, Filter, Loader2, X, Menu,
  Sun, Moon, Layers, Clock, DollarSign, ClipboardList,
  ChevronRight, ChevronDown, HardHat, FileSignature, LayoutGrid,
  List, FolderOpen, Home, ShieldAlert, ArrowRight, CheckCircle2, Pencil, Check
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────
interface UploadedFile {
  id: string
  name: string
  type: string
  size: string
  uploadedAt: string
  parseQuality?: string
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
  { id: 'overview',  icon: Home,          label: 'Overview' },
  { id: 'files',     icon: Layers,        label: 'Files' },
  { id: 'chat',      icon: MessageSquare, label: 'AI Chat' },
  { id: 'conflicts', icon: AlertTriangle, label: 'Conflicts' },
  { id: 'compare',   icon: GitCompare,    label: 'Compare' },
  { id: 'settings',  icon: Settings,      label: 'Settings' },
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
                  ? <div className="py-2 px-1 space-y-2">
                      <p className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>No projects yet</p>
                      <button onClick={onNew} className="text-xs underline" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                        + Create first project →
                      </button>
                    </div>
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
            <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between px-2 py-1">
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
function OverviewTab({ project, files, setTab, analytics }: {
  project: Project | null; files: UploadedFile[]; setTab: (t: string) => void; analytics: api.ProjectAnalytics | null
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

      {/* Analytics stats */}
      {analytics && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              { label: 'DOCUMENTS', value: analytics.doc_count },
              { label: 'TOTAL WORDS', value: analytics.total_words.toLocaleString() },
              { label: 'CHAT THREADS', value: analytics.chat_count },
              { label: 'MESSAGES', value: analytics.message_count },
              { label: 'MEMORY FACTS', value: analytics.memory_fact_count },
            ].map(({ label, value }) => (
              <div key={label} className="p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>{label}</p>
                <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Doc type breakdown */}
          {Object.keys(analytics.type_breakdown).length > 0 && (
            <div className="mb-6 p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="label-mono mb-3" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>DOCUMENT TYPES</p>
              <div className="space-y-2">
                {Object.entries(analytics.type_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const c = cat(type)
                    const pct = analytics.doc_count > 0 ? Math.round((count / analytics.doc_count) * 100) : 0
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-xs w-28 flex-shrink-0 truncate" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{c.label}</span>
                        <div className="flex-1 h-1.5" style={{ backgroundColor: 'var(--border)' }}>
                          <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                        </div>
                        <span className="text-xs w-5 text-right flex-shrink-0" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </>
      )}

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

function FilesTab({ files, onUpload, onDelete, isUploading, onSearch, searchQuery, searchResults }: {
  files: UploadedFile[]; onUpload: (f: FileList) => void
  onDelete: (id: string) => void; isUploading: boolean
  onSearch: (q: string) => void; searchQuery: string; searchResults: api.SearchResult[] | null
}) {
  const [inputValue, setInputValue] = useState(searchQuery)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setInputValue(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current)
  }, [])

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

      {/* Content search bar */}
      <div className="flex items-center gap-2 mb-3" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
        <Search size={13} className="ml-3 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
        <input
          type="text"
          placeholder="Search document content…"
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value
            setInputValue(val)
            clearTimeout(searchTimerRef.current)
            searchTimerRef.current = setTimeout(() => {
              if (val.trim().length < 2) { onSearch(''); return }
              onSearch(val)
            }, 400)
          }}
          className="flex-1 py-2 px-1 text-sm bg-transparent outline-none"
          style={{ color: 'var(--text-primary)', fontSize: '16px' }}
        />
        {inputValue && (
          <button onClick={() => {
            clearTimeout(searchTimerRef.current)
            setInputValue('')
            onSearch('')
          }} className="mr-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Content search results */}
      {searchResults !== null && (
        <div className="space-y-2 mb-4">
          {searchResults.length === 0
            ? <p className="text-sm py-2 px-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                No results for &quot;{searchQuery}&quot;
              </p>
            : searchResults.map((r) => {
                const c = cat(r.document_type)
                return (
                  <div key={r.doc_id} className="p-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.filename}</span>
                      <span className="text-xs px-1.5 py-0.5 flex-shrink-0"
                        style={{ backgroundColor: c.color + '18', color: c.color, fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
                        {c.label.toUpperCase()}
                      </span>
                      <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {r.match_count} match{r.match_count !== 1 ? 'es' : ''}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.snippet}</p>
                  </div>
                )
              })
          }
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files…" className="input pl-9" />
      </div>

      {/* Drop zone — only shown when files already exist */}
      {files.length > 0 && (
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
      )}

      {/* File grid / list */}
      {files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
          <Upload size={32} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No documents yet</p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--text-secondary)' }}>
            Upload contracts, specs, RFIs, drawings, or any construction document to get started.
          </p>
          <label className="btn-primary cursor-pointer text-xs">
            Upload Document
            <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.dwg,.dxf,.png,.jpg" onChange={(e) => e.target.files && onUpload(e.target.files)} />
          </label>
        </div>
      )}
      {files.length > 0 && (shown.length === 0 ? (
        <div className="text-center py-14" style={{ border: '1px solid var(--border)' }}>
          <FileSearch size={28} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No files match your search
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

                {/* Quality badges */}
                {f.parseQuality === 'empty' && (
                  <span style={{
                    fontSize: '0.6rem', padding: '1px 5px',
                    backgroundColor: 'rgba(248,113,113,0.15)',
                    color: '#f87171', border: '1px solid rgba(248,113,113,0.3)',
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                    display: 'inline-block', marginBottom: '6px',
                  }}>EMPTY</span>
                )}
                {f.parseQuality === 'low' && (
                  <span style={{
                    fontSize: '0.6rem', padding: '1px 5px',
                    backgroundColor: 'rgba(251,191,36,0.15)',
                    color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)',
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                    display: 'inline-block', marginBottom: '6px',
                  }}>POOR</span>
                )}

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
        <div style={{ overflowX: 'auto' }}>
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
                    {f.parseQuality === 'empty' && (
                      <span style={{
                        fontSize: '0.6rem', padding: '1px 5px',
                        backgroundColor: 'rgba(248,113,113,0.15)',
                        color: '#f87171', border: '1px solid rgba(248,113,113,0.3)',
                        fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                        flexShrink: 0,
                      }}>EMPTY</span>
                    )}
                    {f.parseQuality === 'low' && (
                      <span style={{
                        fontSize: '0.6rem', padding: '1px 5px',
                        backgroundColor: 'rgba(251,191,36,0.15)',
                        color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)',
                        fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                        flexShrink: 0,
                      }}>POOR</span>
                    )}
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
        </div>
      ))}
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

const ALL_MODELS = [
  { id: 'gpt-4o',                   label: 'GPT-4o',          provider: 'OpenAI' },
  { id: 'gpt-4o-mini',              label: 'GPT-4o Mini',     provider: 'OpenAI' },
  { id: 'gpt-4-turbo',              label: 'GPT-4 Turbo',     provider: 'OpenAI' },
  { id: 'gpt-3.5-turbo',            label: 'GPT-3.5 Turbo',   provider: 'OpenAI' },
  { id: 'claude-opus-4-6',          label: 'Claude Opus 4.6', provider: 'Anthropic' },
  { id: 'claude-sonnet-4-6',        label: 'Claude Sonnet 4.6', provider: 'Anthropic' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', provider: 'Anthropic' },
]

function renderUserMessage(content: string) {
  // Highlight @mentions in the user bubble
  const parts = content.split(/(@[\w.\-]+)/)
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} style={{ fontWeight: 700, opacity: 0.75 }}>{part}</span>
      : <span key={i}>{part}</span>
  )
}

function ChatTab({ files, currentProject, messages, isLoading, onSendMessage, activeModel, onModelChange, threads, currentThreadId, onThreadSelect, onNewThread, onDeleteThread, onRenameThread }: {
  files: UploadedFile[]; currentProject: Project | null
  messages: Message[]; isLoading: boolean
  onSendMessage: (msg: string, referencedChatId?: number, useMemory?: boolean) => Promise<void>
  activeModel: string
  onModelChange: (model: string) => void
  threads: api.ChatThread[]
  currentThreadId: number | null
  onThreadSelect: (id: number) => void
  onNewThread: () => Promise<void>
  onDeleteThread: (id: number) => Promise<void>
  onRenameThread: (id: number, title: string) => Promise<void>
}) {
  const [input, setInput] = useState('')
  const [modelOpen, setModelOpen] = useState(false)
  const [threadOpen, setThreadOpen] = useState(false)
  const [newThreadLoading, setNewThreadLoading] = useState(false)
  const [memoryOn, setMemoryOn] = useState(true)
  const [pendingRefChatId, setPendingRefChatId] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Mention dropdown items: files first, then other threads
  const otherThreads = threads.filter(t => t.id !== currentThreadId)
  const mentionedFiles = files.filter(f =>
    mentionQuery === '' || f.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )
  const mentionedThreads = otherThreads.filter(t =>
    mentionQuery === '' || (t.title ?? '').toLowerCase().includes(mentionQuery.toLowerCase())
  )
  const mentionItems: Array<{ kind: 'file'; name: string } | { kind: 'thread'; id: number; title: string }> = [
    ...mentionedFiles.map(f => ({ kind: 'file' as const, name: f.name })),
    ...mentionedThreads.map(t => ({ kind: 'thread' as const, id: t.id, title: t.title ?? `Chat ${t.id}` })),
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const atMatch = before.match(/@([\w. ]*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1].trimEnd())
      setMentionStart(before.lastIndexOf('@'))
      setMentionIndex(0)
      setMentionOpen(true)
    } else {
      setMentionOpen(false)
    }
  }

  const selectMention = (item: typeof mentionItems[0]) => {
    const label = item.kind === 'file' ? item.name : item.title
    const after = input.slice(mentionStart + 1 + mentionQuery.length)
    setInput(input.slice(0, mentionStart) + '@' + label + ' ' + after.trimStart())
    if (item.kind === 'thread') setPendingRefChatId(item.id)
    setMentionOpen(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const send = async () => {
    if (!input.trim() || isLoading || !currentProject) return
    setMentionOpen(false)
    const msg = input; setInput('')
    const refId = pendingRefChatId ?? undefined
    setPendingRefChatId(null)
    await onSendMessage(msg, refId, memoryOn)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionItems.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (mentionItems[mentionIndex]) selectMention(mentionItems[mentionIndex])
      }
      else if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false) }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const activeModelLabel = ALL_MODELS.find(m => m.id === activeModel)?.label ?? activeModel

  const currentThread = threads.find(t => t.id === currentThreadId)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// AI ASSISTANT</p>
          <h1 className="text-3xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>Ask Foreperson</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Thread switcher */}
          {threads.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setThreadOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                style={{
                  border: '1px solid var(--border)',
                  backgroundColor: threadOpen ? 'var(--surface)' : 'var(--card)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.05em',
                }}
              >
                <MessageSquare size={11} />
                <span>{currentThread?.title ?? 'Chat'}</span>
                <ChevronDown size={11} />
              </button>
              {threadOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px]"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {threads.map(t => (
                    <div key={t.id} className="group flex items-center"
                      style={{
                        backgroundColor: t.id === currentThreadId ? 'var(--card)' : 'transparent',
                        borderLeft: t.id === currentThreadId ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                      onMouseEnter={(e) => { if (t.id !== currentThreadId) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--card)' }}
                      onMouseLeave={(e) => { if (t.id !== currentThreadId) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}
                    >
                      {renamingId === t.id ? (
                        <form className="flex-1 flex items-center gap-1 px-2 py-1.5"
                          onSubmit={async (e) => {
                            e.preventDefault()
                            if (renameValue.trim()) await onRenameThread(t.id, renameValue.trim())
                            setRenamingId(null)
                          }}>
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setRenamingId(null) }}
                            onBlur={() => setRenamingId(null)}
                            className="flex-1 bg-transparent text-xs px-1 py-0.5 outline-none"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--accent)',
                            }}
                            autoFocus
                          />
                          <button type="submit" style={{ color: 'var(--accent)' }}>
                            <Check size={10} />
                          </button>
                        </form>
                      ) : (
                        <button className="flex-1 flex items-center justify-between px-3 py-2.5 text-left"
                          onClick={() => { onThreadSelect(t.id); setThreadOpen(false) }}>
                          <span className="text-xs truncate" style={{ fontFamily: 'var(--font-mono)', color: t.id === currentThreadId ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{t.title ?? `Chat ${t.id}`}</span>
                          <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>{t.message_count}</span>
                        </button>
                      )}
                      {renamingId !== t.id && (
                        <>
                          <button
                            className="opacity-0 group-hover:opacity-100 px-1.5 py-2.5 transition-opacity"
                            style={{ color: 'var(--text-secondary)' }}
                            title="Rename chat"
                            onClick={(e) => { e.stopPropagation(); setRenameValue(t.title ?? `Chat ${t.id}`); setRenamingId(t.id); setTimeout(() => renameInputRef.current?.select(), 0) }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
                          >
                            <Pencil size={9} />
                          </button>
                          <button
                            className="opacity-0 group-hover:opacity-100 px-1.5 py-2.5 transition-opacity"
                            style={{ color: 'var(--text-secondary)' }}
                            title="Delete chat"
                            onClick={async (e) => { e.stopPropagation(); setThreadOpen(false); await onDeleteThread(t.id) }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
                          >
                            <X size={9} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={async () => { setThreadOpen(false); setNewThreadLoading(true); await onNewThread(); setNewThreadLoading(false) }}
                      disabled={newThreadLoading}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors"
                      style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--card)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                    >
                      <Plus size={11} />
                      {newThreadLoading ? 'Creating…' : 'New Chat'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Model picker */}
          <div className="relative">
            <button
              onClick={() => setModelOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
              style={{
                border: '1px solid var(--border)',
                backgroundColor: modelOpen ? 'var(--surface)' : 'var(--card)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)',
                letterSpacing: '0.05em',
              }}
            >
              <span>{activeModelLabel}</span>
              <ChevronDown size={11} />
            </button>
            {modelOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px]"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                {['OpenAI', 'Anthropic'].map(provider => (
                  <div key={provider}>
                    <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
                      <span className="label-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>{provider.toUpperCase()}</span>
                    </div>
                    {ALL_MODELS.filter(m => m.provider === provider).map(m => (
                      <button key={m.id}
                        onClick={() => { onModelChange(m.id); setModelOpen(false) }}
                        className="w-full text-left px-3 py-2 text-xs transition-colors"
                        style={{
                          color: m.id === activeModel ? 'var(--accent)' : 'var(--text-secondary)',
                          backgroundColor: m.id === activeModel ? 'rgba(245,200,0,0.05)' : 'transparent',
                          fontFamily: 'var(--font-mono)',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--card)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = m.id === activeModel ? 'rgba(245,200,0,0.05)' : 'transparent' }}
                      >
                        {m.id === activeModel ? '▶ ' : '   '}{m.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Memory toggle */}
          <button
            onClick={() => setMemoryOn(o => !o)}
            title={memoryOn ? 'Memory ON — click to disable' : 'Memory OFF — click to enable'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors"
            style={{
              border: `1px solid ${memoryOn ? 'var(--accent)' : 'var(--border)'}`,
              backgroundColor: memoryOn ? 'rgba(245,200,0,0.07)' : 'var(--card)',
              fontFamily: 'var(--font-mono)',
              color: memoryOn ? 'var(--accent)' : 'var(--text-secondary)',
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ fontSize: '0.6rem' }}>◉</span>
            {memoryOn ? 'MEM ON' : 'MEM OFF'}
          </button>
          {files.length > 0 && (
            <div className="text-right">
              <p className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>CONTEXT</p>
              <p className="text-xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
                {files.length} FILES
              </p>
            </div>
          )}
        </div>
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
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 text-center px-4 py-8">
            <MessageSquare size={28} style={{ color: 'var(--accent)', opacity: 0.3 }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ask Foreperson anything</p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {[
                'Summarize all contracts',
                'What are the key deadlines?',
                'Find any scope conflicts',
                'Who are the key parties?',
              ].map((prompt) => (
                <button key={prompt} onClick={() => setInput(prompt)}
                  className="text-xs px-3 py-2 text-left transition-colors"
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
                  }}>
                  {prompt} →
                </button>
              ))}
            </div>
          </div>
        )}
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
                  <p className="whitespace-pre-wrap font-medium">{renderUserMessage(msg.content)}</p>
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
      <div className="mt-4 flex-shrink-0">
        <div className="relative">
          {/* @mention dropdown — files + threads */}
          {mentionOpen && mentionItems.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-full max-h-52 overflow-y-auto z-50"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--accent)', boxShadow: '0 -4px 16px rgba(0,0,0,0.3)' }}>
              <div className="px-3 py-1.5"
                style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>
                  @ REFERENCE
                </span>
              </div>
              {mentionedFiles.length > 0 && (
                <div className="px-3 py-1" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>DOCUMENTS</span>
                </div>
              )}
              {mentionedFiles.map((f, i) => {
                const c = cat(f.type)
                const Icon = c.icon
                return (
                  <button key={f.id}
                    onClick={() => selectMention({ kind: 'file', name: f.name })}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 transition-colors"
                    style={{
                      backgroundColor: i === mentionIndex ? 'rgba(245,200,0,0.08)' : 'transparent',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={() => setMentionIndex(i)}>
                    <Icon size={12} style={{ color: c.color, flexShrink: 0 }} />
                    <span className="text-xs truncate flex-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{f.name}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem' }}>{c.label}</span>
                  </button>
                )
              })}
              {mentionedThreads.length > 0 && (
                <div className="px-3 py-1" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>CHAT THREADS</span>
                </div>
              )}
              {mentionedThreads.map((t, i) => {
                const idx = mentionedFiles.length + i
                return (
                  <button key={t.id}
                    onClick={() => selectMention({ kind: 'thread', id: t.id, title: t.title ?? `Chat ${t.id}` })}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 transition-colors"
                    style={{
                      backgroundColor: idx === mentionIndex ? 'rgba(245,200,0,0.08)' : 'transparent',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={() => setMentionIndex(idx)}>
                    <MessageSquare size={12} style={{ color: '#60A5FA', flexShrink: 0 }} />
                    <span className="text-xs truncate flex-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{t.title ?? `Chat ${t.id}`}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: '#60A5FA', fontSize: '0.6rem' }}>THREAD</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex gap-2">
            <textarea ref={inputRef} value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={!currentProject ? 'Select a project first…' : files.length === 0 ? 'Ask a question or type @ to reference a document…' : 'Ask anything… type @ to reference a document'}
              disabled={!currentProject || isLoading}
              className="input flex-1"
              style={{ resize: 'none', minHeight: 44, maxHeight: 120, overflowY: 'auto', lineHeight: '1.5', fontSize: '16px' }} />
            <button onClick={send}
              disabled={!input.trim() || isLoading || !currentProject}
              className="btn-primary p-3 flex-shrink-0">
              <Send size={15} />
            </button>
          </div>
        </div>
        {files.length > 0 && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            Type @ to reference a specific document · Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Conflicts Tab ──────────────────────────────────────────
function ConflictsTab({ files, currentProject }: { files: UploadedFile[]; currentProject: Project | null }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [conflicts, setConflicts] = useState<api.Conflict[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [hasScanned, setHasScanned] = useState(false)

  useEffect(() => {
    setHasScanned(false)
    setConflicts([])
  }, [currentProject?.id ?? currentProject])

  const toggleFile = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const analyze = async () => {
    if (!currentProject) return
    const scope = selectedIds.size > 0 ? files.filter(f => selectedIds.has(f.id)) : files
    if (scope.length < 2) { setError('Select at least 2 files to analyze'); return }
    setAnalyzing(true); setError(''); setHasScanned(false)
    try {
      const docIds = selectedIds.size > 0 ? Array.from(selectedIds).map(id => parseInt(id)) : undefined
      const data = await api.chat.conflicts(parseInt(currentProject.id), docIds)
      setConflicts(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed.')
    } finally { setAnalyzing(false); setHasScanned(true) }
  }

  const high = conflicts.filter(c => c.severity === 'high')
  const med  = conflicts.filter(c => c.severity === 'medium')
  const low  = conflicts.filter(c => c.severity === 'low')

  const SEV: Record<string, { accent: string; bg: string; border: string; label: string }> = {
    high:   { accent: '#ef4444', bg: 'rgba(239,68,68,0.03)',  border: 'rgba(239,68,68,0.18)',  label: 'HIGH' },
    medium: { accent: '#f5c800', bg: 'rgba(245,200,0,0.03)',  border: 'rgba(245,200,0,0.18)',  label: 'MED'  },
    low:    { accent: '#60a5fa', bg: 'rgba(96,165,250,0.03)', border: 'rgba(96,165,250,0.15)', label: 'LOW'  },
  }

  const mono = { fontFamily: 'var(--font-mono)' } as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: 4 }}>// RISK REGISTER</p>
          <h1 className="text-3xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>Conflicts</h1>
        </div>
        <button onClick={analyze} disabled={analyzing || files.length < 2} className="btn-primary flex items-center gap-2 flex-shrink-0">
          {analyzing ? <><Loader2 size={13} className="animate-spin" />Scanning…</> : <><ShieldAlert size={13} />Run Scan</>}
        </button>
      </div>

      {/* Stats bar */}
      {conflicts.length > 0 && (
        <div className="flex items-stretch gap-px" style={{ backgroundColor: 'var(--border)' }}>
          {[
            { label: 'HIGH',  count: high.length,      color: '#ef4444' },
            { label: 'MED',   count: med.length,       color: '#f5c800' },
            { label: 'LOW',   count: low.length,       color: '#60a5fa' },
            { label: 'TOTAL', count: conflicts.length, color: 'var(--text-primary)' },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex-1 px-4 py-3" style={{ backgroundColor: 'var(--card)' }}>
              <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
              <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color }}>{count}</div>
            </div>
          ))}
        </div>
      )}

      {/* File selector */}
      {files.length >= 2 && (
        <div style={{ border: '1px solid var(--border)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
            <span style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--text-secondary)' }}>
              SCOPE — {selectedIds.size === 0 ? `ALL ${files.length} FILES` : `${selectedIds.size} OF ${files.length} SELECTED`}
            </span>
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())} style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>CLEAR</button>
            )}
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {files.map(f => {
              const on = selectedIds.has(f.id)
              return (
                <button key={f.id} onClick={() => toggleFile(f.id)} className="flex items-center gap-2 px-3 py-1.5 transition-all" style={{
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  backgroundColor: on ? 'rgba(245,200,0,0.07)' : 'transparent',
                  ...mono, fontSize: '0.63rem',
                  color: on ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: on ? 'var(--accent)' : 'transparent', border: `1px solid ${on ? 'var(--accent)' : 'var(--text-secondary)'}`, flexShrink: 0, display: 'inline-block' }} />
                  {f.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 text-xs" style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', ...mono }}>
          ✖ {error}
        </div>
      )}

      {/* Empty states */}
      {files.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-20" style={{ border: '1px solid var(--border)' }}>
          <FileSearch size={32} className="mb-4" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ ...mono, fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>UPLOAD AT LEAST 2 DOCUMENTS</p>
        </div>
      ) : hasScanned && conflicts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
          <CheckCircle2 size={28} style={{ color: '#34d399' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No conflicts found</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your documents appear to be consistent with each other.</p>
        </div>
      ) : conflicts.length === 0 && !analyzing ? (
        <div className="flex flex-col items-center justify-center py-20" style={{ border: '1px solid var(--border)' }}>
          <ShieldAlert size={32} className="mb-4" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ ...mono, fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
            {selectedIds.size > 0 ? `${selectedIds.size}` : files.length} FILES IN SCOPE — READY TO SCAN
          </p>
        </div>
      ) : (
        /* Conflict cards */
        <div className="space-y-2">
          {conflicts.map((c, i) => {
            const s = SEV[c.severity] ?? SEV.medium
            return (
              <div key={c.id} style={{ borderLeft: `3px solid ${s.accent}`, border: `1px solid ${s.border}`, borderLeftWidth: 3 }}>
                {/* Number + title + badge */}
                <div className="flex items-stretch" style={{ borderBottom: `1px solid ${s.border}` }}>
                  <div className="flex items-center justify-center px-4" style={{ borderRight: `1px solid ${s.border}`, minWidth: 52, backgroundColor: s.bg }}>
                    <span style={{ ...mono, fontSize: '0.7rem', color: s.accent, letterSpacing: '0.04em' }}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-3 px-4 py-3.5">
                    <h3 className="font-bold text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
                    <span style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.1em', color: s.accent, border: `1px solid ${s.accent}`, padding: '1px 7px', flexShrink: 0 }}>{s.label}</span>
                  </div>
                </div>
                {/* Description */}
                <div className="px-4 py-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)', backgroundColor: s.bg, borderBottom: `1px solid ${s.border}` }}>
                  {c.description}
                </div>
                {/* Resolution */}
                {c.resolution && (
                  <div className="px-4 py-3 flex gap-2.5 text-xs" style={{ borderBottom: c.documents.length ? `1px solid ${s.border}` : undefined }}>
                    <ArrowRight size={11} style={{ color: s.accent, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ color: 'var(--text-primary)' }}>{c.resolution}</span>
                  </div>
                )}
                {/* Doc tags */}
                {c.documents.length > 0 && (
                  <div className="px-4 py-2.5 flex flex-wrap gap-1.5">
                    {c.documents.map((doc, j) => (
                      <span key={j} style={{ ...mono, fontSize: '0.58rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '1px 7px', backgroundColor: 'var(--bg)' }}>
                        {doc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Compare Tab ────────────────────────────────────────────
function CompareTab({ files, currentProject }: { files: UploadedFile[]; currentProject: Project | null }) {
  const [f1, setF1] = useState('')
  const [f2, setF2] = useState('')
  const [result, setResult] = useState<api.CompareResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState('')

  const runCompare = async () => {
    if (!f1 || !f2 || !currentProject) return
    setComparing(true); setError('')
    try {
      const data = await api.chat.compare(parseInt(currentProject.id), parseInt(f1), parseInt(f2))
      setResult(data)
    } catch (err: any) {
      setError(err.message ?? 'Comparison failed.')
    } finally { setComparing(false) }
  }

  const mono = { fontFamily: 'var(--font-mono)' } as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: 4 }}>// DOCUMENT COMPARE</p>
        <h1 className="text-3xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>Compare</h1>
      </div>

      {/* Doc selectors */}
      <div className="grid md:grid-cols-2 gap-px" style={{ backgroundColor: 'var(--border)' }}>
        {[
          { val: f1, other: f2, set: setF1, label: 'DOCUMENT A' },
          { val: f2, other: f1, set: setF2, label: 'DOCUMENT B' },
        ].map(({ val, other, set, label }) => (
          <div key={label} className="p-5" style={{ backgroundColor: 'var(--card)' }}>
            <label className="block mb-2" style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--text-secondary)' }}>{label}</label>
            <select value={val} onChange={e => { set(e.target.value); setResult(null) }} className="input appearance-none">
              <option value="">Select a document…</option>
              {files.filter(f => f.id !== other).map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button onClick={runCompare} disabled={!f1 || !f2 || comparing || !currentProject} className="btn-primary flex items-center gap-2">
        {comparing ? <><Loader2 size={13} className="animate-spin" />Comparing…</> : <><GitCompare size={13} />Run Comparison</>}
      </button>

      {error && (
        <div className="px-4 py-3 text-xs" style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', ...mono }}>
          ✖ {error}
        </div>
      )}

      {!result && files.length < 2 && (
        <div className="flex flex-col items-center justify-center py-20" style={{ border: '1px solid var(--border)' }}>
          <GitCompare size={32} className="mb-4" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ ...mono, fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>UPLOAD AT LEAST 2 DOCUMENTS</p>
        </div>
      )}

      {result && (
        <div style={{ border: '1px solid var(--border)' }}>
          {/* Doc header */}
          <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
            <span style={{ ...mono, fontSize: '0.63rem', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '2px 8px' }}>{result.doc1_name}</span>
            <GitCompare size={11} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span style={{ ...mono, fontSize: '0.63rem', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '2px 8px' }}>{result.doc2_name}</span>
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)', borderLeft: '3px solid var(--accent)' }}>
              <p style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.15em', color: 'var(--accent)', marginBottom: 8 }}>EXECUTIVE SUMMARY</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{result.summary}</p>
            </div>
          )}

          {/* Direct conflicts */}
          {result.conflicts.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
                <span style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.12em', color: '#ef4444' }}>DIRECT CONFLICTS</span>
                <span style={{ ...mono, fontSize: '0.58rem', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', padding: '0 6px' }}>{result.conflicts.length}</span>
              </div>
              <div>
                {result.conflicts.map((c, i) => (
                  <div key={i} className="p-5 space-y-4" style={{ borderBottom: i < result.conflicts.length - 1 ? '1px solid var(--border)' : undefined }}>
                    <div className="flex items-center gap-3">
                      <span style={{ ...mono, fontSize: '0.63rem', color: '#ef4444' }}>{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-px" style={{ backgroundColor: 'var(--border)' }}>
                      <div className="p-4" style={{ backgroundColor: 'var(--bg)' }}>
                        <p style={{ ...mono, fontSize: '0.53rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 6 }}>DOC A — {result.doc1_name}</p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>"{c.doc_a}"</p>
                      </div>
                      <div className="p-4" style={{ backgroundColor: 'var(--bg)' }}>
                        <p style={{ ...mono, fontSize: '0.53rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 6 }}>DOC B — {result.doc2_name}</p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>"{c.doc_b}"</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <p style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ ...mono, fontSize: '0.53rem', letterSpacing: '0.08em', color: '#ef4444' }}>IMPACT / </span>{c.impact}
                      </p>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ ...mono, fontSize: '0.53rem', letterSpacing: '0.08em', color: 'var(--accent)' }}>→ ACTION / </span>{c.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scope gaps */}
          {result.gaps.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
                <span style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.12em', color: '#f97316' }}>SCOPE GAPS</span>
              </div>
              <div className="p-5 space-y-2.5">
                {result.gaps.map((g, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ ...mono, fontSize: '0.6rem', color: '#f97316', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span>{g}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agreements */}
          {result.agreements.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
                <span style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.12em', color: '#4ade80' }}>AGREEMENTS</span>
              </div>
              <div className="p-5 space-y-2.5">
                {result.agreements.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <CheckCircle2 size={11} style={{ color: '#4ade80', flexShrink: 0, marginTop: 1 }} />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top risks */}
          {result.risks.length > 0 && (
            <div>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
                <span style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--accent)' }}>TOP RISKS</span>
              </div>
              <div>
                {result.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-4 px-5 py-4" style={{ borderBottom: i < result.risks.length - 1 ? '1px solid var(--border)' : undefined }}>
                    <span style={{ ...mono, fontSize: '0.68rem', color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.title}</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Model definitions ───────────────────────────────────────
const OPENAI_MODELS = [
  { id: 'gpt-4o',          name: 'GPT-4o',         badge: 'Most Capable', desc: 'Best reasoning, complex document analysis, highest accuracy.' },
  { id: 'gpt-4o-mini',     name: 'GPT-4o Mini',    badge: 'Default',      desc: 'Fast and cost-effective. Best for most construction queries.' },
  { id: 'gpt-4-turbo',     name: 'GPT-4 Turbo',    badge: null,           desc: 'Previous-generation GPT-4 with 128k context window.' },
  { id: 'gpt-3.5-turbo',   name: 'GPT-3.5 Turbo',  badge: 'Fastest',      desc: 'Fastest and cheapest. Good for simple lookups and summaries.' },
]

const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-6',          name: 'Claude Opus 4.6',    badge: 'Most Capable', desc: 'Anthropic\'s most powerful model. Best for complex reasoning across large document sets.' },
  { id: 'claude-sonnet-4-6',        name: 'Claude Sonnet 4.6',  badge: 'Default',      desc: 'Balanced performance and speed. Excellent for contracts, specs, and RFIs.' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',  badge: 'Fastest',      desc: 'Ultra-fast and lightweight. Great for quick lookups and field queries.' },
]

// ─── Settings Tab ───────────────────────────────────────────
function SettingsTab({ selectedModel, onModelChange }: {
  selectedModel: string
  onModelChange: (model: string) => void
}) {
  const ModelCard = ({ id, name, badge, desc, isSelected, onSelect }: {
    id: string; name: string; badge: string | null; desc: string
    isSelected: boolean; onSelect: () => void
  }) => (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 transition-colors"
      style={{
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
        backgroundColor: isSelected ? 'rgba(245,200,0,0.04)' : 'transparent',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Radio indicator */}
          <div className="w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center"
            style={{ borderColor: isSelected ? 'var(--accent)' : 'var(--border)' }}>
            {isSelected && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase" style={{ letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{name}</span>
              {badge && (
                <span className="text-xs px-1.5 py-0.5"
                  style={{
                    backgroundColor: badge === 'Default' ? 'var(--accent)' : 'var(--surface)',
                    color: badge === 'Default' ? 'var(--accent-dark)' : 'var(--text-secondary)',
                    border: badge === 'Default' ? 'none' : '1px solid var(--border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.55rem',
                    letterSpacing: '0.06em',
                  }}>
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
          </div>
        </div>
      </div>
    </button>
  )

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// ACCOUNT SETTINGS</p>
        <h1 className="text-3xl font-black uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>
      </div>

      {/* ── AI Model Selection ─────────────────────────────── */}
      <div style={{ border: '1px solid var(--border)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>AI MODEL</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Select the model used for chat and conflict analysis. If the selected model&apos;s quota is exhausted, the system will not auto-fallback — switch to another model.
          </p>
        </div>

        {/* OpenAI section */}
        <div>
          <div className="px-6 py-3 flex items-center gap-3"
            style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#10a37f' }}>
              <span style={{ color: '#fff', fontSize: '0.45rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>AI</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>OpenAI</span>
            <span className="label-mono ml-auto" style={{ fontFamily: 'var(--font-mono)' }}>GPT series</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {OPENAI_MODELS.map(m => (
              <ModelCard key={m.id} {...m} isSelected={selectedModel === m.id} onSelect={() => onModelChange(m.id)} />
            ))}
          </div>
        </div>

        {/* Anthropic section */}
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div className="px-6 py-3 flex items-center gap-3"
            style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#cc785c' }}>
              <span style={{ color: '#fff', fontSize: '0.45rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>AN</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>Anthropic</span>
            <span className="label-mono ml-auto" style={{ fontFamily: 'var(--font-mono)' }}>Claude series</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {ANTHROPIC_MODELS.map(m => (
              <ModelCard key={m.id} {...m} isSelected={selectedModel === m.id} onSelect={() => onModelChange(m.id)} />
            ))}
          </div>
        </div>

        <div className="px-6 py-3" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            ACTIVE: <span style={{ color: 'var(--accent)' }}>{selectedModel}</span>
          </p>
        </div>
      </div>

      {/* ── Profile ─────────────────────────────────────────── */}
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

      {/* ── Danger Zone ─────────────────────────────────────── */}
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
  const [tab, setTab] = useState('overview')
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
  const [chatThreads, setChatThreads] = useState<api.ChatThread[]>([])
  const [currentChatId, setCurrentChatId] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini')
  const [projectAnalytics, setProjectAnalytics] = useState<api.ProjectAnalytics | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<api.SearchResult[] | null>(null)

  useEffect(() => { loadProjects() }, [])
  useEffect(() => {
    const savedTab = localStorage.getItem('fp-tab')
    const savedModel = localStorage.getItem('fp-model')
    if (savedTab) setTab(savedTab)
    if (savedModel) setSelectedModel(savedModel)
  }, [])
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])
  useEffect(() => {
    if (current) {
      loadFiles()
      setChatLoaded((p) => ({ ...p, [current.id]: false }))
      setChatThreads([])
      setCurrentChatId(null)
      setProjectAnalytics(null)
      setSearchQuery('')
      setSearchResults(null)
      api.analytics.get(parseInt(current.id)).then(setProjectAnalytics).catch(() => {})
    } else {
      setFiles([])
      setChatMsgs([])
      setChatThreads([])
      setCurrentChatId(null)
      setProjectAnalytics(null)
      setSearchQuery('')
      setSearchResults(null)
    }
  }, [current])
  useEffect(() => {
    if (tab === 'chat' && current && !chatLoaded[current.id]) loadChatThreads()
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
        parseQuality: d.parse_quality ?? 'good',
      })))
    } catch (e) { console.error(e) }
  }

  const loadChatThreads = async () => {
    if (!current) return
    try {
      const threads = await api.chat.threads(parseInt(current.id))
      setChatThreads(threads)
      if (threads.length > 0) {
        await loadChatHistory(threads[0].id)
      } else {
        // No threads yet — the first send will create one
        setChatMsgs([{ id: '0', role: 'assistant', content: 'Hello! I\'m Foreperson — your AI construction assistant. Upload project files for project-specific answers, or ask me anything about construction in general.', timestamp: new Date() }])
        setChatLoaded((p) => ({ ...p, [current.id]: true }))
      }
    } catch {
      setChatMsgs([{ id: '0', role: 'assistant', content: 'Hello! I\'m Foreperson — your AI construction assistant. Ask me anything about construction, or upload files for project-specific answers.', timestamp: new Date() }])
    }
  }

  const loadChatHistory = async (chatId: number) => {
    if (!current) return
    try {
      const data = await api.chat.history(parseInt(current.id), chatId)
      setCurrentChatId(data.id)
      if (data.messages?.length > 0) {
        setChatMsgs(data.messages.map((m: any) => ({ id: m.id.toString(), role: m.role, content: m.content, timestamp: new Date(m.created_at) })))
      } else {
        setChatMsgs([{ id: '0', role: 'assistant', content: 'Hello! I\'m Foreperson — your AI construction assistant. Upload project files for project-specific answers, or ask me anything about construction in general.', timestamp: new Date() }])
      }
      setChatLoaded((p) => ({ ...p, [current.id]: true }))
    } catch {
      setChatMsgs([{ id: '0', role: 'assistant', content: 'Hello! I\'m Foreperson — your AI construction assistant. Ask me anything about construction, or upload files for project-specific answers.', timestamp: new Date() }])
    }
  }

  const handleNewThread = async () => {
    if (!current) return
    const newThread = await api.chat.newThread(parseInt(current.id))
    setChatThreads((prev) => [...prev, { id: newThread.id, title: newThread.title, message_count: 0, created_at: newThread.created_at }])
    setCurrentChatId(newThread.id)
    setChatMsgs([{ id: '0', role: 'assistant', content: 'New chat started! Ask me anything about your project or construction in general.', timestamp: new Date() }])
  }

  const handleThreadSelect = async (chatId: number) => {
    await loadChatHistory(chatId)
  }

  const handleRenameThread = async (chatId: number, title: string) => {
    if (!current) return
    await api.chat.renameThread(parseInt(current.id), chatId, title)
    setChatThreads((prev) => prev.map(t => t.id === chatId ? { ...t, title } : t))
  }

  const handleDeleteThread = async (chatId: number) => {
    if (!current) return
    await api.chat.deleteThread(parseInt(current.id), chatId)
    const remaining = chatThreads.filter(t => t.id !== chatId)
    setChatThreads(remaining)
    if (currentChatId === chatId) {
      if (remaining.length > 0) {
        await loadChatHistory(remaining[remaining.length - 1].id)
      } else {
        setCurrentChatId(null)
        setChatMsgs([{ id: '0', role: 'assistant', content: 'Hello! I\'m Foreperson — your AI construction assistant. Upload project files for project-specific answers, or ask me anything about construction in general.', timestamp: new Date() }])
      }
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
        setFiles((p) => [{ id: doc.id.toString(), name: doc.original_filename, type: doc.document_type ?? 'unknown', size: formatSize(doc.file_size ?? 0), uploadedAt: new Date().toISOString().split('T')[0], parseQuality: doc.parse_quality ?? 'good' }, ...p])
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

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q)
    if (!q.trim() || !current) { setSearchResults(null); return }
    try {
      const res = await api.documents.search(parseInt(current.id), q)
      setSearchResults(res.results)
    } catch { setSearchResults([]) }
  }, [current])

  const handleSendMessage = async (msg: string, referencedChatId?: number, useMemory = true) => {
    if (!current) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() }
    setChatMsgs((p) => [...p, userMsg])
    setChatLoading(true)
    try {
      const data = await api.chat.send(parseInt(current.id), msg, selectedModel, currentChatId ?? undefined, useMemory, referencedChatId)
      setChatMsgs((p) => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response ?? 'No response.', timestamp: new Date() }])
      setChatLoaded((p) => ({ ...p, [current.id]: true }))
      // Refresh thread list to update message counts
      api.chat.threads(parseInt(current.id)).then(setChatThreads).catch(() => {})
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred. Please try again.'
      setChatMsgs((p) => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', content: errMsg, timestamp: new Date() }])
    } finally { setChatLoading(false) }
  }

  const renderContent = () => {
    switch (tab) {
      case 'overview':  return <OverviewTab project={current} files={files} setTab={changeTab} analytics={projectAnalytics} />
      case 'files':     return <FilesTab files={files} onUpload={handleUpload} onDelete={handleDeleteFile} isUploading={uploading} onSearch={handleSearch} searchQuery={searchQuery} searchResults={searchResults} />
      case 'chat':      return <ChatTab files={files} currentProject={current} messages={chatMsgs} isLoading={chatLoading} onSendMessage={handleSendMessage} activeModel={selectedModel} onModelChange={(m) => { setSelectedModel(m); localStorage.setItem('fp-model', m) }} threads={chatThreads} currentThreadId={currentChatId} onThreadSelect={handleThreadSelect} onNewThread={handleNewThread} onDeleteThread={handleDeleteThread} onRenameThread={handleRenameThread} />
      case 'conflicts': return <ConflictsTab files={files} currentProject={current} />
      case 'compare':   return <CompareTab files={files} currentProject={current} />
      case 'settings':  return <SettingsTab selectedModel={selectedModel} onModelChange={(m) => { setSelectedModel(m); localStorage.setItem('fp-model', m) }} />
      default:          return <OverviewTab project={current} files={files} setTab={changeTab} analytics={projectAnalytics} />
    }
  }

  const TAB_LABELS: Record<string, string> = { overview: 'Overview', files: 'Files', chat: 'Chat', conflicts: 'Conflicts', compare: 'Compare', settings: 'Settings → AI Model' }

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
              {['overview', 'files', 'chat', 'conflicts', 'compare', 'settings'].map((t) => (
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
