/**
 * API service layer — all fetch calls go through here.
 * The Next.js proxy routes /api/* to FastAPI automatically.
 */

function getToken(): string | null {
  if (typeof window === 'undefined') return null
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
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail?: string }).detail ?? 'Request failed')
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
  parse_quality?: string
  created_at: string
}

export interface SearchResult {
  doc_id: number
  filename: string
  document_type: string
  snippet: string
  match_count: number
}

export const documents = {
  list: (projectId: number, page = 1, limit = 20) =>
    request<Document[]>(`/projects/${projectId}/documents?page=${page}&limit=${limit}`),
  upload: (projectId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const token = getToken()
    return fetch(`/api/projects/${projectId}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail ?? 'Upload failed')
      }
      return res.json() as Promise<Document>
    })
  },
  delete: (projectId: number, documentId: number) =>
    request<void>(`/projects/${projectId}/documents/${documentId}`, { method: 'DELETE' }),
  search: (projectId: number, q: string) =>
    request<{ results: SearchResult[] }>(`/projects/${projectId}/search?q=${encodeURIComponent(q)}`),
}

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

// Chat
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Conflict {
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  resolution: string
  documents: string[]
}

export interface CompareConflict {
  title: string
  doc_a: string
  doc_b: string
  impact: string
  recommendation: string
}

export interface CompareRisk {
  title: string
  description: string
}

export interface CompareResult {
  summary: string
  conflicts: CompareConflict[]
  gaps: string[]
  agreements: string[]
  risks: CompareRisk[]
  doc1_name: string
  doc2_name: string
}

export interface ChatThread {
  id: number
  title: string | null
  message_count: number
  created_at: string
}

export interface ChatHistory {
  id: number
  title: string | null
  messages: ChatMessage[]
  created_at: string
}

export const chat = {
  threads: (projectId: number) =>
    request<ChatThread[]>(`/projects/${projectId}/chats`),
  newThread: (projectId: number) =>
    request<ChatHistory>(`/projects/${projectId}/chats`, { method: 'POST' }),
  history: (projectId: number, chatId?: number) =>
    request<ChatHistory>(`/projects/${projectId}/chat${chatId ? `?chat_id=${chatId}` : ''}`),
  renameThread: (projectId: number, chatId: number, title: string) =>
    request<{ id: number; title: string }>(`/projects/${projectId}/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteThread: (projectId: number, chatId: number) =>
    request<void>(`/projects/${projectId}/chats/${chatId}`, { method: 'DELETE' }),
  send: (projectId: number, message: string, model?: string, chatId?: number, useMemory = true, referencedChatId?: number) =>
    request<{ response: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, message, model, chat_id: chatId ?? null, use_memory: useMemory, referenced_chat_id: referencedChatId ?? null }),
    }),
  conflicts: (projectId: number, docIds?: number[]) =>
    request<Conflict[]>(`/projects/${projectId}/conflicts`, {
      method: 'POST',
      body: JSON.stringify({ doc_ids: docIds ?? null }),
    }),
  compare: (projectId: number, docId1: number, docId2: number) =>
    request<CompareResult>(`/projects/${projectId}/compare`, {
      method: 'POST',
      body: JSON.stringify({ doc_id_1: docId1, doc_id_2: docId2 }),
    }),
}

export const conflictStatuses = {
  getAll: (projectId: number) =>
    request<Record<string, string>>(`/projects/${projectId}/conflict-statuses`),
  set: (projectId: number, conflictHash: string, status: 'open' | 'resolved' | 'dismissed') =>
    request<{ conflict_hash: string; status: string }>(
      `/projects/${projectId}/conflict-statuses/${conflictHash}`,
      { method: 'POST', body: JSON.stringify({ status }) }
    ),
}

// RFIs
export interface RFI {
  id: number
  number: number
  subject: string
  description: string
  status: string
  response?: string
  due_date?: string
  created_by?: string
  created_at: string
}

