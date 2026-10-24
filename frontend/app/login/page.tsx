'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Server,
  LockKeyhole
} from 'lucide-react'
import { api, getToken, getUser } from '../../lib/api'
import ThemeToggle from '../../components/ui/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  // Redirect if already authenticated
  useEffect(() => {
    const token = getToken()
    const user = getUser()
    if (token && user) {
      if (user.role === 'ROLE_ADMIN') {
        router.replace('/admin')
      } else if (user.role === 'ROLE_OWNER' || user.role === 'ROLE_MANAGER') {
        router.replace('/manager/dashboard')
      } else {
        router.replace('/viewer/dashboard')
      }
    }
  }, [router])

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {}
    if (!email.trim()) {
      errors.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address'
    }

    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!validate()) return

    setLoading(true)
    try {
      const data = await api.login(email.trim(), password)
      if (data.role === 'ROLE_ADMIN') {
        router.push('/admin')
      } else if (data.role === 'ROLE_OWNER' || data.role === 'ROLE_MANAGER') {
        router.push('/manager/dashboard')
      } else {
        router.push('/viewer/dashboard')
      }
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('rate limit')) {
        setErrorMessage('Too many login attempts. Please wait 60 seconds.')
      } else if (err.message && (err.message.includes('401') || err.message.includes('Invalid') || err.message.includes('deactivated'))) {
        setErrorMessage(err.message || 'Invalid email or password.')
      } else if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        setErrorMessage('Cannot connect to backend server. Ensure Spring Boot is running on port 8080.')
      } else {
        setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  const quickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail)
    setPassword(demoPass)
    setFieldErrors({})
    setErrorMessage(null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#27272A]">
      {/* Top Header */}
      <header className="flex h-16 items-center justify-between border-b border-[#E4E4E7] bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[#FACC15] text-[#27272A] shadow-xs">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold tracking-tight text-[#27272A]">TrustVault</span>
            <span className="text-xs font-semibold text-[#71717A]">Document Security</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1 text-xs font-bold text-[#92400E]">
            <span className="size-2 rounded-full bg-[#EAB308] animate-pulse"></span>
            Enterprise Security
          </div>
        </div>
      </header>

      {/* Main Login Container */}
      <main className="flex flex-1 items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="rounded-2xl border border-[#E4E4E7] bg-white p-8 shadow-xs">
            {/* Header info */}
            <div className="text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
                <ShieldCheck className="size-6 text-[#92400E]" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#27272A]">
                Welcome Back
              </h1>
              <p className="mt-1 text-xs text-[#71717A]">
                Sign in to securely access your documents.
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#27272A] mb-1.5">Company Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 size-4 text-[#71717A]" />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined })
                    }}
                    placeholder="name@company.com"
                    className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs text-[#27272A] placeholder:text-[#A1A1AA] transition focus:outline-none focus:ring-2 ${
                      fieldErrors.email
                        ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500 focus:ring-rose-200'
                        : 'border-[#E4E4E7] bg-white focus:border-[#FACC15] focus:ring-[#FACC15]'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#27272A] mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 size-4 text-[#71717A]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined })
                    }}
                    placeholder="••••••••••••"
                    className={`w-full rounded-xl border py-2.5 pl-9 pr-10 text-xs text-[#27272A] placeholder:text-[#A1A1AA] transition focus:outline-none focus:ring-2 ${
                      fieldErrors.password
                        ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500 focus:ring-rose-200'
                        : 'border-[#E4E4E7] bg-white focus:border-[#FACC15] focus:ring-[#FACC15]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 p-0.5 text-[#71717A] hover:text-[#27272A] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">{fieldErrors.password}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] px-4 text-xs font-bold text-[#27272A] shadow-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="size-4 animate-spin rounded-full border-2 border-[#27272A] border-t-transparent" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="size-4 text-[#27272A]" />
                  </>
                )}
              </button>
            </form>

            {/* Enterprise Provisioning Notice */}
            <div className="mt-6 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#92400E]">
                <LockKeyhole className="size-3.5 text-[#92400E]" />
                <span>Enterprise Account Provisioning</span>
              </div>
              <p className="mt-1 text-[11px] text-[#71717A] leading-relaxed">
                TrustVault accounts are provisioned by corporate Administrators and Managers. Anonymous public registration is disabled.
              </p>
            </div>
          </div>

          {/* Development Quick-Fill Helper */}
          <div className="mt-6 rounded-2xl border border-[#E4E4E7] bg-white p-4 text-xs shadow-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#27272A]">
              <Server className="size-3.5 text-[#92400E]" />
              <span>Verified Active Demo Accounts</span>
            </div>
            <p className="mt-1 text-[11px] text-[#71717A]">
              Click a role to autofill verified seeded credentials:
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => quickFill('admin@trustvault.local', 'TrustVault@2025!')}
                className="rounded-xl border border-[#E4E4E7] bg-white p-2.5 text-center text-[11px] font-semibold text-[#27272A] transition hover:border-[#FACC15] hover:bg-[#FFFBEB] cursor-pointer"
              >
                <div className="font-extrabold text-[#27272A]">ADMIN</div>
                <div className="text-[10px] text-[#71717A]">Sarah Admin</div>
              </button>
              <button
                type="button"
                onClick={() => quickFill('owner@trustvault.local', 'TrustVault@2025!')}
                className="rounded-xl border border-[#E4E4E7] bg-white p-2.5 text-center text-[11px] font-semibold text-[#27272A] transition hover:border-[#FACC15] hover:bg-[#FFFBEB] cursor-pointer"
              >
                <div className="font-extrabold text-[#92400E]">MANAGER</div>
                <div className="text-[10px] text-[#71717A]">Elena Vance</div>
              </button>
              <button
                type="button"
                onClick={() => quickFill('viewer@trustvault.local', 'TrustVault@2025!')}
                className="rounded-xl border border-[#E4E4E7] bg-white p-2.5 text-center text-[11px] font-semibold text-[#27272A] transition hover:border-[#FACC15] hover:bg-[#FFFBEB] cursor-pointer"
              >
                <div className="font-extrabold text-[#27272A]">VIEWER</div>
                <div className="text-[10px] text-[#71717A]">Sam Williams</div>
              </button>
              <button
                type="button"
                onClick={() => quickFill('editor@trustvault.local', 'TrustVault@2025!')}
                className="rounded-xl border border-[#E4E4E7] bg-white p-2.5 text-center text-[11px] font-semibold text-[#27272A] transition hover:border-[#FACC15] hover:bg-[#FFFBEB] cursor-pointer"
              >
                <div className="font-extrabold text-[#92400E]">EDITOR</div>
                <div className="text-[10px] text-[#71717A]">Alex Rivera</div>
              </button>
            </div>
            <p className="mt-2 text-[10px] text-[#71717A] text-center">
              Active demo password: <code className="font-mono font-bold text-[#27272A]">TrustVault@2025!</code>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E4E4E7] bg-white py-4 text-center text-xs text-[#71717A]">
        Secure Document Management • TrustVault
      </footer>
    </div>
  )
}
