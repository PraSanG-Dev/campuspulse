/**
 * Typed API client for the CampusPulse FastAPI backend.
 *
 * All calls automatically:
 *   - Inject the Supabase JWT from the active session
 *   - Throw `ApiError` with the backend `detail` string on non-2xx responses
 *   - Let the caller's catch block surface errors to the global NetworkErrorBoundary
 */

import { supabase } from '@/lib/supabase'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// ── Error type ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
  }
}

// ── Core fetch helper ─────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...init, headers })

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // non-JSON body, keep default message
    }
    throw new ApiError(res.status, detail)
  }

  return res.json() as Promise<T>
}

// ── Documents ─────────────────────────────────────────────────────────────────
export interface UploadDocumentResult {
  id: string
  file_name: string
  page_count: number
  chunk_count: number
  status: string
  message: string
}

export async function uploadDocument(file: File): Promise<UploadDocumentResult> {
  const form = new FormData()
  form.append('file', file)
  return apiFetch<UploadDocumentResult>('/api/documents', {
    method: 'POST',
    body: form,
  })
}

export async function deleteDocument(docId: string): Promise<{ status: string; id: string }> {
  return apiFetch(`/api/documents/${docId}`, { method: 'DELETE' })
}

// ── Notice Analyzer ───────────────────────────────────────────────────────────
export interface AnalyzedItem {
  id?: string
  kind: string
  text: string
  item_date: string | null
  page_number: number
  source_quote: string
  confidence: 'high' | 'medium' | 'low'
  status?: string
}

export interface AnalyzeNoticeResult {
  summary: string
  items: AnalyzedItem[]
}

export async function analyzeNotice(
  payload: { document_id?: string; text?: string },
): Promise<AnalyzeNoticeResult> {
  return apiFetch<AnalyzeNoticeResult>('/api/notices/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// ── AI Assistant ──────────────────────────────────────────────────────────────
export interface Citation {
  document_name: string
  page_number: number
  snippet: string
}

export interface AssistantAnswer {
  status: 'grounded' | 'not_found'
  answer: string
  citations: Citation[]
}

export async function askAssistant(
  question: string,
  documentIds?: string[],
): Promise<AssistantAnswer> {
  return apiFetch<AssistantAnswer>('/api/assistant/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_ids: documentIds ?? null }),
  })
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  answer_status?: string
  citations?: Citation[]
  created_at: string
}

export async function getAssistantHistory(): Promise<{ messages: ChatMessage[] }> {
  return apiFetch('/api/assistant/history')
}

export async function clearAssistantHistory(): Promise<{ status: string }> {
  return apiFetch('/api/assistant/history', { method: 'DELETE' })
}

export interface AssistantDocument {
  id: string
  file_name: string
  page_count: number
  status: string
}

export async function getAssistantDocuments(): Promise<{ documents: AssistantDocument[] }> {
  return apiFetch('/api/assistant/documents')
}
