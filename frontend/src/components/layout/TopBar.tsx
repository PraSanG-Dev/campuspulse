import { useState } from 'react'
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useNavigate } from 'react-router-dom'

interface TopBarProps {
  onMenuClick: () => void
  pageTitle: string
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return 'ST'
}

export function TopBar({ onMenuClick, pageTitle }: TopBarProps) {
  const { user, profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student'
  const initials = getInitials(profile?.full_name || user?.user_metadata?.full_name, user?.email)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-surface-border bg-white px-4 md:px-6">
      {/* Hamburger — only visible on mobile */}
      <button
        onClick={onMenuClick}
        className="flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Page title */}
      <h1 className="flex-1 text-base font-semibold text-gray-900 md:text-lg">{pageTitle}</h1>

      {/* Right side: notifications placeholder */}
      <button
        className="relative flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true" />
      </button>

      {/* User profile dropdown */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-50 transition"
          aria-expanded={menuOpen}
          aria-label="User profile menu"
        >
          <div
            className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 shadow-sm"
          >
            {initials}
          </div>
          <span className="hidden sm:inline-block max-w-[120px] truncate text-xs font-medium text-gray-700">
            {displayName}
          </span>
          <ChevronDown className="hidden sm:inline-block size-3.5 text-gray-400" />
        </button>

        {menuOpen && (
          <>
            {/* Backdrop for closing dropdown */}
            <div
              className="fixed inset-0 z-20"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-surface-border bg-white p-1.5 shadow-lg">
              <div className="border-b border-surface-border px-3 py-2 text-xs">
                <p className="font-semibold text-gray-800 truncate">{displayName}</p>
                <p className="text-gray-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition mt-1"
              >
                <LogOut className="size-4" />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
