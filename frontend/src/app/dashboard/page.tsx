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
  ChevronRight, HardHat, FileSignature
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

// ─── File category config ───────────────────────────────────
const FILE_CATEGORIES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  drawing:      { label: 'Drawing',         color: '#818CF8', icon: Layers },
  floor_plan:   { label: 'Floor Plan',      color: '#A78BFA', icon: Layers },
  site_plan:    { label: 'Site Plan',       color: '#C084FC', icon: Layers },
  specification:{ label: 'Specification',   color: '#F59E0B', icon: FileText },
  contract:     { label: 'Contract',        color: '#34D399', icon: FileSignature },
  rfi:          { label: 'RFI',             color: '#F87171', icon: ClipboardList },
  submittal:    { label: 'Submittal',       color: '#60A5FA', icon: FileSearch },
  change_order: { label: 'Change Order',    color: '#FB923C', icon: DollarSign },
  schedule:     { label: 'Schedule',        color: '#A3E635', icon: Clock },
  budget:       { label: 'Budget',          color: '#4ADE80', icon: DollarSign },
  report:       { label: 'Report',          color: '#94A3B8', icon: HardHat },
  minutes:      { label: 'Meeting Minutes', color: '#22D3EE', icon: MessageSquare },
  punch_list:   { label: 'Punch List',      color: '#FB7185', icon: ClipboardList },
  unknown:      { label: 'Other',           color: '#6B7280', icon: FileText },
}

function getCategoryConfig(type: string) {
  return FILE_CATEGORIES[type] ?? FILE_CATEGORIES.unknown
}

// ─── Theme toggle ───────────────────────────────────────────
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
      aria-label={isDark ? 'Switch to Light' : 'Switch to Dark'}
      className="p-2 transition-colors"
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}

