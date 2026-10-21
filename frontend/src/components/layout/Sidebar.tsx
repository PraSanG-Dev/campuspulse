import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Calendar,
  MessageSquare,
  ChevronLeft,
  GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Navigation config ─────────────────────────────────────────────────────────
// Add or reorder items here — the sidebar renders from this array.

const navItems = [
  { to: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/attendance', label: 'Attendance', icon: CheckSquare },
  { to: '/notices',    label: 'Notices',    icon: FileText },
  { to: '/timetable',  label: 'Timetable',  icon: Calendar },
  { to: '/assistant',  label: 'AI Assistant', icon: MessageSquare },
] as const

// ── Props ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar({ isOpen, onToggle, onClose }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay — tap outside sidebar to close it */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          // Base: fixed on mobile, sticky on desktop
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-surface-border',
          'transition-[width] duration-200 ease-in-out',
          // Width toggles between expanded (224px) and icon-only (72px)
          isOpen ? 'w-56' : 'w-[72px]',
          // On mobile, slide off-screen when closed instead of collapsing
          !isOpen && 'max-md:-translate-x-full',
          'md:sticky md:top-0 md:h-screen md:translate-x-0',
        )}
        aria-label="Main navigation"
      >
        {/* ── Logo ── */}
        <div className="flex h-16 items-center gap-3 border-b border-surface-border px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
            <GraduationCap className="size-5 text-white" />
          </div>
          {isOpen && (
            <span className="font-bold text-gray-900 tracking-tight">
              Campus<span className="text-brand-600">Pulse</span>
            </span>
          )}
        </div>

        {/* ── Nav links ── */}
        <nav className="flex-1 overflow-y-auto py-4" aria-label="Sidebar navigation">
          <ul className="space-y-0.5 px-2">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname === to
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={() => {
                      // Close sidebar on mobile after navigating
                      if (window.innerWidth < 768) onClose()
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                      'transition-colors duration-100',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                    title={!isOpen ? label : undefined}
                  >
                    <Icon
                      className={cn('size-5 shrink-0', isActive ? 'text-brand-600' : 'text-gray-400')}
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                    {isOpen && <span className="truncate">{label}</span>}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ── Collapse toggle (desktop only) ── */}
        <div className="hidden border-t border-surface-border p-3 md:block">
          <button
            onClick={onToggle}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500',
              'hover:bg-gray-100 hover:text-gray-700 transition-colors',
            )}
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <ChevronLeft
              className={cn('size-5 shrink-0 transition-transform duration-200', !isOpen && 'rotate-180')}
            />
            {isOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
