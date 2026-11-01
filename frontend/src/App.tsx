import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { ToastProvider } from '@/components/ui/Toast'
import { NetworkErrorBoundary } from '@/components/ui/NetworkErrorBoundary'

import AuthPage   from '@/pages/Auth'
import Dashboard  from '@/pages/Dashboard'
import Attendance from '@/pages/Attendance'
import Notices    from '@/pages/Notices'
import Timetable  from '@/pages/Timetable'
import Assistant  from '@/pages/Assistant'

export default function App() {
  return (
    <NetworkErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public Auth Route */}
              <Route path="/login" element={<AuthPage />} />

              {/* Protected Routes inside AppLayout */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Navigate to="/dashboard" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Attendance />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notices"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Notices />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/timetable"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Timetable />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assistant"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Assistant />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </NetworkErrorBoundary>
  )
}