// ─── New Project Modal (with error feedback) ───────────────
function NewProjectModal({
  isOpen, onClose, onAdd
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: (name: string, description?: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsLoading(true)
    setError('')
    try {
      await onAdd(name.trim(), description.trim() || undefined)
      setName('')
      setDescription('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md p-6"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// NEW PROJECT</p>
            <h2 className="text-xl font-black uppercase" style={{ fontFamily: 'var(--font-display)' }}>Create Project</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="North Tower — Phase 2"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input resize-none"
              style={{ minHeight: 80 }}
              placeholder="Brief project description (optional)"
            />
          </div>
          {error && (
            <div className="text-xs px-3 py-2"
              style={{ color: '#f87171', backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', fontFamily: 'var(--font-mono)' }}>
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost" disabled={isLoading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Creating…' : 'Create →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Project Modal ───────────────────────────────────
function DeleteProjectModal({
  isOpen, onClose, onConfirm, projectName
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  projectName: string
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    await onConfirm()
    setIsDeleting(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md p-6"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)', color: '#f87171' }}>// DESTRUCTIVE ACTION</p>
        <h2 className="text-xl font-black uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: '#f87171' }}>Delete Project</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Delete <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>"{projectName}"</span> and all its files?
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost" disabled={isDeleting}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#f87171', color: '#fff' }}
          >
            {isDeleting ? 'Deleting…' : 'Delete Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ───────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'files',     icon: Layers,        label: 'Files' },
  { id: 'chat',      icon: MessageSquare, label: 'AI Chat' },
  { id: 'conflicts', icon: AlertTriangle, label: 'Conflicts' },
  { id: 'compare',   icon: GitCompare,    label: 'Compare' },
]

function Sidebar({
  isOpen, onClose, onToggle, activeTab, setActiveTab,
  projects, currentProject, setCurrentProject,
  onNewProject, onDeleteProject
}: {
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
  activeTab: string
  setActiveTab: (tab: string) => void
  projects: Project[]
  currentProject: Project | null
  setCurrentProject: (p: Project) => void
  onNewProject: () => void
  onDeleteProject: (id: string) => void
}) {
  return (
    <>
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col
          ${isOpen ? 'w-64' : 'w-0 lg:w-14'}
          transition-all duration-200 overflow-hidden`}
        style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo row */}
        <div className="flex items-center justify-between px-4 h-14 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', minWidth: isOpen ? 256 : undefined }}>
          {isOpen ? (
            <>
              <Link href="/" className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-mono)', fontSize: '0.55rem' }}>FP</span>
                </div>
                <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>Foreperson.ai</span>
              </Link>
              <button onClick={onToggle} className="p-1.5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}>
                <Menu size={16} />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center w-full gap-3">
              <button onClick={onToggle} className="p-1.5 transition-colors mt-1"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}>
                <Menu size={16} />
              </button>
            </div>
          )}
        </div>

        {isOpen && (
          <>
            {/* Projects */}
            <div className="px-3 pt-4 pb-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>PROJECTS</span>
                <button onClick={onNewProject}
                  className="flex items-center gap-1 text-xs px-2 py-1 transition-colors"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}>
                  <Plus size={11} /> NEW
                </button>
              </div>

              <div className="space-y-0.5 pb-2">
                {projects.length === 0 ? (
                  <p className="text-xs px-1 py-2" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>No projects yet</p>
                ) : (
                  projects.map((proj) => {
                    const isActive = currentProject?.id === proj.id
                    return (
                      <div key={proj.id}
                        className="group flex items-center gap-2 px-2 py-2 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isActive ? 'var(--card)' : 'transparent',
                          borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                        }}
                        onClick={() => setCurrentProject(proj)}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--card)' }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}
                      >
                        <ChevronRight size={10} style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)', flexShrink: 0 }} />
                        <span className="flex-1 text-xs truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {proj.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
                            {proj.fileCount}
                          </span>
                          {projects.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteProject(proj.id) }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: 'var(--text-secondary)' }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#f87171')}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}>
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-3 space-y-0.5">
              <span className="label-mono px-1 block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>WORKSPACE</span>
              {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
                const isActive = activeTab === id
                return (
                  <button key={id}
                    onClick={() => { setActiveTab(id); onClose() }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors"
                    style={{
                      backgroundColor: isActive ? 'var(--card)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--card)' } }}
                    onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' } }}
                  >
                    <Icon size={15} style={{ flexShrink: 0 }} />
                    <span className="text-xs font-medium uppercase tracking-wide" style={{ letterSpacing: '0.06em' }}>{label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Bottom */}
            <div className="px-3 pb-3 pt-2 flex-shrink-0 space-y-0.5" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { setActiveTab('settings'); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors"
                style={{
                  backgroundColor: activeTab === 'settings' ? 'var(--card)' : 'transparent',
                  borderLeft: activeTab === 'settings' ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => { if (activeTab !== 'settings') (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--card)' }}
                onMouseLeave={(e) => { if (activeTab !== 'settings') (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
              >
                <Settings size={15} style={{ flexShrink: 0 }} />
                <span className="text-xs font-medium uppercase tracking-wide" style={{ letterSpacing: '0.06em' }}>Settings</span>
              </button>

              <div className="flex items-center justify-between px-2 pt-1">
                <button
                  onClick={() => { localStorage.removeItem('token'); window.location.href = '/login' }}
                  className="flex items-center gap-2 px-2 py-2 transition-colors text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}>
                  <LogOut size={13} />
                  <span className="uppercase tracking-wide" style={{ letterSpacing: '0.06em' }}>Sign out</span>
                </button>
                <ThemeToggle />
              </div>
            </div>
          </>
        )}

        {/* Collapsed: icon-only nav */}
        {!isOpen && (
          <div className="hidden lg:flex flex-col items-center gap-4 py-4 mt-2">
            {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
              <button key={id} title={label}
                onClick={() => { setActiveTab(id); }}
                className="p-2.5 transition-colors"
                style={{ color: activeTab === id ? 'var(--accent)' : 'var(--text-secondary)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = activeTab === id ? 'var(--accent)' : 'var(--text-secondary)')}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}

// ─── Files Tab ─────────────────────────────────────────────
const FILTER_TYPES = [
  'all', 'drawing', 'floor_plan', 'site_plan', 'specification',
  'contract', 'rfi', 'submittal', 'change_order', 'schedule',
  'budget', 'report', 'minutes', 'punch_list',
]

function FilesTab({ files, onUpload, onDelete, isUploading }: {
  files: UploadedFile[]
  onUpload: (f: FileList) => void
  onDelete: (id: string) => void
  isUploading: boolean
}) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = files.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || f.type === filterType
    return matchSearch && matchType
  })

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// PROJECT FILES</p>
          <h1 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            {files.length > 0 ? `${files.length} Files` : 'No Files Yet'}
          </h1>
        </div>
        <button onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="btn-primary flex items-center gap-2 flex-shrink-0">
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {isUploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileInputRef} type="file" multiple
          accept=".pdf,.docx,.xlsx,.doc,.xls,.png,.jpg,.jpeg,.dwg,.dxf,.csv"
          className="hidden"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
        />
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…" className="input pl-9" />
        </div>
        <div className="relative sm:w-48">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="input pl-9 appearance-none cursor-pointer">
            {FILTER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? 'All Types' : (FILE_CATEGORIES[t]?.label ?? t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed p-8 text-center cursor-pointer transition-all"
        style={{
          borderColor: isDragging ? 'var(--accent)' : 'var(--border)',
          backgroundColor: isDragging ? 'var(--glow)' : 'transparent',
        }}
      >
        <Upload size={28} className="mx-auto mb-3" style={{ color: isDragging ? 'var(--accent)' : 'var(--text-secondary)' }} />
        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
          Drag files here or <span style={{ color: 'var(--accent)' }}>browse</span>
        </p>
        <p className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>
          PDF · DOCX · XLSX · PNG · JPG · DWG · CSV
        </p>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          Drawings, specs, contracts, RFIs, schedules, budgets, photos — anything
        </p>
      </div>

      {/* File list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12" style={{ border: '1px solid var(--border)' }}>
          <FileSearch size={32} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {files.length === 0 ? 'Upload your first file to get started' : 'No files match your search'}
          </p>
        </div>
      ) : (
        <div className="border" style={{ borderColor: 'var(--border)' }}>
          {/* List header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 border-b"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>NAME</span>
            <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>TYPE</span>
            <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>SIZE</span>
            <span className="label-mono" style={{ fontFamily: 'var(--font-mono)' }}>DATE</span>
          </div>
          {filtered.map((file) => {
            const cat = getCategoryConfig(file.type)
            const CatIcon = cat.icon
            return (
              <div key={file.id}
                className="group grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CatIcon size={14} style={{ color: cat.color, flexShrink: 0 }} />
                  <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                </div>
                <span className="text-xs px-1.5 py-0.5"
                  style={{ backgroundColor: cat.color + '18', color: cat.color, fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  {cat.label.toUpperCase()}
                </span>
                <span className="label-mono whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)' }}>{file.size}</span>
                <div className="flex items-center gap-3">
                  <span className="label-mono whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)' }}>{file.uploadedAt}</span>
                  <button onClick={() => onDelete(file.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#f87171')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Chat Tab ─────────────────────────────────────────────
const QUICK_PROMPTS = [
  'What are the key contract milestones and deadlines?',
  'List all submittals required and their status',
  'Summarize all open RFIs by trade',
  'Find conflicts between drawings and specifications',
  'What are the liquidated damages provisions?',
  'Summarize the schedule of values',
]

function ChatTab({ files, currentProject, messages, isLoading, onSendMessage }: {
  files: UploadedFile[]
  currentProject: Project | null
  messages: Message[]
  isLoading: boolean
  onSendMessage: (msg: string) => Promise<void>
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const msg = input
    setInput('')
    await onSendMessage(msg)
  }

  const hasFiles = files.length > 0
  const placeholder = !currentProject
    ? 'Select a project first…'
    : !hasFiles
      ? 'Upload files to this project first…'
      : 'Ask anything about your project files…'

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// AI ASSISTANT</p>
        <h1 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-display)' }}>
          Ask Foreperson
        </h1>
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && hasFiles && (
        <div className="flex flex-wrap gap-2 mb-4 flex-shrink-0">
          {QUICK_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => setInput(p)}
              className="text-xs px-3 py-1.5 transition-colors"
              style={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                letterSpacing: '0.03em',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}>
              {p}
            </button>
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
                  style={{ backgroundColor: 'var(--accent)', flexShrink: 0 }}>
                  <span style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-mono)', fontSize: '0.55rem', fontWeight: 700 }}>FP</span>
                </div>
                <div className="flex-1 text-sm leading-relaxed"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                  <ReactMarkdown components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    code: ({ children }) => <code className="px-1.5 py-0.5 text-sm" style={{ backgroundColor: 'var(--surface)', fontFamily: 'var(--font-mono)' }}>{children}</code>,
                    h2: ({ children }) => <h2 className="font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="font-bold mb-1 mt-2 first:mt-0">{children}</h3>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 pl-3 my-2 italic" style={{ borderColor: 'var(--accent)' }}>{children}</blockquote>,
                  }}>
                    {msg.content}
                  </ReactMarkdown>
                  <p className="text-xs mt-2 opacity-50">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 justify-end max-w-4xl ml-auto">
                <div className="text-sm max-w-lg"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-dark)', padding: '0.75rem 1rem' }}>
                  <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                  <p className="text-xs mt-2 opacity-50">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <span style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-mono)', fontSize: '0.55rem', fontWeight: 700 }}>FP</span>
            </div>
            <div className="flex items-center px-4 py-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2 flex-shrink-0">
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={placeholder}
          disabled={!hasFiles || !currentProject || isLoading}
          className="input flex-1" />
        <button onClick={handleSend}
          disabled={!input.trim() || isLoading || !hasFiles || !currentProject}
          className="btn-primary p-3">
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Conflicts Tab ──────────────────────────────────────────
function ConflictsTab({ files, currentProject }: { files: UploadedFile[]; currentProject: Project | null }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const analyzeConflicts = async () => {
    if (!currentProject || files.length < 2) { setError('Upload at least 2 files for conflict analysis'); return }
    setIsAnalyzing(true); setError(null)
    try {
      const data = await api.chat.conflicts(parseInt(currentProject.id))
      setConflicts(data.conflicts ?? [])
    } catch (err: any) {
      setError(err.message || 'Conflict analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const severityStyle: Record<string, { bg: string; text: string; border: string }> = {
    high:   { bg: 'rgba(248,113,113,0.07)', text: '#f87171', border: 'rgba(248,113,113,0.2)' },
    medium: { bg: 'rgba(245,200,0,0.07)',   text: 'var(--accent)', border: 'rgba(245,200,0,0.2)' },
    low:    { bg: 'rgba(96,165,250,0.07)',   text: '#60a5fa', border: 'rgba(96,165,250,0.2)' },
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// CONFLICT DETECTION</p>
          <h1 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-display)' }}>Conflicts</h1>
        </div>
        <button onClick={analyzeConflicts}
          disabled={isAnalyzing || files.length < 2}
          className="btn-primary flex items-center gap-2 flex-shrink-0">
          {isAnalyzing ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</> : <><AlertTriangle size={14} /> Analyze</>}
        </button>
      </div>

      {error && (
        <div className="text-xs px-3 py-2" style={{ color: '#f87171', backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)' }}>
          {error}
        </div>
      )}

      {files.length < 2 ? (
        <div className="text-center py-16" style={{ border: '1px solid var(--border)' }}>
          <FileSearch size={32} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Upload at least 2 files to detect conflicts</p>
        </div>
      ) : conflicts.length === 0 && !isAnalyzing ? (
        <div className="text-center py-16" style={{ border: '1px solid var(--border)' }}>
          <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Click Analyze to scan for conflicts between your files</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((c) => {
            const s = severityStyle[c.severity] ?? severityStyle.medium
            return (
              <div key={c.id} className="p-5" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
                  <span className="text-xs px-2 py-0.5 flex-shrink-0"
                    style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}`, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                    {c.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>
                <div className="flex flex-wrap gap-2">
                  {c.documents.map((doc: string, i: number) => (
                    <span key={i} className="text-xs px-2 py-0.5"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
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
  const [doc1, setDoc1] = useState('')
  const [doc2, setDoc2] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [isComparing, setIsComparing] = useState(false)

  const handleCompare = async () => {
    if (!doc1 || !doc2) return
    setIsComparing(true)
    await new Promise((r) => setTimeout(r, 1800))
    const f1 = files.find((f) => f.id === doc1)?.name ?? 'File 1'
    const f2 = files.find((f) => f.id === doc2)?.name ?? 'File 2'
    setResult(`## ${f1} vs ${f2}\n\n### Key Differences\n- Scope items differ between the two documents\n- Timeline specifications vary\n- Payment terms are defined differently\n\n### Similarities\n- Both reference the same project specifications\n- Same contractor information\n- Identical insurance requirements`)
    setIsComparing(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// DOCUMENT COMPARE</p>
        <h1 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-display)' }}>Compare</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {[
          { value: doc1, other: doc2, setter: setDoc1, label: 'First File' },
          { value: doc2, other: doc1, setter: setDoc2, label: 'Second File' },
        ].map(({ value, other, setter, label }) => (
          <div key={label}>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>{label}</label>
            <select value={value} onChange={(e) => setter(e.target.value)} className="input appearance-none">
              <option value="">Select a file…</option>
              {files.filter((f) => f.id !== other).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button onClick={handleCompare} disabled={!doc1 || !doc2 || isComparing} className="btn-primary flex items-center gap-2">
        {isComparing ? <><Loader2 size={14} className="animate-spin" /> Comparing…</> : <><GitCompare size={14} /> Compare Files</>}
      </button>

      {result ? (
        <div className="p-5 text-sm leading-relaxed" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      ) : files.length < 2 ? (
        <div className="text-center py-16" style={{ border: '1px solid var(--border)' }}>
          <GitCompare size={32} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Upload at least 2 files to compare them</p>
        </div>
      ) : null}
    </div>
  )
}

// ─── Settings Tab ───────────────────────────────────────────
function SettingsTab() {
  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <p className="label-mono mb-1" style={{ fontFamily: 'var(--font-mono)' }}>// ACCOUNT</p>
        <h1 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>
      </div>

      <div className="p-5 space-y-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ letterSpacing: '0.08em' }}>Profile</h2>
        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>Name</label>
          <input type="text" className="input" placeholder="Your name" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>Email</label>
          <input type="email" className="input" placeholder="you@company.com" />
        </div>
        <button className="btn-primary text-xs px-4 py-2">Save changes</button>
      </div>

      <div className="p-5" style={{ backgroundColor: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.2)' }}>
        <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#f87171', letterSpacing: '0.08em' }}>Danger Zone</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Permanently delete your account and all project data.</p>
        <button className="text-xs px-4 py-2 transition-colors" style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
          Delete Account
        </button>
      </div>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('activeTab') ?? 'files') : 'files'
  )
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showDeleteProject, setShowDeleteProject] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState<Record<string, boolean>>({})

  // Load projects on mount
  useEffect(() => { loadProjects() }, [])

  // Load files when project changes
  useEffect(() => {
    if (currentProject) {
      loadFiles()
      setChatHistoryLoaded((prev) => ({ ...prev, [currentProject.id]: false }))
    } else {
      setFiles([])
      setChatMessages([])
    }
  }, [currentProject])

  // Load chat when switching to chat tab
  useEffect(() => {
    if (activeTab === 'chat' && currentProject && !chatHistoryLoaded[currentProject.id]) {
      loadChatHistory()
    }
  }, [activeTab, currentProject])

  const loadProjects = async () => {
    try {
      const data = await api.projects.list()
      const list = data.map((p: any) => ({ id: p.id.toString(), name: p.name, fileCount: p.document_count ?? 0 }))
      setProjects(list)
      if (list.length > 0) {
        setCurrentProject(list[0])
      } else {
        // Auto-create default project, but don't crash on failure
        try { await handleAddProject('My First Project') } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  }

  const loadFiles = async () => {
    if (!currentProject) return
    try {
      const data = await api.documents.list(parseInt(currentProject.id))
      setFiles(data.map((d: any) => ({
        id: d.id.toString(),
        name: d.original_filename,
        type: d.document_type ?? 'unknown',
        size: formatFileSize(d.file_size ?? 0),
        uploadedAt: d.created_at?.split('T')[0] ?? '—',
      })))
    } catch (err) {
      console.error('Failed to load files:', err)
    }
  }

  const loadChatHistory = async () => {
    if (!currentProject) return
    try {
      const data = await api.chat.history(parseInt(currentProject.id))
      const msgs = (data as any).messages
      if (msgs?.length > 0) {
        setChatMessages(msgs.map((m: any) => ({
          id: m.id.toString(), role: m.role, content: m.content, timestamp: new Date(m.created_at)
        })))
      } else {
        setChatMessages([{
          id: '0', role: 'assistant',
          content: 'Hello! I\'m Foreperson — your construction AI. Upload drawings, specs, contracts, RFIs, schedules, or any project file, then ask me anything about your project.',
          timestamp: new Date(),
        }])
      }
      setChatHistoryLoaded((prev) => ({ ...prev, [currentProject.id]: true }))
    } catch {
      setChatMessages([{
        id: '0', role: 'assistant',
        content: 'Hello! I\'m Foreperson — your construction AI. Upload your project files and ask me anything.',
        timestamp: new Date(),
      }])
    }
  }

  // Project actions — throws on failure so modal can show error
  const handleAddProject = async (name: string, description?: string) => {
    const newProj = await api.projects.create(name, description)
    const proj = { id: newProj.id.toString(), name: newProj.name, fileCount: 0 }
    setProjects((prev) => [...prev, proj])
    setCurrentProject(proj)
  }

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) {
      alert('Cannot delete the last project. Create another first.')
      return
    }
    setProjectToDelete(projects.find((p) => p.id === id) ?? null)
    setShowDeleteProject(true)
  }

  const confirmDelete = async () => {
    if (!projectToDelete) return
    await api.projects.delete(parseInt(projectToDelete.id))
    const remaining = projects.filter((p) => p.id !== projectToDelete.id)
    setProjects(remaining)
    if (currentProject?.id === projectToDelete.id) setCurrentProject(remaining[0] ?? null)
    setShowDeleteProject(false)
    setProjectToDelete(null)
  }

  const handleUpload = async (fileList: FileList) => {
    if (!currentProject) return
    setIsUploading(true)
    for (const file of Array.from(fileList)) {
      try {
        const doc = await api.documents.upload(parseInt(currentProject.id), file)
        setFiles((prev) => [{
          id: doc.id.toString(), name: doc.original_filename,
          type: doc.document_type ?? 'unknown',
          size: formatFileSize(doc.file_size ?? 0),
          uploadedAt: new Date().toISOString().split('T')[0],
        }, ...prev])
        setProjects((prev) => prev.map((p) =>
          p.id === currentProject.id ? { ...p, fileCount: p.fileCount + 1 } : p
        ))
      } catch (err) {
        console.error('Upload failed:', err)
      }
    }
    setIsUploading(false)
  }

  const handleDeleteFile = async (id: string) => {
    if (!currentProject) return
    try {
      await api.documents.delete(parseInt(currentProject.id), parseInt(id))
      setFiles((prev) => prev.filter((f) => f.id !== id))
      setProjects((prev) => prev.map((p) =>
        p.id === currentProject.id ? { ...p, fileCount: Math.max(0, p.fileCount - 1) } : p
      ))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleSendMessage = async (msg: string) => {
    if (!currentProject) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() }
    setChatMessages((prev) => [...prev, userMsg])
    setIsChatLoading(true)
    try {
      const data = await api.chat.send(parseInt(currentProject.id), msg)
      setChatMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: data.response ?? 'No response received.',
        timestamp: new Date(),
      }])
      setChatHistoryLoaded((prev) => ({ ...prev, [currentProject.id]: true }))
    } catch {
      setChatMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'An error occurred. Please try again.', timestamp: new Date(),
      }])
    } finally {
      setIsChatLoading(false)
    }
  }

  const changeTab = (tab: string) => {
    setActiveTab(tab)
    localStorage.setItem('activeTab', tab)
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'files':
        return <FilesTab files={files} onUpload={handleUpload} onDelete={handleDeleteFile} isUploading={isUploading} />
      case 'chat':
        return <ChatTab files={files} currentProject={currentProject} messages={chatMessages} isLoading={isChatLoading} onSendMessage={handleSendMessage} />
      case 'conflicts':
        return <ConflictsTab files={files} currentProject={currentProject} />
      case 'compare':
        return <CompareTab files={files} />
      case 'settings':
        return <SettingsTab />
      default:
        return <FilesTab files={files} onUpload={handleUpload} onDelete={handleDeleteFile} isUploading={isUploading} />
    }
  }

  const TAB_LABELS: Record<string, string> = {
    files: 'Files', chat: 'AI Chat', conflicts: 'Conflicts', compare: 'Compare', settings: 'Settings'
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Modals */}
      <NewProjectModal isOpen={showNewProject} onClose={() => setShowNewProject(false)} onAdd={handleAddProject} />
      <DeleteProjectModal
        isOpen={showDeleteProject}
        onClose={() => { setShowDeleteProject(false); setProjectToDelete(null) }}
        onConfirm={confirmDelete}
        projectName={projectToDelete?.name ?? ''}
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activeTab={activeTab}
        setActiveTab={changeTab}
        projects={projects}
        currentProject={currentProject}
        setCurrentProject={setCurrentProject}
        onNewProject={() => setShowNewProject(true)}
        onDeleteProject={handleDeleteProject}
      />

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
        {/* Top bar */}
        <div className="flex items-center gap-0 flex-shrink-0"
          style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', height: '3.5rem' }}>

          {/* Mobile hamburger */}
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-4 transition-colors"
            style={{ color: 'var(--text-secondary)' }}>
            <Menu size={16} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 px-4 border-r" style={{ borderColor: 'var(--border)', height: '100%' }}>
            <span className="label-mono whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)' }}>
              {currentProject?.name ?? 'No project'}
            </span>
          </div>

          {/* Tab nav */}
          <div className="flex items-center h-full overflow-x-auto">
            {['files', 'chat', 'conflicts', 'compare'].map((tab) => {
              const isActive = activeTab === tab
              return (
                <button key={tab} onClick={() => changeTab(tab)}
                  className="h-full px-5 text-xs font-medium uppercase tracking-wider relative transition-colors flex-shrink-0"
                  style={{
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    letterSpacing: '0.07em',
                    fontFamily: 'var(--font-mono)',
                    background: 'none',
                    border: 'none',
                  }}>
                  {TAB_LABELS[tab]}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: 'var(--accent)' }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}
