import { useState } from 'react'
import { Clock, CalendarDays, Plus, Bell, Trash2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimetableSlot {
  id: string
  day: number          // 0=Mon … 5=Sat
  startTime: string    // 'HH:MM'
  endTime: string
  subject: string
  room: string
}

interface Deadline {
  id: string
  title: string
  subject: string
  dueDate: string      // 'YYYY-MM-DD'
  confirmed: boolean   // true = confirmed from notice; false = personal reminder
}

// ── Sample data ───────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const SAMPLE_SLOTS: TimetableSlot[] = [
  { id: 't1', day: 0, startTime: '09:00', endTime: '10:00', subject: 'Data Structures', room: 'LH-3' },
  { id: 't2', day: 0, startTime: '11:00', endTime: '12:00', subject: 'DBMS', room: 'LH-1' },
  { id: 't3', day: 1, startTime: '09:00', endTime: '10:00', subject: 'Operating Systems', room: 'LH-2' },
  { id: 't4', day: 1, startTime: '14:00', endTime: '16:00', subject: 'DS Lab', room: 'Lab-1' },
  { id: 't5', day: 2, startTime: '09:00', endTime: '10:00', subject: 'Data Structures', room: 'LH-3' },
  { id: 't6', day: 2, startTime: '11:00', endTime: '12:00', subject: 'Operating Systems', room: 'LH-1' },
  { id: 't7', day: 2, startTime: '14:00', endTime: '15:00', subject: 'DBMS Lab', room: 'Lab-2' },
  { id: 't8', day: 3, startTime: '09:00', endTime: '10:00', subject: 'Computer Networks', room: 'LH-4' },
  { id: 't9', day: 3, startTime: '11:00', endTime: '12:00', subject: 'DBMS', room: 'LH-1' },
  { id: 't10', day: 4, startTime: '09:00', endTime: '10:00', subject: 'Computer Networks', room: 'LH-4' },
  { id: 't11', day: 4, startTime: '11:00', endTime: '13:00', subject: 'Networks Lab', room: 'Lab-3' },
  { id: 't12', day: 5, startTime: '10:00', endTime: '12:00', subject: 'Open Elective', room: 'LH-5' },
]

const SAMPLE_DEADLINES: Deadline[] = [
  { id: 'd1', title: 'Project Proposal Submission', subject: 'DBMS',             dueDate: '2026-10-28', confirmed: true },
  { id: 'd2', title: 'Assignment 3',                subject: 'Data Structures',  dueDate: '2026-10-25', confirmed: true },
  { id: 'd3', title: 'Mid-term Viva',               subject: 'Computer Networks', dueDate: '2026-11-02', confirmed: false },
  { id: 'd4', title: 'Lab Record Submission',        subject: 'DS Lab',            dueDate: '2026-11-08', confirmed: true },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function todayDayIndex(): number {
  // JS: 0=Sun, 1=Mon … we want 0=Mon
  const d = new Date().getDay()
  return d === 0 ? 6 : d - 1   // Sunday becomes 6 (not in our 0-5 range)
}

let nextId = 500
function uid() { return String(nextId++) }

// ── Weekly grid ───────────────────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, string> = {
  'Data Structures': 'bg-brand-50 border-brand-200 text-brand-800',
  'DBMS':            'bg-purple-50 border-purple-200 text-purple-800',
  'Operating Systems': 'bg-green-50 border-green-200 text-green-800',
  'Computer Networks': 'bg-orange-50 border-orange-200 text-orange-800',
  'DS Lab':            'bg-brand-50 border-brand-200 text-brand-800',
  'DBMS Lab':          'bg-purple-50 border-purple-200 text-purple-800',
  'Networks Lab':      'bg-orange-50 border-orange-200 text-orange-800',
  'Open Elective':     'bg-gray-50 border-gray-200 text-gray-700',
}

function slotColor(subject: string): string {
  return SUBJECT_COLORS[subject] ?? 'bg-gray-50 border-gray-200 text-gray-700'
}