export const rfis = {
  list: (projectId: number, status?: string) =>
    request<RFI[]>(`/projects/${projectId}/rfis${status ? `?status=${status}` : ''}`),
  create: (projectId: number, subject: string, description: string, due_date?: string) =>
    request<RFI>(`/projects/${projectId}/rfis`, {
      method: 'POST',
      body: JSON.stringify({ subject, description, due_date }),
    }),
  update: (projectId: number, rfiId: number, data: Partial<Pick<RFI, 'subject' | 'description' | 'status' | 'response' | 'due_date'>>) =>
    request<RFI>(`/projects/${projectId}/rfis/${rfiId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (projectId: number, rfiId: number) =>
    request<void>(`/projects/${projectId}/rfis/${rfiId}`, { method: 'DELETE' }),
}

// Daily Reports
export interface DailyReport {
  id: number
  report_date: string
  work_performed: string
  weather?: string
  crew_count?: number
  issues?: string
  created_by?: string
  created_at: string
}

export const dailyReports = {
  list: (projectId: number) =>
    request<DailyReport[]>(`/projects/${projectId}/daily-reports`),
  create: (projectId: number, data: { report_date: string; work_performed: string; weather?: string; crew_count?: number; issues?: string }) =>
    request<DailyReport>(`/projects/${projectId}/daily-reports`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (projectId: number, reportId: number) =>
    request<void>(`/projects/${projectId}/daily-reports/${reportId}`, { method: 'DELETE' }),
}

// Action Items
export interface ActionItem {
  id: number
  description: string
  assigned_to?: string
  due_date?: string
  status: string
  created_by?: string
  created_at: string
}

export const actionItems = {
  list: (projectId: number, status?: string) =>
    request<ActionItem[]>(`/projects/${projectId}/action-items${status ? `?status=${status}` : ''}`),
  create: (projectId: number, description: string, assigned_to?: string, due_date?: string) =>
    request<ActionItem>(`/projects/${projectId}/action-items`, {
      method: 'POST',
      body: JSON.stringify({ description, assigned_to, due_date }),
    }),
  update: (projectId: number, itemId: number, data: Partial<Pick<ActionItem, 'description' | 'assigned_to' | 'due_date' | 'status'>>) =>
    request<ActionItem>(`/projects/${projectId}/action-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (projectId: number, itemId: number) =>
    request<void>(`/projects/${projectId}/action-items/${itemId}`, { method: 'DELETE' }),
}

export function previewUrl(projectId: number, documentId: number): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return `/api/projects/${projectId}/documents/${documentId}/preview?token=${encodeURIComponent(token ?? '')}`
}

// Team Members
export interface ProjectMember {
  id: number
  invited_email: string
  role: string
  status: string
  user_id?: number
  created_at: string
}

export const members = {
  list: (projectId: number) =>
    request<ProjectMember[]>(`/projects/${projectId}/members`),
  invite: (projectId: number, email: string, role: string) =>
    request<ProjectMember>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  updateRole: (projectId: number, memberId: number, role: string) =>
    request<ProjectMember>(`/projects/${projectId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  remove: (projectId: number, memberId: number) =>
    request<void>(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),
}

// Notifications
export interface AppNotification {
  id: number
  type: string
  message: string
  link_tab?: string
  read: boolean
  project_id?: number
  created_at: string
}

export const notifications = {
  list: (all = false) =>
    request<AppNotification[]>(`/notifications${all ? '?all=true' : ''}`),
  markRead: (id: number) =>
    request<void>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () =>
    request<void>('/notifications/read-all', { method: 'POST' }),
}

// Annotations
export interface Annotation {
  id: number
  type: string
  data: string
  user_name?: string
  created_at: string
}

export const annotations = {
  list: (projectId: number, docId: number) =>
    request<Annotation[]>(`/projects/${projectId}/documents/${docId}/annotations`),
  create: (projectId: number, docId: number, type: string, data: string) =>
    request<Annotation>(`/projects/${projectId}/documents/${docId}/annotations`, {
      method: 'POST',
      body: JSON.stringify({ type, data }),
    }),
  delete: (projectId: number, docId: number, annotationId: number) =>
    request<void>(`/projects/${projectId}/documents/${docId}/annotations/${annotationId}`, {
      method: 'DELETE',
    }),
}

// Export helpers
export function rfiExportUrl(projectId: number, format: 'pdf' | 'xlsx'): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return `/api/projects/${projectId}/rfis/export?format=${format}&token=${encodeURIComponent(token ?? '')}`
}

export function dailyReportExportUrl(projectId: number, format: 'pdf' | 'xlsx'): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return `/api/projects/${projectId}/daily-reports/export?format=${format}&token=${encodeURIComponent(token ?? '')}`
}

// Voice transcription
export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', blob, 'audio.webm')
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) throw new Error('Transcription failed')
  const data = await res.json()
  return data.transcript as string
}
