/**
 * Lightweight toast notification system.
 * Usage:
 *   const { toast } = useToast()
 *   toast.success('Done!')
 *   toast.error('Something went wrong')
 *   toast.info('Heads up')
 *
 * Wrap your app in <ToastProvider> and it will render the portal automatically.
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
type ToastKind = 'success' | 'error' | 'info'

interface ToastMessage {
  id: string
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: {
    success: (msg: string) => void
    error: (msg: string) => void
    info: (msg: string) => void
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null)

// ── Single toast item ─────────────────────────────────────────────────────────
const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 shrink-0 text-green-500" />,
  error:   <XCircle      className="size-4 shrink-0 text-red-500" />,
  info:    <Info         className="size-4 shrink-0 text-brand-500" />,
}

const BORDER_COLOR: Record<ToastKind, string> = {
  success: 'border-green-200',
  error:   'border-red-200',
  info:    'border-brand-200',
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg',
        'animate-in slide-in-from-right-5 duration-200',
        BORDER_COLOR[toast.kind],
      )}
    >
      {ICONS[toast.kind]}
      <p className="flex-1 text-sm font-medium text-gray-800">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-gray-400 hover:text-gray-600 transition"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const counterRef = useRef(0)

  const add = useCallback((kind: ToastKind, message: string) => {
    counterRef.current += 1
    const id = `toast-${counterRef.current}`
    setToasts(prev => [...prev.slice(-4), { id, kind, message }]) // max 5 visible
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (msg: string) => add('success', msg),
    error:   (msg: string) => add('error', msg),
    info:    (msg: string) => add('info', msg),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Portal: fixed bottom-right corner */}
      <div
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