function WeeklyGrid({ slots }: { slots: TimetableSlot[] }) {
  const today = todayDayIndex()

  return (
    // Horizontal scroll on mobile so the grid doesn't get squished
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <div className="min-w-[600px]">
        {/* Day headers */}
        <div className="grid grid-cols-6 border-b border-surface-border">
          {DAYS.map((day, i) => (
            <div
              key={day}
              className={cn(
                'px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide',
                i === today
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-500',
                i < 5 && 'border-r border-surface-border',
              )}
            >
              {day}
              {i === today && (
                <span className="ml-1.5 inline-block size-1.5 rounded-full bg-brand-500 align-middle" />
              )}
            </div>
          ))}
        </div>

        {/* Slot rows — one column per day */}
        <div className="grid grid-cols-6">
          {DAYS.map((day, dayIdx) => {
            const daySlots = slots
              .filter(s => s.day === dayIdx)
              .sort((a, b) => a.startTime.localeCompare(b.startTime))

            return (
              <div
                key={day}
                className={cn(
                  'min-h-[140px] space-y-1.5 p-2',
                  dayIdx < 5 && 'border-r border-surface-border',
                  dayIdx === today && 'bg-brand-50/30',
                )}
              >
                {daySlots.length === 0 ? (
                  <p className="pt-4 text-center text-xs text-gray-300">—</p>
                ) : (
                  daySlots.map(slot => (
                    <div
                      key={slot.id}
                      className={cn(
                        'rounded-lg border px-2 py-1.5 text-xs',
                        slotColor(slot.subject),
                      )}
                    >
                      <p className="font-medium leading-snug truncate">{slot.subject}</p>
                      <p className="mt-0.5 text-[10px] opacity-70">
                        {slot.startTime}–{slot.endTime}
                      </p>
                      <p className="text-[10px] opacity-60">{slot.room}</p>
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Add Reminder form ─────────────────────────────────────────────────────────

interface AddReminderFormProps {
  onAdd: (title: string, subject: string, dueDate: string) => void
  onCancel: () => void
}

function AddReminderForm({ onAdd, onCancel }: AddReminderFormProps) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [dueDate, setDueDate] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !dueDate) return
    onAdd(title.trim(), subject.trim(), dueDate)
  }

  return (
    <Card className="border-brand-200 bg-brand-50/20">
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Add personal reminder</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="reminder-title">
                Title *
              </label>
              <input
                id="reminder-title"
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Submit assignment"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="reminder-subject">
                Subject (optional)
              </label>
              <input
                id="reminder-subject"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Data Structures"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="reminder-date">
                Due date *
              </label>
              <input
                id="reminder-date"
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!title.trim() || !dueDate}>
              <Bell className="size-3.5" /> Add reminder
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Deadline item ─────────────────────────────────────────────────────────────

function DeadlineItem({ deadline, onDelete }: { deadline: Deadline; onDelete: (id: string) => void }) {
  const days = daysUntil(deadline.dueDate)
  const isOverdue = days < 0
  const isUrgent  = days >= 0 && days <= 3

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      {/* Days counter pill */}
      <div className={cn(
        'mt-0.5 flex w-12 shrink-0 flex-col items-center justify-center rounded-lg py-1 text-center leading-tight',
        isOverdue ? 'bg-red-100 text-red-700'
          : isUrgent ? 'bg-amber-100 text-amber-700'
          : 'bg-brand-50 text-brand-700',
      )}>
        <span className="text-sm font-bold tabular-nums">
          {isOverdue ? 'Late' : days === 0 ? 'Today' : days}
        </span>
        {!isOverdue && days !== 0 && <span className="text-[9px] font-medium">days</span>}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-gray-800">{deadline.title}</p>
          <button
            onClick={() => onDelete(deadline.id)}
            className="shrink-0 rounded p-0.5 text-gray-300 hover:text-red-400 transition-colors"
            aria-label={`Remove ${deadline.title}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          {deadline.subject && (
            <span className="text-xs text-gray-400">{deadline.subject}</span>
          )}
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-400">{formatDate(deadline.dueDate)}</span>
          {!deadline.confirmed && (
            <Badge variant="pending" className="text-[10px]">Needs confirmation</Badge>
          )}
        </div>
      </div>
    </li>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Timetable() {
  const [deadlines, setDeadlines] = useState<Deadline[]>(SAMPLE_DEADLINES)
  const [showAddForm, setShowAddForm] = useState(false)
  const today = todayDayIndex()

  function handleAddReminder(title: string, subject: string, dueDate: string) {
    setDeadlines(prev => [
      ...prev,
      { id: uid(), title, subject, dueDate, confirmed: true },
    ])
    setShowAddForm(false)
  }

  function handleDeleteDeadline(id: string) {
    setDeadlines(prev => prev.filter(d => d.id !== id))
  }

  const sortedDeadlines = [...deadlines].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  )

  return (
    <div className="space-y-6">

      {/* Sample data notice */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
        <AlertCircle className="size-4 shrink-0" />
        <span><strong>Sample data</strong> — timetable and deadlines shown are for demo only.</span>
      </div>

      {/* Weekly timetable */}
      <section aria-label="Weekly timetable">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-800">Weekly Timetable</h2>
          </div>
          <span className="text-xs text-gray-400">
            Today: <strong className="text-brand-600">{DAY_FULL[today] ?? 'Weekend'}</strong>
          </span>
        </div>
        <WeeklyGrid slots={SAMPLE_SLOTS} />
      </section>

      {/* Deadlines & reminders */}
      <section aria-label="Upcoming deadlines">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-800">Deadlines & Reminders</h2>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowAddForm(v => !v)}
            aria-expanded={showAddForm}
          >
            <Plus className="size-4" /> Add reminder
          </Button>
        </div>

        {showAddForm && (
          <div className="mb-4">
            <AddReminderForm
              onAdd={handleAddReminder}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <span className="text-xs text-gray-400">{sortedDeadlines.length} item{sortedDeadlines.length !== 1 ? 's' : ''}</span>
          </CardHeader>
          <CardContent>
            {sortedDeadlines.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No deadlines yet"
                description="Add a personal reminder or upload a notice to extract deadlines automatically."
                action={
                  <Button size="sm" variant="secondary" onClick={() => setShowAddForm(true)}>
                    <Plus className="size-4" /> Add reminder
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-surface-border" aria-label="Deadlines list">
                {sortedDeadlines.map(d => (
                  <DeadlineItem key={d.id} deadline={d} onDelete={handleDeleteDeadline} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
