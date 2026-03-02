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
  created_at: string
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
