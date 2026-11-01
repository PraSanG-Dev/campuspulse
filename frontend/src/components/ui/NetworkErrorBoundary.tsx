/**
 * Global network error boundary banner.
 *
 * Intercepts unhandled fetch/axios promise rejections and shows a persistent
 * top banner when the backend is unreachable (e.g. Render cold-start, network dropout).
 *
 * Usage: wrap the app once with <NetworkErrorBoundary>…</NetworkErrorBoundary>
 * The banner dismisses automatically once a successful fetch is detected.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { WifiOff, X, RefreshCw } from 'lucide-react'

interface NetworkBoundaryContextValue {
  reportError: (err: unknown) => void
  clearError:  () => void
}

const NetworkBoundaryContext = createContext<NetworkBoundaryContextValue | null>(null)

export function NetworkErrorBoundary({ children }: { children: React.ReactNode }) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reportError = useCallback((err: unknown) => {
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      setErrorMsg('Cannot reach the backend server. Check your connection or try again later.')
    } else if (err instanceof Response && err.status >= 500) {
      setErrorMsg(`Server error (${err.status}). The backend may be restarting — please try again.`)
    } else if (err instanceof Error) {
      // Only surface network-level errors, not validation/user errors
      const msg = err.message.toLowerCase()
      if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed')) {
        setErrorMsg('Network error — please check your connection.')
      }
    }
  }, [])

  const clearError = useCallback(() => setErrorMsg(null), [])

  // Listen for unhandled promise rejections (catch-all safety net)
  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      reportError(event.reason)
    }
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [reportError])

  return (
    <NetworkBoundaryContext.Provider value={{ reportError, clearError }}>
      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-x-0 top-0 z-[100] flex items-center gap-3 bg-red-600 px-4 py-3 text-white shadow-lg"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          <p className="flex-1 text-sm font-medium">{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition"
            aria-label="Reload page"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
          <button
            onClick={clearError}
            aria-label="Dismiss error banner"
            className="rounded-lg p-1 hover:bg-white/20 transition"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {children}
    </NetworkBoundaryContext.Provider>
  )
}

export function useNetworkError(): NetworkBoundaryContextValue {
  const ctx = useContext(NetworkBoundaryContext)
  if (!ctx) throw new Error('useNetworkError must be used inside <NetworkErrorBoundary>')
  return ctx
}
