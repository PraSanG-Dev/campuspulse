import { useState } from 'react'
import { Plus, CheckCircle, XCircle, MinusCircle, Trash2, Target, BookOpen } from 'lucide-react'
import { computeAttendance, attendanceStatusColor, attendanceBarColor } from '@/lib/attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'absent' | 'cancelled'

interface AttendanceRecord {
  id: string
  date: string          // 'YYYY-MM-DD'
  status: AttendanceStatus
}

interface Subject {
  id: string
  name: string
  records: AttendanceRecord[]
}

// ── Sample data ───────────────────────────────────────────────────────────────
// Clearly labeled — replaced with Supabase data in Phase 4.

const INITIAL_SUBJECTS: Subject[] = [
  {
    id: 's1', name: 'Data Structures',
    records: [
      { id: 'r1', date: '2026-10-01', status: 'present' },
      { id: 'r2', date: '2026-10-03', status: 'present' },
      { id: 'r3', date: '2026-10-06', status: 'absent' },
      { id: 'r4', date: '2026-10-08', status: 'present' },
      { id: 'r5', date: '2026-10-10', status: 'cancelled' },
      { id: 'r6', date: '2026-10-13', status: 'present' },
      { id: 'r7', date: '2026-10-15', status: 'present' },
      { id: 'r8', date: '2026-10-17', status: 'absent' },
      { id: 'r9', date: '2026-10-20', status: 'present' },
      { id: 'r10', date: '2026-10-22', status: 'present' },
    ],
  },
  {
    id: 's2', name: 'DBMS',
    records: [
      { id: 'r11', date: '2026-10-01', status: 'present' },
      { id: 'r12', date: '2026-10-04', status: 'present' },
      { id: 'r13', date: '2026-10-07', status: 'present' },
      { id: 'r14', date: '2026-10-11', status: 'present' },
      { id: 'r15', date: '2026-10-14', status: 'absent' },
      { id: 'r16', date: '2026-10-18', status: 'present' },
    ],
  },
  {
    id: 's3', name: 'Operating Systems',
    records: [
      { id: 'r17', date: '2026-10-02', status: 'present' },
      { id: 'r18', date: '2026-10-05', status: 'absent' },
      { id: 'r19', date: '2026-10-09', status: 'absent' },
      { id: 'r20', date: '2026-10-12', status: 'present' },
      { id: 'r21', date: '2026-10-16', status: 'present' },
      { id: 'r22', date: '2026-10-19', status: 'absent' },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function countsByStatus(records: AttendanceRecord[]) {
  let present = 0, absent = 0, cancelled = 0
  for (const r of records) {
    if (r.status === 'present')   present++
    if (r.status === 'absent')    absent++
    if (r.status === 'cancelled') cancelled++
  }
  return { present, absent, cancelled, conducted: present + absent }
}

let nextId = 1000
function uid() { return String(nextId++) }

// ── Sub-components ────────────────────────────────────────────────────────────

function TargetSetting({ target, onChange }: { target: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-white px-4 py-3">
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
          className="w-28 accent-brand-600"
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
  subject: Subject
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
    <Card>
      <CardHeader>
        <CardTitle className="normal-case text-base font-semibold text-gray-800">
          {subject.name}
        </CardTitle>
        <button
          onClick={() => onDelete(subject.id)}
          className="rounded p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          aria-label={`Delete ${subject.name}`}
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
              <span>⚠️ 100% is no longer reachable — you have an absence on record.</span>
            )}
            {stats.needed === 0 && stats.canMiss > 0 && (
              <span>✓ On track! You can safely miss <strong>{stats.canMiss}</strong> more class{stats.canMiss !== 1 ? 'es' : ''} and stay above {target}%.</span>
            )}
            {stats.needed === 0 && stats.canMiss === 0 && (
              <span>✓ Exactly at target. Don't miss any more classes!</span>
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
}

function AddSubjectForm({ onAdd, onCancel }: AddSubjectFormProps) {
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
            placeholder="e.g. Computer Networks"
            autoFocus
            maxLength={80}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!name.trim()}>Add subject</Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Attendance() {
  const [subjects, setSubjects] = useState<Subject[]>(INITIAL_SUBJECTS)
  const [target, setTarget] = useState(75)
  const [showAddForm, setShowAddForm] = useState(false)

  function handleAddSubject(name: string) {
    setSubjects(prev => [...prev, { id: uid(), name, records: [] }])
    setShowAddForm(false)
  }

  function handleDeleteSubject(id: string) {
    if (!confirm('Delete this subject and all its records?')) return
    setSubjects(prev => prev.filter(s => s.id !== id))
  }

  function handleRecord(subjectId: string, status: AttendanceStatus) {
    const today = new Date().toISOString().slice(0, 10)
    setSubjects(prev =>
      prev.map(s => {
        if (s.id !== subjectId) return s
        // Prevent duplicate records for the same day
        const alreadyRecorded = s.records.some(r => r.date === today)
        if (alreadyRecorded) {
          // Update the existing record for today instead
          return {
            ...s,
            records: s.records.map(r =>
              r.date === today ? { ...r, status } : r,
            ),
          }
        }
        return {
          ...s,
          records: [...s.records, { id: uid(), date: today, status }],
        }
      }),
    )
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

  return (
    <div className="space-y-5">

      {/* Sample data banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
        <strong>Sample data</strong> — records shown are demo only. Phase 4 will save everything to your account.
      </div>

      {/* Target + overall summary */}
      <div className="space-y-3">
        <TargetSetting target={target} onChange={setTarget} />

        {overall.conducted > 0 && (
          <div className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            (overallStats.percentage ?? 0) >= target
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800',
          )}>
            <span className="font-semibold">Overall: </span>
            {overallStats.percentage}% across {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
            {' '}({overall.present}/{overall.conducted} classes attended)
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
        />
      )}

      {/* Subject cards grid */}
      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description="Add your first subject to start tracking attendance."
          action={
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="size-4" /> Add subject
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
