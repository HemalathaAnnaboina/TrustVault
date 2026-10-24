'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderKanban,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react'
import { api, AuditLogItem, AuditVerificationResult, RoleStats } from '../../lib/api'

export default function AdminOverviewPage() {
  const router = useRouter()
  const [stats, setStats] = useState<RoleStats | null>(null)
  const [recentAlerts, setRecentAlerts] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<AuditVerificationResult | null>(null)

  // Explicit user status counts for statistics cards
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0)
  const [suspendedUsersCount, setSuspendedUsersCount] = useState<number>(0)
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0)
  const [totalProjectsCount, setTotalProjectsCount] = useState<number>(0)
  const [securityAlertsCount, setSecurityAlertsCount] = useState<number>(0)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsData, alertsData, usersData, projectsData, deniedLogs] = await Promise.all([
        api.getStats().catch((err) => {
          console.error('Stats error:', err)
          return null
        }),
        api.getAuditLogs({ size: 6, result: 'DENIED' }).catch((err) => {
          console.error('Alerts error:', err)
          return []
        }),
        api.getAdminUsers().catch(() => []),
        api.getProjects().catch(() => []),
        api.getAuditLogs({ result: 'DENIED' }).catch(() => []),
      ])

      if (statsData) {
        setStats(statsData)
      }

      // Compute statistics directly from verified data
      const activeCount = usersData.filter((u: any) => u.active).length
      const suspendedCount = usersData.filter((u: any) => !u.active).length
      setActiveUsersCount(activeCount)
      setSuspendedUsersCount(suspendedCount)
      setTotalUsersCount(usersData.length)
      setTotalProjectsCount(projectsData.length)
      setSecurityAlertsCount(deniedLogs.length)

      setRecentAlerts(alertsData)
    } catch (err: any) {
      setError(err.message || 'Failed to load system metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleVerifyIntegrity = async () => {
    setVerifying(true)
    try {
      const res = await api.verifyAuditIntegrity()
      setVerificationResult(res)
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        totalRecords: 0,
        verifiedCount: 0,
        brokenRecordId: null,
        message: err.message || 'Integrity check failed',
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome - Clean White with Yellow Accents */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="size-2 rounded-full bg-[#FACC15] ring-2 ring-yellow-400/40" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#92400E] dark:text-amber-400">
              Administrative Control Center
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937] dark:text-white">
            System Governance Overview
          </h2>
          <p className="mt-1 text-xs text-[#4B5563] dark:text-[#94A3B8]">
            Real-time administrative monitoring, user account provisioning, project workspaces, and cryptographic audit oversight.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3.5 text-xs font-bold text-[#1F2937] dark:text-[#CBD5E1] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] hover:text-[#92400E] transition shadow-xs disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-amber-500' : 'text-[#6B7280]'}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/admin/users?action=new"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] px-4 text-xs font-bold text-[#1F2937] transition shadow-xs cursor-pointer"
          >
            <UserPlus className="size-3.5 text-[#1F2937]" />
            <span>Create User</span>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/20 p-4 text-xs font-medium text-red-800 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="mt-2 text-xs font-bold underline hover:text-red-900 dark:hover:text-red-200"
          >
            Retry Loading Metrics
          </button>
        </div>
      )}

      {/* 5 DATA-DRIVEN STATISTICS CARDS (Subtle Yellow Accents, Mostly White Body) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Card 1: Total Users */}
        <Link
          href="/admin/users"
          className="group flex flex-col justify-between rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-5 shadow-xs transition hover:border-[#FACC15] hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">Total Users</p>
              {loading ? (
                <div className="mt-2 h-7 w-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              ) : (
                <p className="mt-1 text-2xl font-black text-[#1F2937] dark:text-white">{totalUsersCount}</p>
              )}
              <p className="mt-1 text-[11px] font-semibold text-[#92400E] dark:text-amber-400">Registered Accounts</p>
            </div>
            <div className="grid size-11 place-items-center rounded-2xl bg-[#FFFBEB] dark:bg-[#1E293B] text-[#92400E] dark:text-amber-400 border border-[#FDE68A] dark:border-[#334155] transition group-hover:bg-[#FACC15] group-hover:text-[#1F2937] group-hover:border-[#EAB308]">
              <Users className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] dark:border-[#1E293B] pt-3 text-[11px] font-bold text-[#6B7280] dark:text-[#94A3B8] group-hover:text-[#92400E] dark:group-hover:text-amber-400">
            <span>Manage accounts</span>
            <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 2: Active Users */}
        <Link
          href="/admin/users"
          className="group flex flex-col justify-between rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-5 shadow-xs transition hover:border-[#FACC15] hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">Active Users</p>
              {loading ? (
                <div className="mt-2 h-7 w-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              ) : (
                <p className="mt-1 text-2xl font-black text-[#1F2937] dark:text-white">{activeUsersCount}</p>
              )}
              <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Fully Authorized</p>
            </div>
            <div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition group-hover:bg-[#FACC15] group-hover:text-[#1F2937] group-hover:border-[#EAB308]">
              <UserCheck className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] dark:border-[#1E293B] pt-3 text-[11px] font-bold text-[#6B7280] dark:text-[#94A3B8] group-hover:text-[#92400E] dark:group-hover:text-amber-400">
            <span>Active credentials</span>
            <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 3: Suspended Users */}
        <Link
          href="/admin/users"
          className="group flex flex-col justify-between rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-5 shadow-xs transition hover:border-[#FACC15] hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">Suspended Users</p>
              {loading ? (
                <div className="mt-2 h-7 w-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              ) : (
                <p className="mt-1 text-2xl font-black text-[#1F2937] dark:text-white">{suspendedUsersCount}</p>
              )}
              <p className="mt-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400">Access Blocked</p>
            </div>
            <div className="grid size-11 place-items-center rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 transition group-hover:bg-[#FACC15] group-hover:text-[#1F2937] group-hover:border-[#EAB308]">
              <UserX className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] dark:border-[#1E293B] pt-3 text-[11px] font-bold text-[#6B7280] dark:text-[#94A3B8] group-hover:text-[#92400E] dark:group-hover:text-amber-400">
            <span>Review suspensions</span>
            <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 4: Projects */}
        <Link
          href="/admin/projects"
          className="group flex flex-col justify-between rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-5 shadow-xs transition hover:border-[#FACC15] hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">Projects</p>
              {loading ? (
                <div className="mt-2 h-7 w-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              ) : (
                <p className="mt-1 text-2xl font-black text-[#1F2937] dark:text-white">{totalProjectsCount}</p>
              )}
              <p className="mt-1 text-[11px] font-semibold text-[#92400E] dark:text-amber-400">Active Workspaces</p>
            </div>
            <div className="grid size-11 place-items-center rounded-2xl bg-[#FFFBEB] dark:bg-[#1E293B] text-[#92400E] dark:text-amber-400 border border-[#FDE68A] dark:border-[#334155] transition group-hover:bg-[#FACC15] group-hover:text-[#1F2937] group-hover:border-[#EAB308]">
              <FolderKanban className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] dark:border-[#1E293B] pt-3 text-[11px] font-bold text-[#6B7280] dark:text-[#94A3B8] group-hover:text-[#92400E] dark:group-hover:text-amber-400">
            <span>Monitor projects</span>
            <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 5: Security Events */}
        <Link
          href="/admin/security-events"
          className="group flex flex-col justify-between rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-5 shadow-xs transition hover:border-[#FACC15] hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">Security Events</p>
              {loading ? (
                <div className="mt-2 h-7 w-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              ) : (
                <p className="mt-1 text-2xl font-black text-[#1F2937] dark:text-white">{securityAlertsCount}</p>
              )}
              <p className="mt-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">Access Violations</p>
            </div>
            <div className="grid size-11 place-items-center rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition group-hover:bg-[#FACC15] group-hover:text-[#1F2937] group-hover:border-[#EAB308]">
              <ShieldAlert className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] dark:border-[#1E293B] pt-3 text-[11px] font-bold text-[#6B7280] dark:text-[#94A3B8] group-hover:text-[#92400E] dark:group-hover:text-amber-400">
            <span>View audit logs</span>
            <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
          </div>
        </Link>
      </div>

      {/* Middle Section: Quick Operations & Cryptographic Chain Integrity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Administrative Operations */}
        <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-[#F3F4F6] dark:border-[#1E293B] pb-3 mb-4">
            <span className="size-2 rounded-full bg-[#FACC15]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#92400E] dark:text-amber-400">
              Quick Administrative Actions
            </h3>
          </div>

          <div className="space-y-2.5">
            <Link
              href="/admin/users"
              className="flex items-center justify-between rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#070D1E] p-3 text-xs font-bold text-[#1F2937] dark:text-white transition hover:border-[#FACC15] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B]"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-[#FFFBEB] dark:bg-[#1E293B] text-[#92400E] dark:text-amber-400 border border-[#FDE68A] dark:border-[#334155]">
                  <Users className="size-4" />
                </div>
                <div>
                  <div className="font-bold">Manage User Accounts</div>
                  <div className="text-[10px] text-[#6B7280] dark:text-[#94A3B8]">Activate, suspend &amp; assign roles</div>
                </div>
              </div>
              <ArrowRight className="size-4 text-[#9CA3AF]" />
            </Link>

            <Link
              href="/admin/projects"
              className="flex items-center justify-between rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#070D1E] p-3 text-xs font-bold text-[#1F2937] dark:text-white transition hover:border-[#FACC15] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B]"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-[#FFFBEB] dark:bg-[#1E293B] text-[#92400E] dark:text-amber-400 border border-[#FDE68A] dark:border-[#334155]">
                  <FolderKanban className="size-4" />
                </div>
                <div>
                  <div className="font-bold">Monitor Project Workspaces</div>
                  <div className="text-[10px] text-[#6B7280] dark:text-[#94A3B8]">Inspect team assignments &amp; docs</div>
                </div>
              </div>
              <ArrowRight className="size-4 text-[#9CA3AF]" />
            </Link>

            <Link
              href="/admin/audit-logs"
              className="flex items-center justify-between rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#070D1E] p-3 text-xs font-bold text-[#1F2937] dark:text-white transition hover:border-[#FACC15] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B]"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-[#FFFBEB] dark:bg-[#1E293B] text-[#92400E] dark:text-amber-400 border border-[#FDE68A] dark:border-[#334155]">
                  <Activity className="size-4" />
                </div>
                <div>
                  <div className="font-bold">Cryptographic Audit Trail</div>
                  <div className="text-[10px] text-[#6B7280] dark:text-[#94A3B8]">Immutable SHA-256 chain log</div>
                </div>
              </div>
              <ArrowRight className="size-4 text-[#9CA3AF]" />
            </Link>
          </div>
        </div>

        {/* Cryptographic Chain Integrity Card */}
        <div className="lg:col-span-2 rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#92400E] dark:text-amber-400">
                  Cryptographic Chain Integrity
                </h3>
              </div>
              <span className="rounded-full bg-[#FFFBEB] dark:bg-[#1E293B] border border-[#FDE68A] dark:border-[#334155] px-2.5 py-0.5 text-[10px] font-bold text-[#92400E] dark:text-amber-400">
                SHA-256 Chained
              </span>
            </div>

            <p className="mt-2.5 text-xs text-[#4B5563] dark:text-[#94A3B8] leading-relaxed">
              TrustVault records every security, authorization, and vault event into an append-only ledger.
              Each record cryptographically binds the previous record&apos;s SHA-256 hash, preventing unauthorized tampering, deletion, or backdating.
            </p>

            {verificationResult && (
              <div
                className={`mt-4 rounded-xl border p-3.5 text-xs font-bold ${
                  verificationResult.valid
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                    : 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300'
                }`}
              >
                {verificationResult.valid ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p>✓ AUDIT CHAIN VERIFIED INTACT &amp; UNTAMPERED</p>
                      <p className="mt-0.5 text-[11px] font-normal opacity-90">
                        Verified {verificationResult.verifiedCount} records from Genesis block. Hash signatures validate cleanly.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    <div>
                      <p>⚠️ TAMPERING DETECTED IN AUDIT LEDGER</p>
                      <p className="mt-0.5 text-[11px] font-normal opacity-90">
                        {verificationResult.message}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] dark:border-[#1E293B] pt-4">
            <span className="text-[11px] text-[#6B7280] dark:text-[#94A3B8]">
              Algorithm: Monotonic timestamping + HMAC-SHA256
            </span>
            <button
              onClick={handleVerifyIntegrity}
              disabled={verifying}
              className="flex h-9 items-center gap-2 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] px-4 text-xs font-bold text-[#1F2937] transition shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <ShieldCheck className={`size-4 text-[#1F2937] ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Verifying Hashes...' : 'Verify Chain Integrity'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Security Violations Table */}
      <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] overflow-hidden shadow-xs">
        {/* Yellow-Highlighted Table Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#FDE68A] dark:border-[#1E293B] bg-[#FFFBEB] dark:bg-[#0F172A] p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#FACC15]" />
              <h3 className="text-sm font-bold text-[#1F2937] dark:text-white">Recent Security Events</h3>
            </div>
            <p className="mt-0.5 text-xs text-[#78350F] dark:text-[#94A3B8]">
              Denied access attempts, deactivated user requests, and authorization policy violations
            </p>
          </div>
          <Link
            href="/admin/security-events"
            className="flex items-center gap-1.5 text-xs font-bold text-[#92400E] dark:text-amber-400 hover:text-[#B45309] hover:underline"
          >
            <span>View All Security Incidents</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#6B7280] dark:text-[#94A3B8]">
            No recent security violations recorded. System operating securely.
          </div>
        ) : (
          <div className="divide-y divide-[#F3F4F6] dark:divide-[#1E293B] overflow-x-auto">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs hover:bg-[#FFFBEB]/40 dark:hover:bg-[#1E293B]/40 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40">
                    <ShieldAlert className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#1F2937] dark:text-white truncate">{alert.reason}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[#6B7280] dark:text-[#94A3B8]">
                      <span>Actor: <strong className="text-[#1F2937] dark:text-[#CBD5E1]">{alert.actorEmail}</strong></span>
                      <span>•</span>
                      <span>Action: <strong className="text-[#92400E] dark:text-amber-400">{alert.action}</strong></span>
                      <span>•</span>
                      <span>Resource: {alert.resourceType} ({alert.resourceId?.slice(0, 8)}...)</span>
                      {alert.ipAddress && (
                        <>
                          <span>•</span>
                          <span>IP: {alert.ipAddress}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-[#6B7280] dark:text-[#94A3B8]">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="rounded-full bg-rose-100 dark:bg-rose-950/60 px-2.5 py-0.5 text-[9px] font-black text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    DENIED
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
