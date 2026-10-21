import { Menu, Bell } from 'lucide-react'

interface TopBarProps {
  onMenuClick: () => void
  pageTitle: string
}

/**
 * TopBar — the horizontal bar at the top of every page.
 *
 * On mobile it shows a hamburger menu to open the sidebar.
 * On desktop the sidebar is always visible so the hamburger hides.
 */
export function TopBar({ onMenuClick, pageTitle }: TopBarProps) {
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
        className="relative flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {/* Red dot — will become real in Phase 4 */}
        <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500" aria-hidden="true" />
      </button>

      {/* Avatar placeholder — real auth in Phase 4 */}
      <div
        className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700"
        aria-label="User account"
      >
        ST
      </div>
    </header>
  )
}
