import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
  Sparkles,
  FileText,
  Trash2,
  AlertCircle,
  Quote,
  ShieldCheck,
  CheckCircle2,
  Filter,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/lib/AuthContext'
import { Citation } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface ChatItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  answer_status?: 'grounded' | 'not_found' | null
  citations?: Citation[] | null
  created_at?: string
}

interface DocOption {
  id: string
  file_name: string
  page_count: number
}

const SUGGESTED_PROMPTS = [
  'What is the last date to submit the exam registration form?',
  'What is the minimum attendance requirement?',
  'What documents do I need to bring for verification?',
  'What are the eligibility criteria for the semester exams?',
]

export default function Assistant() {
  const { session } = useAuth()
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [inputQuestion, setInputQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [docs, setDocs] = useState<DocOption[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>('all')
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Load uploaded documents for filtering
  const loadDocuments = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/assistant/documents`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDocs(data.documents || [])
      }
    } catch (err) {
      console.warn('Could not load documents for assistant:', err)
    }
  }, [session?.access_token])

  // Load chat history
  const loadHistory = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/assistant/history`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              answer_status: m.answer_status,
              citations: m.citations,
              created_at: m.created_at,
            }))
          )
        }
      }
    } catch (err) {
      console.warn('Could not load chat history:', err)
    }
  }, [session?.access_token])

  useEffect(() => {
    loadDocuments()
    loadHistory()
  }, [loadDocuments, loadHistory])

  // Clear chat history
  async function handleClearHistory() {
    if (!confirm('Clear all conversation history?')) return
    if (!session?.access_token) {
      setMessages([])
      return
    }

    try {
      await fetch(`${API_BASE_URL}/api/assistant/history`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      setMessages([])
    } catch (err) {
      console.warn('Could not clear history:', err)
      setMessages([])
    }
  }

  // Ask question
  async function handleAsk(questionText?: string) {
    const q = (questionText || inputQuestion).trim()
    if (!q || loading) return

    if (!session?.access_token) {
      setErrorBanner('Please sign in to ask questions about your documents.')
      return
    }

    setErrorBanner(null)
    setInputQuestion('')

    // Optimistically append user message
    const tempUserId = 'user-' + Date.now()
    const newMessages: ChatItem[] = [
      ...messages,
      { id: tempUserId, role: 'user', content: q },
    ]
    setMessages(newMessages)
    setLoading(true)

    try {
      const payload: { question: string; document_ids?: string[] } = {
        question: q,
      }
      if (selectedDocId !== 'all') {
        payload.document_ids = [selectedDocId]
      }

      const res = await fetch(`${API_BASE_URL}/api/assistant/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Server returned status ${res.status}`)
      }

      const result = await res.json()

      const assistantItem: ChatItem = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: result.answer,
        answer_status: result.status,
        citations: result.citations || [],
      }

      setMessages([...newMessages, assistantItem])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error communicating with assistant'
      setErrorBanner(msg)
      setMessages([
        ...newMessages,
        {
          id: 'error-' + Date.now(),
          role: 'assistant',
          content: 'Sorry, I encountered an error communicating with the server. Please check that the backend is running.',
          answer_status: 'not_found',
          citations: [],
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-5xl mx-auto">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">AI Academic Assistant</h2>
            <Badge variant="brand" className="text-[11px] py-0.5">
              Verified RAG
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Grounded answers over your uploaded college circulars with authentic page citations.
          </p>
        </div>

        {/* Filter and Clear controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Document filter */}
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs">
            <Filter className="size-3.5 text-gray-400 shrink-0" />
            <select
              value={selectedDocId}
              onChange={e => setSelectedDocId(e.target.value)}
              className="bg-transparent text-gray-700 outline-none cursor-pointer max-w-[150px] truncate"
              aria-label="Filter by document"
            >
              <option value="all">All Documents ({docs.length})</option>
              {docs.map(d => (
                <option key={d.id} value={d.id}>
                  {d.file_name} ({d.page_count}p)
                </option>
              ))}
            </select>
          </div>

          {messages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearHistory}
              className="text-gray-400 hover:text-red-600 text-xs py-1 px-2"
              title="Clear conversation history"
            >
              <Trash2 className="size-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {errorBanner && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 shrink-0">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* ── Chat Messages Container ── */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.length === 0 ? (
          /* Empty State & Starter Prompts */
          <div className="h-full flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-5">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 shadow-sm border border-brand-100">
                <Sparkles className="size-7 text-brand-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Ask anything about your college notices
                </h3>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  Every answer cites the genuine document and page number. If an answer cannot be verified in your files, the AI will honestly state it's not found rather than hallucinate.
                </p>
              </div>

              {/* Trust pill */}
              <div className="flex items-center justify-center gap-2 rounded-full border border-green-200 bg-green-50/70 px-3 py-1 text-xs text-green-800">
                <ShieldCheck className="size-3.5 text-green-600" />
                <span>Anti-Hallucination Guard: Zero invented rules, dates, or fees</span>
              </div>

              {/* Starter questions */}
              <div className="pt-2 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Sample Questions
                </p>
                <div className="grid gap-2">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAsk(prompt)}
                      className="flex items-center justify-between rounded-xl border border-surface-border bg-white p-3 text-xs text-gray-700 hover:border-brand-300 hover:bg-brand-50/30 transition text-left group shadow-xs"
                    >
                      <span>{prompt}</span>
                      <ArrowRight className="size-3.5 text-gray-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Messages Stream */
          messages.map(msg => {
            const isUser = msg.role === 'user'

            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-xl rounded-2xl bg-brand-600 px-4 py-3 text-sm text-white shadow-xs">
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )
            }

            // Assistant Message
            const isGrounded = msg.answer_status === 'grounded'
            const citations = msg.citations || []

            return (
              <div key={msg.id} className="flex gap-3 justify-start">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 mt-0.5">
                  <Sparkles className="size-4" />
                </div>

                <div className="max-w-[90%] sm:max-w-2xl space-y-3">
                  {/* Status Indicator */}
                  {isGrounded ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
                      <CheckCircle2 className="size-3.5" />
                      <span>Verified in your documents</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md w-fit">
                      <AlertCircle className="size-3.5" />
                      <span>Could not be verified in your uploaded documents</span>
                    </div>
                  )}

                  {/* Answer Bubble */}
                  <div className="rounded-2xl border border-surface-border bg-white p-4 text-sm text-gray-800 shadow-xs space-y-3 leading-relaxed">
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Citations Box */}
                    {isGrounded && citations.length > 0 && (
                      <div className="pt-3 border-t border-gray-100 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Sources & Verified Citations ({citations.length})
                        </p>
                        <div className="space-y-2">
                          {citations.map((c, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-brand-100 bg-brand-50/30 p-2.5 text-xs space-y-1.5"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 font-semibold text-brand-900">
                                  <FileText className="size-3.5 text-brand-600" />
                                  <span className="truncate max-w-[200px]">{c.document_name}</span>
                                </span>
                                <Badge variant="brand" className="text-[10px] py-0 px-1.5 font-bold">
                                  Page {c.page_number}
                                </Badge>
                              </div>
                              {c.snippet && (
                                <div className="flex items-start gap-1.5 text-gray-600 italic bg-white/70 rounded p-1.5 border border-brand-100/60">
                                  <Quote className="size-3 text-brand-400 shrink-0 mt-0.5" />
                                  <span>"{c.snippet}"</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-3 justify-start animate-in fade-in">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Sparkles className="size-4 animate-spin" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-surface-border bg-white px-4 py-3 text-xs text-gray-500 shadow-xs">
              <Spinner size="sm" />
              <span>Retrieving relevant chunks & verifying quotes...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Bar ── */}
      <div className="pt-2 shrink-0 border-t border-surface-border bg-surface">
        <form
          onSubmit={e => {
            e.preventDefault()
            handleAsk()
          }}
          className="flex items-center gap-2 bg-white rounded-2xl border border-gray-300 p-1.5 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputQuestion}
            onChange={e => setInputQuestion(e.target.value)}
            placeholder={
              selectedDocId === 'all'
                ? 'Ask a question across all your uploaded college documents...'
                : `Ask a question about ${docs.find(d => d.id === selectedDocId)?.file_name || 'selected document'}...`
            }
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!inputQuestion.trim() || loading}
            isLoading={loading}
            className="rounded-xl px-3"
            aria-label="Send question"
          >
            <Send className="size-4" />
          </Button>
        </form>

        <p className="text-[11px] text-gray-400 text-center mt-2">
          CampusPulse verifies facts against your uploaded PDFs only. It does not fabricate college guidelines or exam dates.
        </p>
      </div>
    </div>
  )
}
