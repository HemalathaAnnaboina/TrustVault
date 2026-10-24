'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  FileCheck2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react'
import { api, getToken, getUser, logout, UserProfile } from '../../lib/api'
import ThemeToggle from '../../components/ui/ThemeToggle'

const navItems = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'User Management', href: '/admin/users', icon: Users },
  { name: 'Projects', href: '/admin/projects', icon: FolderKanban },
  { name: 'Documents', href: '/admin/documents', icon: FileText },
  { name: 'Access & Permissions', href: '/admin/permissions', icon: LockKeyhole },
  { name: 'Access Requests', href: '/admin/requests', icon: FileCheck2 },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: Activity },
  { name: 'Security Events', href: '/admin/security-events', icon: ShieldAlert },
  { name: 'Settings', href: '/admin/settings', icon: Settings2 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState<number>(0)

  useEffect(() => {
    const token = getToken()
    const storedUser = getUser()

    if (!token || !storedUser) {
      router.replace('/login')
      return
    }

    if (storedUser.role !== 'ROLE_ADMIN') {
      if (storedUser.role === 'ROLE_MANAGER' || storedUser.role === 'ROLE_OWNER') {
        router.replace('/manager/dashboard')
      } else {
        router.replace('/viewer/dashboard')
      }
      return
    }

    setCurrentUser(storedUser)

    // Re-verify session validity server-side
    api
      .getMe()
      .then((profile) => {
        if (!profile.active) {
          logout()
          return
        }
        setCurrentUser(profile)
        setCheckingAuth(false)
      })
      .catch((err) => {
        console.warn('Session verification failed:', err)
        logout()
      })

    // Fetch pending request badge count
    api
      .getOwnerAccessRequests()
      .then((reqs) => {
        const count = reqs.filter((r) => r.status === 'PENDING').length
        setPendingCount(count)
      })
      .catch(() => setPendingCount(0))
  }, [router])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-[#1F2937]">
        <div className="flex items-center gap-3 text-xs font-semibold text-[#4B5563]">
          <div className="size-5 animate-spin rounded-full border-2 border-[#FACC15] border-t-transparent" />
          <span>Verifying security credentials and Admin authorization...</span>
        </div>
      </div>
    )
  }

  const currentNav = navItems.find((item) =>
    item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
  )

  const getInitials = (name?: string) => {
    if (!name) return 'AD'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#070D1E] text-[#1F2937] dark:text-[#F3F4F6] transition-colors duration-150">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Clean White with Yellow Accents */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-[#E5E7EB] dark:border-[#1E293B] px-5 bg-white dark:bg-[#0B1528]">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#FACC15] text-[#1F2937] shadow-xs ring-2 ring-yellow-400/30 font-black">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="text-[16px] font-bold tracking-tight text-[#1F2937] dark:text-white">TrustVault</div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#B45309] dark:text-amber-400">
                Admin Console
              </div>
            </div>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-neutral-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Admin Identity Card - Subtle Warm Background with Yellow Accents */}
        <div className="mx-4 mt-4 rounded-xl border border-[#FDE68A] dark:border-[#334155] bg-[#FFFBEB] dark:bg-[#070D1E] p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#92400E] dark:text-amber-400">
            Authenticated Identity
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="truncate text-xs font-bold text-[#1F2937] dark:text-white">{currentUser?.fullName}</p>
              <p className="truncate text-[10px] text-[#4B5563] dark:text-[#94A3B8]">{currentUser?.email}</p>
            </div>
            <span className="shrink-0 rounded-md bg-[#FACC15] px-2 py-0.5 text-[9px] font-black text-[#1F2937] border border-yellow-400/80 shadow-xs">
              ADMIN
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
          {navItems.map((item) => {
            const isActive =
              item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#FACC15] text-[#1F2937] shadow-xs ring-1 ring-yellow-400/50'
                    : 'text-[#4B5563] dark:text-[#94A3B8] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] hover:text-[#92400E] dark:hover:text-amber-300'
                }`}
              >
                <Icon
                  className={`size-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#1F2937]' : 'text-[#6B7280] dark:text-[#64748B] group-hover:text-[#B45309] dark:group-hover:text-amber-400'
                  }`}
                />
                <span className="truncate">{item.name}</span>
                {item.href === '/admin/requests' && pendingCount > 0 && (
                  <span className={`ml-auto text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${isActive ? 'bg-[#1F2937] text-white' : 'bg-[#FACC15] text-[#1F2937]'}`}>
                    {pendingCount}
                  </span>
                )}
                {isActive && !((item.href === '/admin/requests' && pendingCount > 0)) && (
                  <ChevronRight className="ml-auto size-3.5 text-[#1F2937]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer / System Status & Logout */}
        <div className="border-t border-[#E5E7EB] dark:border-[#1E293B] p-3.5 space-y-2 bg-white dark:bg-[#0B1528]">
          <div className="rounded-xl border border-[#FDE68A] dark:border-[#334155] bg-[#FFFBEB]/70 dark:bg-[#070D1E] p-2.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-[#1F2937] dark:text-white">Backend: Spring Boot 3</span>
            </div>
            <p className="mt-0.5 text-[10px] text-[#78350F] dark:text-[#94A3B8]">
              PostgreSQL 17 • Cryptographic Chaining
            </p>
          </div>

          <button
            onClick={() => logout()}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 text-xs font-bold text-rose-700 dark:text-rose-400 transition hover:bg-rose-100 dark:hover:bg-rose-950/40 cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="flex min-h-screen flex-col lg:pl-[260px]">
        {/* Top Header - Clean White with Yellow Accents */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E5E7EB] dark:border-[#1E293B] bg-white/95 dark:bg-[#0B1528]/95 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="grid size-9 place-items-center rounded-xl border border-[#E5E7EB] dark:border-[#334155] text-neutral-600 dark:text-neutral-300 hover:bg-[#FFFBEB] lg:hidden"
            >
              <Menu className="size-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] hidden sm:inline">Admin Console</span>
                <span className="text-neutral-300 dark:text-neutral-600 hidden sm:inline">/</span>
                <span className="inline-flex items-center rounded-lg bg-[#FFFBEB] dark:bg-[#1E293B] border border-[#FDE68A] dark:border-[#334155] px-2.5 py-1 text-xs font-bold text-[#92400E] dark:text-amber-400">
                  {currentNav?.name || 'Overview'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Live Vault Status */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Vault</span>
            </div>

            {/* Notification Icon */}
            <Link
              href="/admin/requests"
              title="Access Requests & Notifications"
              className="relative grid size-9 place-items-center rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#4B5563] dark:text-[#CBD5E1] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] hover:text-[#92400E] transition shadow-xs"
            >
              <Bell className="size-4" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#FACC15] text-[9px] font-black text-[#1F2937] ring-2 ring-white dark:ring-[#0B1528]">
                  {pendingCount}
                </span>
              )}
            </Link>

            {/* Settings Icon */}
            <Link
              href="/admin/settings"
              title="Admin Account & Security Settings"
              className="grid size-9 place-items-center rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#4B5563] dark:text-[#CBD5E1] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] hover:text-[#92400E] transition shadow-xs"
            >
              <Settings className="size-4" />
            </Link>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Admin Profile Avatar & Name */}
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-[#FFFBEB] dark:bg-[#0F172A] px-3 py-1.5 text-xs font-bold text-[#1F2937] dark:text-white hover:border-[#FACC15] transition shadow-xs"
            >
              <div className="grid size-6 place-items-center rounded-full bg-[#FACC15] text-[#1F2937] text-[10px] font-black ring-1 ring-yellow-400/50">
                {getInitials(currentUser?.fullName)}
              </div>
              <span className="hidden md:inline">{currentUser?.fullName || 'Sarah Admin'}</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>

        {/* Global Admin Footer */}
        <footer className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] px-6 py-3 text-center text-[11px] text-[#6B7280] dark:text-[#94A3B8]">
          TrustVault Enterprise Secure Vault • Document-Level Authorization & Cryptographic Audit Trails
        </footer>
      </div>
    </div>
  )
}
