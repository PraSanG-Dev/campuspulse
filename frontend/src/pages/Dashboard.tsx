import { BookOpen, CalendarClock, FileText, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

// ── Sample data ───────────────────────────────────────────────────────────────
// Everything in this section is CLEARLY LABELED as sample/demo data.
// It will be replaced with real Supabase data in Phase 4.

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

function overallAttendance(): number {
  const totals = SAMPLE_ATTENDANCE.reduce(
    (acc, s) => ({ present: acc.present + s.present, conducted: acc.conducted + s.conducted }),
    { present: 0, conducted: 0 },
  )
  return attendancePct(totals.present, totals.conducted)
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
  const overall = overallAttendance()
  const isHealthy = overall >= 75

  return (
    <div className="space-y-6">

      {/* Sample data notice — always visible until real data replaces it */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
        <AlertCircle className="size-4 shrink-0" />
        <span>
          <strong>Sample data</strong> — this is demo content only. Add your real attendance and notices after setup.
        </span>
      </div>

      {/* ── Stat cards ── */}
      <section aria-label="Summary stats">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            label="Overall Attendance"
            value={`${overall}%`}
            sub={isHealthy ? 'Above 75% target ✓' : 'Below 75% target!'}
            iconClass={isHealthy ? 'bg-green-500' : 'bg-red-500'}
            to="/attendance"
          />
          <StatCard
            icon={CalendarClock}
            label="Upcoming Deadlines"
            value={SAMPLE_DEADLINES.length}
            sub="Next 30 days"
            to="/timetable"
          />
          <StatCard
            icon={FileText}
            label="Recent Notices"
            value={SAMPLE_NOTICES.length}
            sub={`${SAMPLE_NOTICES.filter(n => n.isNew).length} new`}
            to="/notices"
          />
          <StatCard
            icon={BookOpen}
            label="Subjects"
            value={SAMPLE_ATTENDANCE.length}
            sub="Tracked"
            to="/attendance"
          />
        </div>
      </section>

      {/* ── Bottom grid: 2 cols on desktop ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Attendance breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Breakdown</CardTitle>
            <Link to="/attendance" className="text-xs text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3" aria-label="Attendance by subject">
              {SAMPLE_ATTENDANCE.map((s) => {
                const pct = attendancePct(s.present, s.conducted)
                const safe = pct >= 75
                return (
                  <li key={s.subject}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700 truncate">{s.subject}</span>
                      <span className={cn('font-semibold tabular-nums', safe ? 'text-green-600' : 'text-red-600')}>
                        {pct}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full rounded-full bg-gray-100" role="progressbar"
                      aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                      aria-label={`${s.subject} attendance ${pct}%`}>
                      <div
                        className={cn('h-full rounded-full transition-all', safe ? 'bg-green-500' : 'bg-red-400')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">{s.present}/{s.conducted} classes</p>
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
              <CardTitle>Today's Classes</CardTitle>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="size-3.5" />
                <span>Wednesday</span>
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
                {SAMPLE_DEADLINES.map((d) => (
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
          <CardTitle>Recent Notices</CardTitle>
          <Link to="/notices" className="text-xs text-brand-600 hover:underline">Analyze a notice</Link>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-surface-border">
            {SAMPLE_NOTICES.map((n) => (
              <li key={n.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <FileText className="size-5 shrink-0 text-gray-300" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{n.title}</p>
                  <p className="text-xs text-gray-400">{n.date}</p>
                </div>
                {n.isNew && <Badge variant="brand">New</Badge>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

    </div>
  )
}
