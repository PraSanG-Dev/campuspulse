import { useState, useEffect, useCallback } from 'react'
import { Plus, CheckCircle, XCircle, MinusCircle, Trash2, Target, BookOpen, AlertCircle, RefreshCw } from 'lucide-react'
import { computeAttendance, attendanceStatusColor, attendanceBarColor } from '@/lib/attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { AttendanceStatus, Subject as DbSubject, AttendanceRecord as DbRecord } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubjectWithRecords {
  id: string
  name: string
  records: Array<{
    id: string
    date: string
    status: AttendanceStatus
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countsByStatus(records: Array<{ status: AttendanceStatus }>) {
  let present = 0, absent = 0, cancelled = 0
  for (const r of records) {
    if (r.status === 'present')   present++
    if (r.status === 'absent')    absent++
    if (r.status === 'cancelled') cancelled++
  }
  return { present, absent, cancelled, conducted: present + absent }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TargetSetting({ target, onChange }: { target: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-white px-4 py-3 shadow-sm">
      <Target className="size-5 shrink-0 text-brand-500" />
      <label htmlFor="target-input" className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Attendance target
      </label>
      <div className="flex items-center gap-2 ml-auto">
        <input
          id="target-input"
          type="range"
          min={50} max={100} step={5}
          value={target}
          onChange={e => onChange(Number(e.target.value))}
          className="w-28 accent-brand-600 cursor-pointer"
          aria-label={`Attendance target: ${target}%`}
        />
        <span className="w-10 text-right text-sm font-bold text-brand-600 tabular-nums">
          {target}%
        </span>
      </div>
    </div>
  )
}

interface SubjectCardProps {
  subject: SubjectWithRecords
  target: number
  onRecord: (subjectId: string, status: AttendanceStatus) => void
  onDelete: (subjectId: string) => void
}

function SubjectCard({ subject, target, onRecord, onDelete }: SubjectCardProps) {
  const { present, absent, cancelled, conducted } = countsByStatus(subject.records)
  const stats = computeAttendance(present, conducted, target)
  const pctDisplay = stats.percentage === null ? '—' : `${stats.percentage}%`
  const colorClass = attendanceStatusColor(stats.percentage, target)
  const barColor = attendanceBarColor(stats.percentage, target)
  const barWidth = stats.percentage === null ? 0 : Math.min(100, stats.percentage)

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="normal-case text-base font-semibold text-gray-800 truncate">
          {subject.name}
        </CardTitle>
        <button
          onClick={() => onDelete(subject.id)}
          className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          aria-label={`Delete ${subject.name}`}
          title="Delete subject"
        >
          <Trash2 className="size-4" />
        </button>
      </CardHeader>

      <CardContent>
        {/* Percentage + bar */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className={cn('text-3xl font-bold tabular-nums', colorClass)}>
              {pctDisplay}
            </span>
            <span className="text-xs text-gray-400">
              {conducted === 0 ? 'No classes yet' : `${present} / ${conducted} classes`}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuenow={stats.percentage ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${subject.name}: ${pctDisplay}`}
          >
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColor)}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          {/* Target marker line */}
          <div className="relative h-0">
            <div
              className="absolute -top-2 w-px h-4 bg-gray-400 opacity-60"
              style={{ left: `${target}%` }}
              title={`Target: ${target}%`}
            />
          </div>
        </div>

        {/* Stats chips */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Badge variant="success">{present} present</Badge>
          <Badge variant="danger">{absent} absent</Badge>
          {cancelled > 0 && <Badge variant="default">{cancelled} cancelled</Badge>}
        </div>

        {/* Insight message */}
        {conducted > 0 && (
          <div className={cn(
            'mb-4 rounded-lg px-3 py-2 text-xs',
            stats.needed === 0 && stats.canMiss > 0
              ? 'bg-green-50 text-green-700'
              : stats.needed === 'not_reachable'
              ? 'bg-red-50 text-red-700'
              : stats.needed === 0
              ? 'bg-brand-50 text-brand-700'
              : 'bg-amber-50 text-amber-700',
          )}>
            {stats.needed === 'not_reachable' && (
              <span>⚠️ 100% target is not reachable — you have at least one absence.</span>
            )}
            {stats.needed === 0 && stats.canMiss > 0 && (
              <span>✓ On track! You can safely miss <strong>{stats.canMiss}</strong> more class{stats.canMiss !== 1 ? 'es' : ''} and maintain &ge;{target}%.</span>
            )}
            {stats.needed === 0 && stats.canMiss === 0 && (
              <span>✓ Exactly at target. Any absence will drop your score below {target}%.</span>
            )}
            {typeof stats.needed === 'number' && stats.needed > 0 && (
              <span>⚡ Attend <strong>{stats.needed}</strong> more class{stats.needed !== 1 ? 'es' : ''} in a row to reach {target}%.</span>
            )}
          </div>
        )}

        {/* Record attendance buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onRecord(subject.id, 'present')}
            className="flex flex-col items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-2.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            aria-label={`Record present for ${subject.name}`}
          >
            <CheckCircle className="size-5" />
            Present
          </button>
          <button
            onClick={() => onRecord(subject.id, 'absent')}
            className="flex flex-col items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-2.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label={`Record absent for ${subject.name}`}
          >
            <XCircle className="size-5" />
            Absent
          </button>
          <button
            onClick={() => onRecord(subject.id, 'cancelled')}
            className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            aria-label={`Record cancelled for ${subject.name}`}
          >
            <MinusCircle className="size-5" />
            Cancelled
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Add Subject form ──────────────────────────────────────────────────────────

interface AddSubjectFormProps {
  onAdd: (name: string) => void
  onCancel: () => void
  isLoading?: boolean
}

function AddSubjectForm({ onAdd, onCancel, isLoading }: AddSubjectFormProps) {
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <Card className="border-brand-200 bg-brand-50/30">
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="subject-name" className="block text-sm font-medium text-gray-700">
            Subject name
          </label>
          <input
            id="subject-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Cloud Computing or DBMS"
            autoFocus
            maxLength={80}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={isLoading} disabled={!name.trim()}>
              Add subject
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Attendance() {
  const { user, profile, isConfigured } = useAuth()
  const [subjects, setSubjects] = useState<SubjectWithRecords[]>([])
  const [target, setTarget] = useState<number>(75)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingSubject, setSavingSubject] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Fetch subjects, attendance records, and target from Supabase
  const loadData = useCallback(async () => {
    if (!user || !isConfigured) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorBanner(null)

    try {
      // 1. Fetch user profile target if available
      if (profile?.attendance_target) {
        setTarget(profile.attendance_target)
      } else {
        const { data: profData } = await supabase
          .from('profiles')
          .select('attendance_target')
          .eq('id', user.id)
          .single()
        if (profData?.attendance_target) {
          setTarget(profData.attendance_target)
        }
      }

      // 2. Fetch subjects
      const { data: dbSubjects, error: subError } = await supabase
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: true })

      if (subError) throw subError

      // 3. Fetch attendance records
      const { data: dbRecords, error: recError } = await supabase
        .from('attendance_records')
        .select('*')
        .order('class_date', { ascending: true })

      if (recError) throw recError

      // Group records by subject
      const recordsBySubject: Record<string, Array<{ id: string; date: string; status: AttendanceStatus }>> = {}
      ;(dbRecords as DbRecord[] | null)?.forEach(r => {
        if (!recordsBySubject[r.subject_id]) {
          recordsBySubject[r.subject_id] = []
        }
        recordsBySubject[r.subject_id].push({
          id: r.id,
          date: r.class_date,
          status: r.status as AttendanceStatus,
        })
      })

      const combined: SubjectWithRecords[] = ((dbSubjects as DbSubject[]) || []).map(s => ({
        id: s.id,
        name: s.name,
        records: recordsBySubject[s.id] || [],
      }))

      setSubjects(combined)
    } catch (err: unknown) {
      console.error('Error loading attendance from Supabase:', err)
      const msg = err instanceof Error ? err.message : 'Could not fetch data from database'
      setErrorBanner(`Database sync notice: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [user, profile, isConfigured])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Update target in Supabase
  async function handleTargetChange(newTarget: number) {
    setTarget(newTarget)
    if (!user || !isConfigured) return

    try {
      await supabase
        .from('profiles')
        .update({ attendance_target: newTarget })
        .eq('id', user.id)
    } catch (err) {
      console.warn('Could not persist target to profile:', err)
    }
  }

  // Add subject
  async function handleAddSubject(name: string) {
    if (!user || !isConfigured) {
      setErrorBanner('Please connect your Supabase account to save subjects.')
      return
    }

    setSavingSubject(true)
    setErrorBanner(null)

    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert({
          name,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      setSubjects(prev => [
        ...prev,
        {
          id: (data as DbSubject).id,
          name: (data as DbSubject).name,
          records: [],
        },
      ])
      setShowAddForm(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add subject'
      setErrorBanner(msg)
    } finally {
      setSavingSubject(false)
    }
  }

  // Delete subject
  async function handleDeleteSubject(subjectId: string) {
    if (!confirm('Delete this subject and all its recorded attendance?')) return

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)

      if (error) throw error

      setSubjects(prev => prev.filter(s => s.id !== subjectId))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete subject'
      setErrorBanner(msg)
    }
  }

  // Record attendance
  async function handleRecord(subjectId: string, status: AttendanceStatus) {
    if (!user || !isConfigured) {
      setErrorBanner('Please connect Supabase to record attendance.')
      return
    }

    const today = new Date().toISOString().slice(0, 10)

    // Optimistic UI update
    setSubjects(prev =>
      prev.map(s => {
        if (s.id !== subjectId) return s
        const exists = s.records.some(r => r.date === today)
        const updatedRecords = exists
          ? s.records.map(r => (r.date === today ? { ...r, status } : r))
          : [...s.records, { id: 'temp-' + Date.now(), date: today, status }]
        return { ...s, records: updatedRecords }
      }),
    )

    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert(
          {
            user_id: user.id,
            subject_id: subjectId,
            class_date: today,
            status,
          },
          { onConflict: 'subject_id,class_date' },
        )

      if (error) throw error
    } catch (err: unknown) {
      console.error('Failed to save attendance record:', err)
      const msg = err instanceof Error ? err.message : 'Failed to save attendance'
      setErrorBanner(msg)
      // Revert from server
      loadData()
    }
  }

  // Overall stats across all subjects
  const overall = subjects.reduce(
    (acc, s) => {
      const { present, conducted } = countsByStatus(s.records)
      return { present: acc.present + present, conducted: acc.conducted + conducted }
    },
    { present: 0, conducted: 0 },
  )
  const overallStats = computeAttendance(overall.present, overall.conducted, target)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner size="md" />
          <p className="text-xs text-gray-400">Loading your subjects & attendance...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Real Supabase RLS Indicator banner */}
      <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-2 text-xs text-brand-800">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-green-500 animate-pulse" />
          <span>
            Connected to <strong>Supabase</strong> with Row-Level Security active (User: {user?.email})
          </span>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1 text-brand-700 hover:text-brand-900 transition font-medium"
          title="Refresh database records"
        >
          <RefreshCw className="size-3" />
          <span>Refresh</span>
        </button>
      </div>

      {errorBanner && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Target + overall summary */}
      <div className="space-y-3">
        <TargetSetting target={target} onChange={handleTargetChange} />

        {overall.conducted > 0 && (
          <div className={cn(
            'rounded-xl border px-4 py-3 text-sm shadow-sm transition-colors',
            (overallStats.percentage ?? 0) >= target
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800',
          )}>
            <span className="font-semibold">Overall Attendance: </span>
            {overallStats.percentage}% across {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
            {' '}({overall.present}/{overall.conducted} classes conducted)
          </div>
        )}
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {subjects.length} Subject{subjects.length !== 1 ? 's' : ''}
        </h2>
        <Button
          size="sm"
          onClick={() => setShowAddForm(v => !v)}
          aria-expanded={showAddForm}
        >
          <Plus className="size-4" />
          Add subject
        </Button>
      </div>

      {/* Add subject form */}
      {showAddForm && (
        <AddSubjectForm
          onAdd={handleAddSubject}
          onCancel={() => setShowAddForm(false)}
          isLoading={savingSubject}
        />
      )}

      {/* Subject cards grid */}
      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects registered yet"
          description="Add your course subjects to start logging daily attendance and tracking target percentages."
          action={
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="size-4" /> Add your first subject
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map(subject => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              target={target}
              onRecord={handleRecord}
              onDelete={handleDeleteSubject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
