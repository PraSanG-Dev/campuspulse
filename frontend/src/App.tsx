import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'

import Dashboard  from '@/pages/Dashboard'
import Attendance from '@/pages/Attendance'
import Notices    from '@/pages/Notices'
import Timetable  from '@/pages/Timetable'
import Assistant  from '@/pages/Assistant'

export default function App() {
  return (
    <BrowserRouter>
      {/*
        AppLayout wraps all routes so the sidebar + topbar are always present.
        In Phase 4 we'll add auth: unauthenticated users will be redirected
        to a /login page that renders WITHOUT AppLayout.
      */}
      <AppLayout>
        <Routes>
          <Route path="/"           element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/notices"    element={<Notices />} />
          <Route path="/timetable"  element={<Timetable />} />
          <Route path="/assistant"  element={<Assistant />} />
          <Route path="*"           element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
