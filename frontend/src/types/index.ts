// ─── Shared TypeScript types ──────────────────────────────────────────────────
// These mirror the database schema. We'll expand them as each phase adds tables.

export type AttendanceStatus = 'present' | 'absent' | 'cancelled'

export type DocumentStatus = 'processing' | 'ready' | 'failed'

export type ExtractedItemStatus = 'pending' | 'confirmed' | 'rejected'

export type ExtractedItemKind = 'deadline' | 'eligibility' | 'document_required' | 'next_step'

export type Confidence = 'high' | 'low'

// ── Database row shapes (returned from Supabase) ──────────────────────────────

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  attendance_target: number   // default 75
  created_at: string
}

export interface Subject {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface AttendanceRecord {
  id: string
  subject_id: string
  class_date: string          // ISO date string
  status: AttendanceStatus
  created_at: string
}

export interface TimetableSlot {
  id: string
  user_id: string
  day_of_week: number         // 0 = Monday … 6 = Sunday
  start_time: string          // 'HH:MM'
  end_time: string
  subject_name: string
  room: string | null
}

export interface Document {
  id: string
  user_id: string
  file_name: string
  file_path: string           // path inside Supabase storage bucket
  page_count: number
  status: DocumentStatus
  created_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  page_number: number
  content: string
}

export interface ExtractedItem {
  id: string
  document_id: string | null
  kind: ExtractedItemKind
  text: string
  item_date: string | null
  page_number: number | null
  source_quote: string | null
  confidence: Confidence
  status: ExtractedItemStatus
  created_at: string
}

export interface Reminder {
  id: string
  user_id: string
  title: string
  remind_at: string           // ISO datetime
  source_item_id: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[] | null
  answer_status: 'grounded' | 'not_found' | null
  created_at: string
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface Citation {
  document_name: string
  page_number: number
  snippet: string
}

export interface AssistantResponse {
  answer: string
  status: 'grounded' | 'not_found'
  citations: Citation[]
}
