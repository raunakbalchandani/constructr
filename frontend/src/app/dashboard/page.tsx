'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Building2, 
  FileText, 
  MessageSquare, 
  Upload, 
  Search,
  Settings,
  LogOut,
  Plus,
  Send,
  Paperclip,
  FileSearch,
  AlertTriangle,
  GitCompare,
  Trash2,
  Download,
  Filter,
  ChevronDown,
  Loader2,
  X,
  Menu,
  Home,
  FolderOpen
} from 'lucide-react'

// Types
interface Document {
  id: string
  name: string
  type: string
  uploadedAt: string
  size: string
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
  documents: number
}

// Sidebar
function Sidebar({ 
  isOpen, 
  onClose,
  activeTab,
  setActiveTab,
  projects,
  currentProject,
  setCurrentProject
}: {
  isOpen: boolean
  onClose: () => void
  activeTab: string
  setActiveTab: (tab: string) => void
  projects: Project[]
  currentProject: Project | null
  setCurrentProject: (project: Project) => void
}) {
  const navItems = [
    { id: 'documents', icon: FileText, label: 'Documents' },
    { id: 'chat', icon: MessageSquare, label: 'AI Chat' },
    { id: 'conflicts', icon: AlertTriangle, label: 'Conflicts' },
    { id: 'compare', icon: GitCompare, label: 'Compare' },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-dark-800 border-r border-dark-700
        transform transition-transform duration-200
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-dark-700">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-secondary rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">Foreperson</span>
            </div>
            <button onClick={onClose} className="lg:hidden text-dark-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Project Selector */}
          <div className="p-4 border-b border-dark-700">
            <label className="text-xs text-dark-400 uppercase tracking-wide mb-2 block">Project</label>
            <div className="relative">
              <select 
                value={currentProject?.id || ''}
                onChange={(e) => {
                  const proj = projects.find(p => p.id === e.target.value)
                  if (proj) setCurrentProject(proj)
                }}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white appearance-none cursor-pointer focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
                {projects.map(proj => (
                  <option key={proj.id} value={proj.id}>{proj.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); onClose() }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === item.id 
                    ? 'bg-brand-600 text-white' 
                    : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-dark-700 space-y-1">
            <button 
              onClick={() => { setActiveTab('settings'); onClose() }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-brand-600 text-white'
                  : 'text-dark-300 hover:bg-dark-700 hover:text-white'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('token')
                window.location.href = '/login'
              }}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-dark-300 hover:bg-dark-700 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

// Documents Tab
function DocumentsTab({ documents, onUpload, onDelete }: { 
  documents: Document[]
  onUpload: (files: FileList) => void
  onDelete: (id: string) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'all' || doc.type === filterType
    return matchesSearch && matchesType
  })

  const documentTypes = ['all', 'contract', 'specification', 'rfi', 'submittal', 'drawing']

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) {
      onUpload(e.dataTransfer.files)
    }
  }

  const typeColors: Record<string, string> = {
    contract: 'bg-green-500/20 text-green-400',
    specification: 'bg-orange-500/20 text-orange-400',
    rfi: 'bg-red-500/20 text-red-400',
    submittal: 'bg-blue-500/20 text-blue-400',
    drawing: 'bg-purple-500/20 text-purple-400',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-dark-400">{documents.length} files uploaded</p>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Upload</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.doc,.xls"
          className="hidden"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
        />
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="input pl-10"
          />
        </div>
        <div className="relative">
          <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input pl-10 pr-10 appearance-none cursor-pointer"
          >
            {documentTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging 
            ? 'border-brand-500 bg-brand-500/10' 
            : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/50'
        }`}
      >
        <Upload className="w-12 h-12 text-dark-400 mx-auto mb-4" />
        <p className="text-dark-300 mb-2">
          Drag and drop files here, or <span className="text-brand-400">browse</span>
        </p>
        <p className="text-sm text-dark-500">Supports PDF, DOCX, XLSX</p>
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 text-dark-500 mx-auto mb-4" />
          <p className="text-dark-400">No documents found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map(doc => (
            <div key={doc.id} className="card-hover flex items-center justify-between p-4">
              <div className="flex items-center space-x-4 min-w-0">
                <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-dark-300" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <div className="flex items-center space-x-3 text-sm text-dark-400">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${typeColors[doc.type] || 'bg-dark-600 text-dark-300'}`}>
                      {doc.type}
                    </span>
                    <span>{doc.size}</span>
                    <span>{doc.uploadedAt}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                <button className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors">
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDelete(doc.id)}
                  className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Chat Tab
