import { useState, useEffect, useCallback, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  Calendar,
  Quote,
  ShieldCheck,
  Check,
  X,
  Edit2,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { ExtractedItem, ExtractedItemKind } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const KIND_LABELS: Record<ExtractedItemKind, { label: string; color: string; icon: React.ElementType }> = {
  deadline:          { label: 'Deadlines & Dates',   color: 'border-red-200 bg-red-50 text-red-700',       icon: Clock },
  eligibility:       { label: 'Eligibility Criteria', color: 'border-blue-200 bg-blue-50 text-blue-700',     icon: BookOpen },
  document_required: { label: 'Required Documents',  color: 'border-amber-200 bg-amber-50 text-amber-700',  icon: FileText },
  next_step:         { label: 'Next Steps & Actions',color: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: ChevronRight },
}

export default function Notices() {
  const { user, session } = useAuth()
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<string>('')
  const [summary, setSummary] = useState<string | null>(null)
  const [items, setItems] = useState<ExtractedItem[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch pending and past extracted items for this student
  const loadStudentItems = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('extracted_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setItems(data as ExtractedItem[])
      }
    } catch (err) {
      console.warn('Could not load existing extracted items:', err)
    }
  }, [user])

  useEffect(() => {
    loadStudentItems()
  }, [loadStudentItems])

  function showToast(msg: string) {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(null), 3500)
  }

  // Handle PDF file selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Invalid file. Only .pdf files are accepted.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File exceeds 10 MB limit.')
      return
    }

    setErrorMsg(null)
    setSelectedFile(file)
  }

  // Trigger analysis for either PDF or pasted text
  async function handleAnalyze() {
    if (!session?.access_token) {
      setErrorMsg('You must be signed in to analyze notices.')
      return
    }

    setErrorMsg(null)
    setAnalyzing(true)

    try {
      if (activeTab === 'upload') {
        if (!selectedFile) {
          setErrorMsg('Please select a PDF file first.')
          setAnalyzing(false)
          return
        }

        setAnalysisStatus('Uploading PDF & extracting pages via PyMuPDF...')
        const formData = new FormData()
        formData.append('file', selectedFile)

        const uploadRes = await fetch(`${API_BASE_URL}/api/documents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        })

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}))
          throw new Error(errData.detail || `Upload failed with status ${uploadRes.status}`)
        }

        const docData = await uploadRes.json()
        const documentId = docData.id

        setAnalysisStatus('Analyzing notice with AI & verifying citations...')
        const analyzeRes = await fetch(`${API_BASE_URL}/api/notices/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ document_id: documentId }),
        })

        if (!analyzeRes.ok) {
          const errData = await analyzeRes.json().catch(() => ({}))
          throw new Error(errData.detail || 'Notice analysis failed.')
        }

        const result = await analyzeRes.json()
        setSummary(result.summary)
        showToast('PDF analyzed! Extracted items added to confirmation queue.')
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        // Pasted text flow
        if (!pastedText.trim() || pastedText.trim().length < 20) {
          setErrorMsg('Please paste at least a couple sentences of notice text.')
          setAnalyzing(false)
          return
        }

        setAnalysisStatus('Analyzing notice text & verifying deadlines...')
        const analyzeRes = await fetch(`${API_BASE_URL}/api/notices/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text: pastedText }),
        })

        if (!analyzeRes.ok) {
          const errData = await analyzeRes.json().catch(() => ({}))
          throw new Error(errData.detail || 'Notice analysis failed.')
        }

        const result = await analyzeRes.json()
        setSummary(result.summary)
        showToast('Notice text analyzed successfully!')
        setPastedText('')
      }

      await loadStudentItems()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed. Please check backend connection.'
      setErrorMsg(msg)
    } finally {
      setAnalyzing(false)
      setAnalysisStatus('')
    }
  }

  // ── Confirmation Queue Actions (Directly from React to Supabase) ───────────

  async function handleConfirmItem(item: ExtractedItem) {
    if (!user) return

    try {
      // 1. Update item status to 'confirmed'
      const { error: updError } = await supabase
        .from('extracted_items')
        .update({ status: 'confirmed' })
        .eq('id', item.id)

      if (updError) throw updError

      // 2. If item is a deadline, create a reminder linked via source_item_id
      if (item.kind === 'deadline') {
        const dueDate = item.item_date ? new Date(item.item_date).toISOString() : new Date().toISOString()
        const { error: remError } = await supabase
          .from('reminders')
          .insert({
            user_id: user.id,
            title: item.text,
            remind_at: dueDate,
            source_item_id: item.id,
          })

        if (remError) {
          console.warn('Could not insert calendar reminder:', remError)
        } else {
          showToast('Confirmed! Added to your Timetable deadlines.')
        }
      } else {
        showToast('Item confirmed.')
      }

      setItems(prev => prev.map(it => (it.id === item.id ? { ...it, status: 'confirmed' } : it)))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not confirm item.'
      setErrorMsg(msg)
    }
  }

  async function handleRejectItem(itemId: string) {
    try {
      const { error } = await supabase
        .from('extracted_items')
        .update({ status: 'rejected' })
        .eq('id', itemId)

      if (error) throw error

      setItems(prev => prev.map(it => (it.id === itemId ? { ...it, status: 'rejected' } : it)))
      showToast('Item rejected.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not reject item.'
      setErrorMsg(msg)
    }
  }

  async function handleSaveEdit(itemId: string) {
    try {
      const payload: Partial<ExtractedItem> = {
        text: editText,
        item_date: editDate || null,
        status: 'confirmed',
      }

      const { error } = await supabase
        .from('extracted_items')
        .update(payload)
        .eq('id', itemId)

      if (error) throw error

      // If it's a deadline, also insert reminder
      if (editDate) {
        await supabase.from('reminders').insert({
          user_id: user?.id,
          title: editText,
          remind_at: new Date(editDate).toISOString(),
          source_item_id: itemId,
        })
      }

      setItems(prev =>
        prev.map(it => (it.id === itemId ? { ...it, ...payload } : it)),
      )
      setEditingId(null)
      showToast('Item updated & confirmed to calendar.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save edit.'
      setErrorMsg(msg)
    }
  }

  const pendingItems = items.filter(it => it.status === 'pending')
  const confirmedItems = items.filter(it => it.status === 'confirmed')

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Toast notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 text-green-600" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header & trust principle note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Notice Analyzer</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Extract deadlines, eligibility, and next steps with verifiable page citations.
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 border border-brand-100">
          <ShieldCheck className="size-3.5" />
          <span>Trust Guard: Student confirms before adding to calendar</span>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Input Card (Upload or Paste) ── */}
      <Card>
        <CardHeader className="border-b border-surface-border pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('upload'); setErrorMsg(null) }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                activeTab === 'upload' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              <UploadCloud className="size-4" />
              Upload PDF Notice
            </button>
            <button
              onClick={() => { setActiveTab('paste'); setErrorMsg(null) }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                activeTab === 'paste' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              <FileText className="size-4" />
              Paste Notice Text
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {activeTab === 'upload' ? (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer',
                  selectedFile
                    ? 'border-brand-500 bg-brand-50/20'
                    : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <UploadCloud className="size-10 text-brand-500 mb-2" strokeWidth={1.5} />
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Click to choose or drop college notice PDF
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Max 10 MB, up to 50 pages • Must contain extractable text
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleAnalyze}
                  disabled={!selectedFile || analyzing}
                  isLoading={analyzing}
                  size="md"
                >
                  <Sparkles className="size-4 mr-1.5" />
                  Analyze Notice PDF
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="Paste notice text here (e.g. from WhatsApp announcement, circular email, or university bulletin)..."
                rows={6}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-y"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {pastedText.length} characters
                </span>
                <Button
                  onClick={handleAnalyze}
                  disabled={!pastedText.trim() || analyzing}
                  isLoading={analyzing}
                  size="md"
                >
                  <Sparkles className="size-4 mr-1.5" />
                  Analyze Pasted Text
                </Button>
              </div>
            </div>
          )}

          {analyzing && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-brand-50 p-3 text-xs font-medium text-brand-700 animate-pulse">
              <Spinner size="sm" />
              <span>{analysisStatus || 'Processing notice with AI...'}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Summary Card ── */}
      {summary && (
        <Card className="border-brand-200 bg-brand-50/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-600" />
              <CardTitle className="text-brand-900">Simple-English Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Confirmation Queue: Items Needing Confirmation ── */}
      <section aria-label="Confirmation Queue" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">Needs Confirmation Queue</h3>
            <Badge variant="pending" className="font-semibold">
              {pendingItems.length} Pending
            </Badge>
          </div>
          <p className="text-xs text-gray-400 hidden sm:block">
            Confirm items to push deadlines to your Timetable
          </p>
        </div>

        {pendingItems.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <EmptyState
                icon={CheckCircle2}
                title="All caught up!"
                description="No pending notice items require your review. Upload a new circular or notice above to extract items."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {pendingItems.map(item => {
              const meta = KIND_LABELS[item.kind] || KIND_LABELS.next_step
              const Icon = meta.icon
              const isEditing = editingId === item.id

              return (
                <Card key={item.id} className="border-amber-200/80 bg-white transition hover:shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    {isEditing ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                          <input
                            type="text"
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-brand-500"
                          />
                        </div>
                        {item.kind === 'deadline' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date (YYYY-MM-DD)</label>
                            <input
                              type="date"
                              value={editDate}
                              onChange={e => setEditDate(e.target.value)}
                              className="rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-brand-500"
                            />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveEdit(item.id)}>
                            <Check className="size-3.5 mr-1" /> Save & Confirm
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Display Mode */
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border', meta.color)}>
                              <Icon className="size-3" />
                              {meta.label}
                            </span>

                            {item.page_number && (
                              <Badge variant="default" className="text-[11px]">
                                Page {item.page_number}
                              </Badge>
                            )}

                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                                item.confidence === 'high'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-800'
                              )}
                              title={item.confidence === 'low' ? 'Date format or citation was ambiguous; please verify' : 'Explicitly verified in document'}
                            >
                              {item.confidence === 'high' ? 'High confidence' : 'Low confidence (verify)'}
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-gray-900 leading-snug">
                            {item.text}
                          </p>

                          {item.item_date && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                              <Calendar className="size-3.5" />
                              <span>Due date: {item.item_date}</span>
                            </div>
                          )}

                          {item.source_quote && (
                            <div className="flex items-start gap-1.5 rounded-lg bg-gray-50 p-2 text-xs text-gray-500 border border-gray-100">
                              <Quote className="size-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <span className="italic">"{item.source_quote}"</span>
                            </div>
                          )}
                        </div>

                        {/* Confirmation Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0">
                          <Button
                            size="sm"
                            onClick={() => handleConfirmItem(item)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            title="Confirm and push to calendar"
                          >
                            <Check className="size-4 mr-1" />
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditingId(item.id)
                              setEditText(item.text)
                              setEditDate(item.item_date || '')
                            }}
                            title="Edit date or text"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRejectItem(item.id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Reject item"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Confirmed Deadlines & Items Archive ── */}
      {confirmedItems.length > 0 && (
        <section aria-label="Confirmed items" className="space-y-3 pt-4 border-t border-surface-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Confirmed Notice Deadlines & Records ({confirmedItems.length})
            </h3>
            <span className="text-xs text-green-700 font-medium">✓ Active in Timetable</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {confirmedItems.map(item => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3.5 text-xs shadow-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-900 truncate">{item.text}</span>
                  </div>
                  {item.item_date && (
                    <p className="text-gray-500 font-medium">Due: {item.item_date}</p>
                  )}
                  {item.page_number && (
                    <p className="text-[11px] text-gray-400">Source: Page {item.page_number}</p>
                  )}
                </div>
                <Badge variant="success" className="shrink-0">
                  Confirmed ✓
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
