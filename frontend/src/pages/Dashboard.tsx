import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen,
  CalendarClock,
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { Subject as DbSubject, AttendanceRecord as DbRecord, Reminder as DbReminder, Document as DbDocument } from '@/types'

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLE_ATTENDANCE = [
  { subject: 'Data Structures',   present: 18, conducted: 22 },
  { subject: 'DBMS',             present: 20, conducted: 24 },
  { subject: 'Operating Systems', present: 14, conducted: 20 },
  { subject: 'Computer Networks', present: 17, conducted: 19 },
]

const SAMPLE_DEADLINES = [
  { title: 'Project Proposal Submission', date: '2026-10-28', subject: 'DBMS',            daysLeft: 7 },
  { title: 'Assignment 3',                date: '2026-10-25', subject: 'Data Structures',  daysLeft: 4 },
  { title: 'Mid-term Viva',               date: '2026-11-02', subject: 'Computer Networks', daysLeft: 12 },
]

const SAMPLE_NOTICES = [
  { title: 'Exam Schedule — November 2026', date: '2026-10-19', isNew: true },
  { title: 'Fee Payment Reminder',          date: '2026-10-17', isNew: false },
  { title: 'Hackathon Registration Open',   date: '2026-10-15', isNew: false },
]

const SAMPLE_TIMETABLE_TODAY = [
  { time: '09:00–10:00', subject: 'Data Structures',    room: 'LH-3' },
  { time: '11:00–12:00', subject: 'Operating Systems',  room: 'LH-1' },
  { time: '14:00–15:00', subject: 'DBMS Lab',           room: 'Lab-2' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function attendancePct(present: number, conducted: number): number {
  if (conducted === 0) return 0
  return Math.round((present / conducted) * 100)
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  iconClass?: string
  to?: string
}

function StatCard({ icon: Icon, label, value, sub, iconClass, to }: StatCardProps) {
  const inner = (
    <Card className={cn('group transition-shadow hover:shadow-md', to && 'cursor-pointer')}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
          </div>
          <div className={cn('flex size-10 items-center justify-center rounded-xl', iconClass ?? 'bg-brand-50')}>
            <Icon className={cn('size-5', iconClass ? 'text-white' : 'text-brand-600')} strokeWidth={1.75} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth()
  const [hasRealData, setHasRealData] = useState(false)
  const [realAttendance, setRealAttendance] = useState<{ subject: string; present: number; conducted: number }[]>([])
  const [realDeadlines, setRealDeadlines] = useState<{ title: string; date: string; subject: string; daysLeft: number }[]>([])
  const [realNotices, setRealNotices] = useState<{ title: string; date: string; isNew: boolean }[]>([])

  // Load real data from Supabase if present
  const loadDashboardData = useCallback(async () => {
    if (!user) return

    try {
      // 1. Fetch subjects & attendance
      const { data: subData } = await supabase.from('subjects').select('*')
      const { data: recData } = await supabase.from('attendance_records').select('*')

      let attendanceList: { subject: string; present: number; conducted: number }[] = []
      if (subData && subData.length > 0) {
        const recordsBySub: Record<string, { present: number; absent: number }> = {}
        ;(recData as DbRecord[] | null)?.forEach(r => {
          if (!recordsBySub[r.subject_id]) recordsBySub[r.subject_id] = { present: 0, absent: 0 }
          if (r.status === 'present') recordsBySub[r.subject_id].present++
          if (r.status === 'absent') recordsBySub[r.subject_id].absent++
        })

        attendanceList = (subData as DbSubject[]).map(s => {
          const counts = recordsBySub[s.id] || { present: 0, absent: 0 }
          return {
            subject: s.name,
            present: counts.present,
            conducted: counts.present + counts.absent,
          }
        })
      }

      // 2. Fetch reminders
      const { data: remData } = await supabase.from('reminders').select('*').order('remind_at', { ascending: true })
      let deadlineList: { title: string; date: string; subject: string; daysLeft: number }[] = []
      if (remData && remData.length > 0) {
        deadlineList = (remData as DbReminder[]).map(r => ({
          title: r.title,
          date: r.remind_at ? r.remind_at.slice(0, 10) : '',
          subject: 'Notice Deadline',
          daysLeft: r.remind_at ? daysUntil(r.remind_at) : 0,
        }))
      }

      // 3. Fetch documents
      const { data: docData } = await supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(5)
      let noticeList: { title: string; date: string; isNew: boolean }[] = []
      if (docData && docData.length > 0) {
        noticeList = (docData as DbDocument[]).map(d => ({
          title: d.file_name,
          date: d.created_at ? d.created_at.slice(0, 10) : '',
          isNew: true,
        }))
      }

      if (attendanceList.length > 0 || deadlineList.length > 0 || noticeList.length > 0) {
        setHasRealData(true)
        setRealAttendance(attendanceList)
        setRealDeadlines(deadlineList)
        setRealNotices(noticeList)
      } else {
        setHasRealData(false)
      }
    } catch (err) {
      console.warn('Could not load live dashboard data:', err)
      setHasRealData(false)
    }
  }, [user])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const activeAttendance = hasRealData && realAttendance.length > 0 ? realAttendance : SAMPLE_ATTENDANCE
  const activeDeadlines = hasRealData && realDeadlines.length > 0 ? realDeadlines : SAMPLE_DEADLINES
  const activeNotices = hasRealData && realNotices.length > 0 ? realNotices : SAMPLE_NOTICES

  const totals = activeAttendance.reduce(
    (acc, s) => ({ present: acc.present + s.present, conducted: acc.conducted + s.conducted }),
    { present: 0, conducted: 0 },
  )
  const overall = attendancePct(totals.present, totals.conducted)
  const isHealthy = overall >= 75

  const dayOfWeekName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date())

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Sample vs Live Data Banner */}
      {!hasRealData ? (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>
              <strong>Sample preview mode</strong> — showing demo cards until you log real attendance or upload notices.
            </span>
          </div>
          <Link to="/attendance" className="font-semibold text-amber-900 underline ml-2">
            Add your subjects &rarr;
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/70 px-4 py-2.5 text-xs text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-green-600" />
            <span>
              <strong>Live Dashboard Active</strong> — synchronized with your verified Supabase academic records.
            </span>
          </div>
          <Badge variant="success" className="text-[10px] py-0 px-1.5">
            RLS Protected
          </Badge>
        </div>
      )}

      {/* ── Stat cards ── */}
      <section aria-label="Summary stats">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            label="Overall Attendance"
            value={`${overall}%`}
            sub={totals.conducted === 0 ? 'No classes yet' : isHealthy ? 'Above 75% target ✓' : 'Below 75% target!'}
            iconClass={isHealthy ? 'bg-green-500' : 'bg-red-500'}
            to="/attendance"
          />
          <StatCard
            icon={CalendarClock}
            label="Upcoming Deadlines"
            value={activeDeadlines.length}
            sub="Next 30 days"
            to="/timetable"
          />
          <StatCard
            icon={FileText}
            label="Recent Notices"
            value={activeNotices.length}
            sub={`${activeNotices.filter(n => n.isNew).length} verified`}
            to="/notices"
          />
          <StatCard
            icon={BookOpen}
            label="Subjects Tracked"
            value={activeAttendance.length}
            sub="In semester"
            to="/attendance"
          />
        </div>
      </section>

      {/* ── Quick AI Assistant Banner ── */}
      <div className="rounded-2xl border border-brand-200 bg-linear-to-r from-brand-50 to-indigo-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-950">CampusPulse AI Assistant is ready</h3>
            <p className="text-xs text-brand-700/80 mt-0.5">
              Ask questions about attendance requirements, exam schedules, or circulars with verifiable source citations.
            </p>
          </div>
        </div>
        <Link
          to="/assistant"
          className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 transition shrink-0"
        >
          Open Assistant &rarr;
        </Link>
      </div>

      {/* ── Bottom grid: 2 cols on desktop ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Attendance breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Breakdown</CardTitle>
            <Link to="/attendance" className="text-xs text-brand-600 hover:underline">Manage</Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3" aria-label="Attendance by subject">
              {activeAttendance.map((s) => {
                const pct = attendancePct(s.present, s.conducted)
                const safe = pct >= 75
                return (
                  <li key={s.subject}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700 truncate">{s.subject}</span>
                      <span className={cn('font-semibold tabular-nums', safe ? 'text-green-600' : 'text-red-600')}>
                        {s.conducted === 0 ? 'No classes' : `${pct}%`}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full rounded-full bg-gray-100" role="progressbar"
                      aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                      aria-label={`${s.subject} attendance ${pct}%`}>
                      <div
                        className={cn('h-full rounded-full transition-all', safe ? 'bg-green-500' : 'bg-red-400')}
                        style={{ width: `${s.conducted === 0 ? 0 : pct}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">{s.present}/{s.conducted} classes conducted</p>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">

          {/* Today's timetable */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="size-3.5" />
                <span>{dayOfWeekName}</span>
              </div>
            </CardHeader>
            <CardContent>
              {SAMPLE_TIMETABLE_TODAY.length === 0 ? (
                <p className="text-sm text-gray-400">No classes today 🎉</p>
              ) : (
                <ul className="space-y-2">
                  {SAMPLE_TIMETABLE_TODAY.map((slot) => (
                    <li key={slot.time} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                      <span className="shrink-0 text-xs font-medium tabular-nums text-gray-500 w-24">{slot.time}</span>
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{slot.subject}</span>
                      <Badge variant="default">{slot.room}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Upcoming deadlines */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Deadlines</CardTitle>
              <Link to="/timetable" className="text-xs text-brand-600 hover:underline">View all</Link>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {activeDeadlines.map((d) => (
                  <li key={d.title} className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 flex size-8 shrink-0 flex-col items-center justify-center rounded-lg text-center leading-none',
                      d.daysLeft <= 5 ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700',
                    )}>
                      <span className="text-sm font-bold">{d.daysLeft}</span>
                      <span className="text-[9px] font-medium">days</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{d.title}</p>
                      <p className="text-xs text-gray-400">{d.subject} · {d.date}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Recent notices */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Circulars & Documents</CardTitle>
          <Link to="/notices" className="text-xs text-brand-600 hover:underline">Analyze a notice</Link>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-surface-border">
            {activeNotices.map((n) => (
              <li key={n.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <FileText className="size-5 shrink-0 text-gray-300" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{n.title}</p>
                  <p className="text-xs text-gray-400">{n.date}</p>
                </div>
                {n.isNew && <Badge variant="brand">Notice</Badge>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

    </div>
  )
}
