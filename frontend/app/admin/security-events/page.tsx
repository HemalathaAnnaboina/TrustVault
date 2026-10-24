'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Flame,
  Globe,
  Hash,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldX,
  UserX,
  X,
} from 'lucide-react'
import { api, AuditLogItem } from '../../../lib/api'

export default function AdminSecurityEventsPage() {
  const [events, setEvents] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [eventFilter, setEventFilter] = useState('ALL')
  const [selectedEvent, setSelectedEvent] = useState<AuditLogItem | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 12

  const loadSecurityEvents = async () => {
    setLoading(true)
    try {
      // Security events are all DENIED results + explicit security violation action types
      const data = await api.getAuditLogs({
        result: 'DENIED',
      })
      setEvents(data)
    } catch (err: any) {
      console.error('Failed to load security events:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSecurityEvents()
  }, [])

  // Metrics breakdown
  const metrics = useMemo(() => {
    return {
      total: events.length,
      unauthorized: events.filter((e) => e.action === 'UNAUTHORIZED_ACCESS_ATTEMPT').length,
      inactiveUser: events.filter((e) => e.action === 'INACTIVE_USER_ACCESS_ATTEMPT').length,
      authFailures: events.filter((e) => e.action === 'LOGIN_FAILURE').length,
      expiredAttempts: events.filter((e) => e.action === 'PERMISSION_EXPIRED_ATTEMPT').length,
    }
  }, [events])

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const q = query.toLowerCase()
      const matchesQuery =
        !query ||
        e.actorEmail.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.reason && e.reason.toLowerCase().includes(q)) ||
        (e.ipAddress && e.ipAddress.toLowerCase().includes(q)) ||
        (e.resourceId && e.resourceId.toLowerCase().includes(q))

      const matchesFilter =
        eventFilter === 'ALL' || e.action === eventFilter

      return matchesQuery && matchesFilter
    })
  }, [events, query, eventFilter])

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize))
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredEvents.slice(start, start + pageSize)
  }, [filteredEvents, currentPage])

  const getSeverity = (action: string) => {
    if (action === 'UNAUTHORIZED_ACCESS_ATTEMPT' || action === 'INACTIVE_USER_ACCESS_ATTEMPT') {
      return { label: 'HIGH', bg: 'bg-red-50 text-red-700 border-red-200' }
    }
    if (action === 'LOGIN_FAILURE') {
      return { label: 'MEDIUM', bg: 'bg-amber-50 text-amber-700 border-amber-200' }
    }
    return { label: 'SUSPICIOUS', bg: 'bg-purple-50 text-purple-700 border-purple-200' }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#14213d]">Security Incident & Threat Monitoring</h2>
            <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10px] font-bold text-red-700">
              {metrics.total} Recorded Violations
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Inspect real-time security alerts, blocked access attempts, inactive account requests, and authorization policy enforcement events.
          </p>
        </div>

        <button
          onClick={loadSecurityEvents}
          disabled={loading}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e2eaf5] bg-white px-3 text-xs font-bold text-[#475569] hover:bg-[#f8fbff] disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-[#2463eb]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 4 Threat Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#64748b]">Total Violations</p>
              <p className="mt-1 text-2xl font-extrabold text-[#14213d]">{metrics.total}</p>
              <p className="mt-1 text-[11px] font-semibold text-rose-600">All Denied Operations</p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <ShieldAlert className="size-6" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#64748b]">Unauthorized Access</p>
              <p className="mt-1 text-2xl font-extrabold text-[#14213d]">{metrics.unauthorized}</p>
              <p className="mt-1 text-[11px] font-semibold text-rose-600">Document & API Denials</p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <ShieldX className="size-6" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#64748b]">Inactive Account Blocks</p>
              <p className="mt-1 text-2xl font-extrabold text-[#14213d]">{metrics.inactiveUser}</p>
              <p className="mt-1 text-[11px] font-semibold text-amber-600">Deactivated Users</p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <UserX className="size-6" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#64748b]">Authentication Failures</p>
              <p className="mt-1 text-2xl font-extrabold text-[#14213d]">{metrics.authFailures}</p>
              <p className="mt-1 text-[11px] font-semibold text-blue-600">Bad Credentials</p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <Lock className="size-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e2eaf5] bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 size-4 text-[#8ba0bf]" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search by actor email, IP address, resource ID, or reason..."
            className="w-full rounded-xl border border-[#d8e2ef] bg-[#f8fbff] py-2 pl-9 pr-3 text-xs text-[#14213d] placeholder:text-[#8ba0bf] focus:border-[#2463eb] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="h-9 rounded-xl border border-[#d8e2ef] bg-[#f8fbff] px-3 text-xs font-semibold text-[#334155] focus:border-[#2463eb] focus:outline-none"
          >
            <option value="ALL">All Security Events</option>
            <option value="UNAUTHORIZED_ACCESS_ATTEMPT">Unauthorized Access (UNAUTHORIZED_ACCESS_ATTEMPT)</option>
            <option value="INACTIVE_USER_ACCESS_ATTEMPT">Inactive User Attempts (INACTIVE_USER_ACCESS_ATTEMPT)</option>
            <option value="LOGIN_FAILURE">Authentication Failures (LOGIN_FAILURE)</option>
            <option value="PERMISSION_EXPIRED_ATTEMPT">Expired Permission Attempts (PERMISSION_EXPIRED_ATTEMPT)</option>
          </select>
        </div>
      </div>

      {/* Security Incidents Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e2eaf5] bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#FDE68A] bg-[#FFFBEB] text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
            <tr>
              <th className="px-5 py-3.5">Timestamp (UTC)</th>
              <th className="px-5 py-3.5">Threat Event Type</th>
              <th className="px-5 py-3.5">Attempted By</th>
              <th className="px-5 py-3.5">Resource Target</th>
              <th className="px-5 py-3.5">Security Determination Reason</th>
              <th className="px-5 py-3.5">Severity</th>
              <th className="px-5 py-3.5 text-right">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f4fa]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                    <span>Analyzing security logs...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  No security violation incidents found matching your query.
                </td>
              </tr>
            ) : (
              paginatedEvents.map((evt) => {
                const sev = getSeverity(evt.action)
                return (
                  <tr
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="cursor-pointer hover:bg-rose-50/20 transition"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[11px] text-[#61738c]">
                      {new Date(evt.timestamp).toLocaleTimeString()} • {new Date(evt.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[11px] font-bold text-rose-700">
                        {evt.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-[#14213d]">{evt.actorEmail}</p>
                      <p className="font-mono text-[10px] text-[#71829d]">IP: {evt.ipAddress || '127.0.0.1'}</p>
                    </td>
                    <td className="px-5 py-3.5 text-[#546782]">
                      {evt.resourceType}: <span className="font-mono text-[10px]">{evt.resourceId?.slice(0, 8)}...</span>
                    </td>
                    <td className="px-5 py-3.5 text-[#334155] max-w-[260px] truncate">
                      {evt.reason}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-extrabold ${sev.bg}`}>
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-extrabold text-red-700">
                        DENIED
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e5ebf4] bg-[#fafcff] px-5 py-3 text-xs text-[#64748b]">
            <div>
              Showing page <strong className="text-[#14213d]">{currentPage}</strong> of{' '}
              <strong className="text-[#14213d]">{totalPages}</strong> ({filteredEvents.length} total security violations)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="grid size-8 place-items-center rounded-lg border border-[#d8e2ef] bg-white text-slate-600 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="grid size-8 place-items-center rounded-lg border border-[#d8e2ef] bg-white text-slate-600 disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECURITY INCIDENT DETAIL DRAWER */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-lg bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
            <div>
              <div className="flex items-start justify-between border-b border-[#eef4fa] pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600">
                    <ShieldAlert className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#14213d]">Security Incident Forensics</h3>
                    <p className="font-mono text-xs text-[#71829d]">UUID: {selectedEvent.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                {/* Event Summary */}
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-red-700 text-sm">
                      {selectedEvent.action}
                    </span>
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-extrabold text-red-800">
                      DENIED
                    </span>
                  </div>
                  <p className="mt-2 text-[#334155] leading-relaxed font-medium">
                    {selectedEvent.reason}
                  </p>
                </div>

                {/* Actor & Source Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Attempted Actor
                    </span>
                    <p className="mt-1 font-bold text-[#14213d] truncate">{selectedEvent.actorEmail}</p>
                    <span className="text-[10px] text-[#71829d]">{selectedEvent.actorRole}</span>
                  </div>

                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Timestamp (UTC)
                    </span>
                    <p className="mt-1 font-mono text-[11px] text-[#14213d]">
                      {new Date(selectedEvent.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Resource Target */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Resource Target
                  </span>
                  <div className="mt-1 text-xs text-[#334155]">
                    Type: <strong className="font-mono">{selectedEvent.resourceType}</strong>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#71829d]">
                    Resource ID: {selectedEvent.resourceId}
                  </div>
                </div>

                {/* Network Forensics */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Network Forensics
                  </span>
                  <div className="mt-1 text-[11px] text-[#334155] space-y-1">
                    <div>Origin IP Address: <span className="font-mono font-bold">{selectedEvent.ipAddress || '127.0.0.1'}</span></div>
                    <div className="break-all text-[10px] text-[#71829d]">
                      User Agent: <span className="font-mono">{selectedEvent.userAgent || 'Unknown'}</span>
                    </div>
                  </div>
                </div>

                {/* Cryptographic Link */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0] flex items-center gap-1.5">
                    <Hash className="size-3 text-[#2463eb]" />
                    SHA-256 Ledger Record Hash
                  </span>
                  <div className="mt-1 break-all font-mono text-[10px] text-[#334155] bg-white p-2 rounded-lg border border-[#e2eaf5]">
                    {selectedEvent.currentHash}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-[#eef4fa] pt-4">
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50"
              >
                Close Forensics View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
