import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Spinner } from '@/components/ui/Spinner'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-gray-500">Loading CampusPulse...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    // Redirect to login page and remember where the student wanted to go
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
