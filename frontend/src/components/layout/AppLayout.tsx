import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useSidebar } from '@/hooks/useSidebar'

// Map URL paths to human-readable page titles for the TopBar
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/attendance': 'Attendance Tracker',
  '/notices':    'Notice Analyzer',
  '/timetable':  'Timetable & Deadlines',
  '/assistant':  'AI Assistant',
}

interface AppLayoutProps {
  children: React.ReactNode
}

/**
 * AppLayout wraps every authenticated page.
 *
 * Structure:
 *   <div flex-row>
 *     <Sidebar />          ← fixed/sticky left column
 *     <div flex-col>       ← takes remaining width
 *       <TopBar />         ← sticky top
 *       <main>             ← scrollable page content
 *         {children}
 *       </main>
 *     </div>
 *   </div>
 */
export function AppLayout({ children }: AppLayoutProps) {
  const { isOpen, toggle, close } = useSidebar()
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'CampusPulse'

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar isOpen={isOpen} onToggle={toggle} onClose={close} />

      {/* Main column — grows to fill space left by the sidebar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={toggle} pageTitle={title} />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
