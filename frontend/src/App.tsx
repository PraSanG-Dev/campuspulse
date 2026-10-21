import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Pages — we'll flesh these out in Phase 2
import Dashboard from '@/pages/Dashboard'
import Attendance from '@/pages/Attendance'
import Notices from '@/pages/Notices'
import Timetable from '@/pages/Timetable'
import Assistant from '@/pages/Assistant'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/notices" element={<Notices />} />
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/assistant" element={<Assistant />} />
        {/* Catch-all: redirect unknown URLs to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