function ChatTab({ documents }: { documents: Document[] }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your construction document assistant. Upload some documents and ask me anything about them. I can help you find information, detect conflicts, and summarize content.',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: input })
      })

      const data = await res.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an error processing your request.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const quickActions = [
    'Summarize all documents',
    'Find any conflicts',
    'What are the payment terms?',
    'List all deadlines'
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">AI Chat Assistant</h1>
        <p className="text-dark-400">Ask questions about your documents</p>
      </div>

      {/* Quick Actions */}
      {messages.length === 1 && documents.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => setInput(action)}
              className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-full text-sm text-dark-300 hover:border-brand-500 hover:text-white transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl ${
              message.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-md'
                : 'bg-dark-700 text-white rounded-bl-md'
            }`}>
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs mt-2 opacity-60">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-dark-700 text-white p-4 rounded-2xl rounded-bl-md">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex items-center space-x-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={documents.length ? "Ask about your documents..." : "Upload documents first to start chatting..."}
            disabled={!documents.length}
            className="input pr-12"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || !documents.length}
          className="btn-primary p-3"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// Conflicts Tab
function ConflictsTab({ documents }: { documents: Document[] }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [conflicts, setConflicts] = useState<any[]>([])

  const analyzeConflicts = async () => {
    setIsAnalyzing(true)
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 2000))
    setConflicts([
      {
        id: '1',
        severity: 'high',
        title: 'Payment Terms Mismatch',
        description: 'Contract states Net 30 payment terms, but the purchase order specifies Net 15.',
        documents: ['General Contract.pdf', 'Purchase Order 001.pdf']
      },
      {
        id: '2',
        severity: 'medium',
        title: 'Material Specification Conflict',
        description: 'Drawing D-101 specifies steel grade A36, but the specification document requires A572.',
        documents: ['Drawing D-101.pdf', 'Structural Specs.pdf']
      }
    ])
    setIsAnalyzing(false)
  }

  const severityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Conflict Detection</h1>
          <p className="text-dark-400">AI-powered analysis of document discrepancies</p>
        </div>
        <button 
          onClick={analyzeConflicts}
          disabled={isAnalyzing || documents.length < 2}
          className="btn-primary flex items-center space-x-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5" />
              <span>Analyze Documents</span>
            </>
          )}
        </button>
      </div>

      {documents.length < 2 ? (
        <div className="card text-center py-12">
          <FileSearch className="w-12 h-12 text-dark-500 mx-auto mb-4" />
          <p className="text-dark-400 mb-2">Upload at least 2 documents to detect conflicts</p>
          <p className="text-sm text-dark-500">The AI will compare your documents and find discrepancies</p>
        </div>
      ) : conflicts.length === 0 ? (
        <div className="card text-center py-12">
          <AlertTriangle className="w-12 h-12 text-dark-500 mx-auto mb-4" />
          <p className="text-dark-400 mb-2">No conflicts analyzed yet</p>
          <p className="text-sm text-dark-500">Click "Analyze Documents" to start</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conflicts.map(conflict => (
            <div key={conflict.id} className={`card border ${severityColors[conflict.severity as keyof typeof severityColors]}`}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">{conflict.title}</h3>
                <span className={`px-2 py-1 rounded text-xs uppercase font-medium ${severityColors[conflict.severity as keyof typeof severityColors]}`}>
                  {conflict.severity}
                </span>
              </div>
              <p className="text-dark-300 mb-4">{conflict.description}</p>
              <div className="flex flex-wrap gap-2">
                {conflict.documents.map((doc: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-dark-700 rounded text-sm text-dark-300">
                    {doc}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Compare Tab
function CompareTab({ documents }: { documents: Document[] }) {
  const [doc1, setDoc1] = useState('')
  const [doc2, setDoc2] = useState('')
  const [comparison, setComparison] = useState<string | null>(null)
  const [isComparing, setIsComparing] = useState(false)

  const handleCompare = async () => {
    if (!doc1 || !doc2) return
    setIsComparing(true)
    // Simulate comparison
    await new Promise(resolve => setTimeout(resolve, 2000))
    setComparison(`## Comparison: ${documents.find(d => d.id === doc1)?.name} vs ${documents.find(d => d.id === doc2)?.name}

### Key Differences:
1. **Scope of Work**: Document 1 includes exterior landscaping, Document 2 does not.
2. **Timeline**: Document 1 specifies 180 days, Document 2 specifies 150 days.
3. **Payment Schedule**: Different milestone breakdowns.

### Similarities:
- Both reference the same project specifications
- Same contractor information
- Identical insurance requirements`)
    setIsComparing(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Document Comparison</h1>
        <p className="text-dark-400">Compare any two documents side by side</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="input-label">First Document</label>
          <select
            value={doc1}
            onChange={(e) => setDoc1(e.target.value)}
            className="input"
          >
            <option value="">Select a document...</option>
            {documents.filter(d => d.id !== doc2).map(doc => (
              <option key={doc.id} value={doc.id}>{doc.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Second Document</label>
          <select
            value={doc2}
            onChange={(e) => setDoc2(e.target.value)}
            className="input"
          >
            <option value="">Select a document...</option>
            {documents.filter(d => d.id !== doc1).map(doc => (
              <option key={doc.id} value={doc.id}>{doc.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleCompare}
        disabled={!doc1 || !doc2 || isComparing}
        className="btn-primary flex items-center space-x-2"
      >
        {isComparing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Comparing...</span>
          </>
        ) : (
          <>
            <GitCompare className="w-5 h-5" />
            <span>Compare Documents</span>
          </>
        )}
      </button>

      {comparison && (
        <div className="card">
          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-dark-200 font-sans">{comparison}</pre>
          </div>
        </div>
      )}

      {!comparison && documents.length < 2 && (
        <div className="card text-center py-12">
          <GitCompare className="w-12 h-12 text-dark-500 mx-auto mb-4" />
          <p className="text-dark-400">Upload at least 2 documents to compare them</p>
        </div>
      )}
    </div>
  )
}

// Settings Tab
function SettingsTab() {
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/auth/api-key', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ openai_api_key: apiKey })
      })
      
      if (res.ok) {
        setSaveMessage('✓ API key saved successfully!')
        setApiKey('')
      } else {
        setSaveMessage('Failed to save API key')
      }
    } catch (error) {
      setSaveMessage('Error saving API key')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-dark-400">Manage your account and preferences</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="input-label">Name</label>
            <input type="text" className="input" placeholder="Your name" />
          </div>
          <div>
            <label className="input-label">Email</label>
            <input type="email" className="input" placeholder="you@company.com" />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">API Key</h2>
        <p className="text-dark-400 text-sm mb-4">Add your OpenAI API key to enable AI features</p>
        <div className="space-y-4">
          <div>
            <label className="input-label">OpenAI API Key</label>
            <input 
              type="password" 
              className="input" 
              placeholder="sk-..." 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleSaveApiKey}
              disabled={isSaving || !apiKey.trim()}
              className="btn-primary flex items-center space-x-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Save API Key</span>
              )}
            </button>
            {saveMessage && (
              <span className={saveMessage.includes('✓') ? 'text-green-400' : 'text-red-400'}>
                {saveMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card border-red-500/30">
        <h2 className="text-lg font-semibold mb-4 text-red-400">Danger Zone</h2>
        <p className="text-dark-400 text-sm mb-4">Permanently delete your account and all data</p>
        <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  )
}

// Main Dashboard
export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('documents')
  const [projects, setProjects] = useState<Project[]>([
    { id: '1', name: 'My Project', documents: 0 },
  ])
  const [currentProject, setCurrentProject] = useState<Project>(projects[0])
  const [documents, setDocuments] = useState<Document[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Load documents on mount
  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/projects/1/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.map((d: any) => ({
          id: d.id.toString(),
          name: d.original_filename,
          type: d.document_type || 'unknown',
          uploadedAt: d.created_at?.split('T')[0] || 'Unknown',
          size: formatFileSize(d.file_size || 0)
        })))
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const handleUpload = async (files: FileList) => {
    const token = localStorage.getItem('token')
    setIsUploading(true)
    
    // First ensure project exists
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'My Project' })
      })
    } catch (e) {
      // Project might already exist
    }

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      
      try {
        const res = await fetch('/api/projects/1/documents', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        })
        
        if (res.ok) {
          const doc = await res.json()
          setDocuments(prev => [{
            id: doc.id.toString(),
            name: doc.original_filename,
            type: doc.document_type || 'unknown',
            uploadedAt: new Date().toISOString().split('T')[0],
            size: formatFileSize(doc.file_size || 0)
          }, ...prev])
        }
      } catch (error) {
        console.error('Upload failed:', error)
      }
    }
    setIsUploading(false)
  }

  const handleDelete = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  const detectDocumentType = (filename: string): string => {
    const lower = filename.toLowerCase()
    if (lower.includes('contract')) return 'contract'
    if (lower.includes('spec')) return 'specification'
    if (lower.includes('rfi')) return 'rfi'
    if (lower.includes('submittal')) return 'submittal'
    if (lower.includes('drawing') || lower.includes('dwg')) return 'drawing'
    return 'unknown'
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'documents':
        return <DocumentsTab documents={documents} onUpload={handleUpload} onDelete={handleDelete} />
      case 'chat':
        return <ChatTab documents={documents} />
      case 'conflicts':
        return <ConflictsTab documents={documents} />
      case 'compare':
        return <CompareTab documents={documents} />
      case 'settings':
        return <SettingsTab />
      default:
        return <DocumentsTab documents={documents} onUpload={handleUpload} onDelete={handleDelete} />
    }
  }

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        projects={projects}
        currentProject={currentProject}
        setCurrentProject={setCurrentProject}
      />

      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-dark-700 bg-dark-800">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-dark-300 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-br from-brand-500 to-accent-secondary rounded flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">Foreperson</span>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {renderTab()}
        </div>
      </main>
    </div>
  )
}
