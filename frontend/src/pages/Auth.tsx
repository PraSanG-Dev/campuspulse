import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GraduationCap, Lock, Mail, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { signIn, signUp, isConfigured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.')
      return
    }

    if (isSignUp && !fullName.trim()) {
      setErrorMsg('Please enter your full name.')
      return
    }

    setSubmitting(true)

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName.trim())
        if (error) {
          setErrorMsg(error.message)
        } else {
          setSuccessMsg('Account created successfully! Signing you in...')
          setTimeout(() => {
            navigate(destination, { replace: true })
          }, 1000)
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setErrorMsg(error.message)
        } else {
          navigate(destination, { replace: true })
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setErrorMsg(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo and header */}
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-600 shadow-md shadow-brand-500/20">
            <GraduationCap className="size-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
            Campus<span className="text-brand-600">Pulse</span>
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Your verified AI college companion & academic tracker
          </p>
        </div>

        {/* Supabase credentials status reminder if still using placeholder */}
        {!isConfigured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertCircle className="size-4 shrink-0 text-amber-600" />
              <span>Supabase Connection Needed</span>
            </div>
            <p>
              To enable live authentication & RLS database storage, paste your real Supabase project URL and anon public key into <code className="rounded bg-amber-100 px-1 py-0.5">frontend/.env.local</code>.
            </p>
          </div>
        )}

        <Card className="border-surface-border shadow-sm">
          <CardHeader className="border-b border-surface-border pb-4">
            <div className="flex w-full items-center justify-center rounded-lg bg-gray-100 p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setErrorMsg(null); setSuccessMsg(null) }}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-center transition-all',
                  !isSignUp ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setErrorMsg(null); setSuccessMsg(null) }}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-center transition-all',
                  isSignUp ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                )}
              >
                Create Account
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {errorMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600" htmlFor="name">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 size-4 text-gray-400" />
                    <input
                      id="name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alex Sharma"
                      className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600" htmlFor="email">
                  College Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@college.edu"
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                {isSignUp && (
                  <p className="mt-1 text-[11px] text-gray-400">At least 6 characters required</p>
                )}
              </div>

              <Button
                type="submit"
                isLoading={submitting}
                className="w-full mt-2"
                size="md"
              >
                <span>{isSignUp ? 'Create Student Account' : 'Sign In'}</span>
                <ArrowRight className="size-4 ml-1" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400">
          Protected by Supabase Row-Level Security (RLS). Your records are never visible to other students.
        </p>
      </div>
    </div>
  )
}
