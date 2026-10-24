'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  Filter,
  Hash,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'
import { api, AuditLogItem, AuditVerificationResult } from '../../../lib/api'

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<AuditVerificationResult | null>(null)
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  // Filters & Search
  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [resultFilter, setResultFilter] = useState<'ALL' | 'SUCCESS' | 'DENIED'>('ALL')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await api.getAuditLogs({
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        result: resultFilter !== 'ALL' ? resultFilter : undefined,
        search: query.trim() || undefined,
      })
      setLogs(data)
    } catch (err: any) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [actionFilter, resultFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    loadLogs()
  }

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
        message: err.message || 'Integrity verification failed',
      })
    } finally {
      setVerifying(false)
    }
  }

  // Client-side filtering in case query was changed without hitting submit
  const filteredLogs = useMemo(() => {
    if (!query.trim()) return logs
    const q = query.toLowerCase()
    return logs.filter(
      (l) =>
        (l.actorEmail && l.actorEmail.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.reason && l.reason.toLowerCase().includes(q)) ||
        (l.resourceId && l.resourceId.toLowerCase().includes(q))
    )
  }, [logs, query])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize))
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredLogs.slice(start, start + pageSize)
  }, [filteredLogs, currentPage])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#14213d]">Cryptographic Append-Only Audit Trail</h2>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
              SHA-256 Chained
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Immutable record of all enterprise administrative actions, vault uploads, permission modifications, and authentications.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleVerifyIntegrity}
            disabled={verifying}
            className="flex h-9 items-center gap-2 rounded-xl bg-[#14213d] px-3.5 text-xs font-bold text-white hover:bg-[#243b64] disabled:opacity-60 shadow-xs"
          >
            <ShieldCheck className={`size-4 text-emerald-400 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Verifying Hashes...' : 'Verify Chain Integrity'}</span>
          </button>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-[#e2eaf5] bg-white text-slate-600 hover:bg-[#f8fbff] disabled:opacity-60"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-[#2463eb]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          className={`rounded-xl border p-4 text-xs font-bold ${
            verificationResult.valid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {verificationResult.valid ? (
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p>? CRYPTOGRAPHIC INTEGRITY CONFIRMED</p>
                <p className="mt-0.5 text-[11px] font-normal opacity-90">
                  {verificationResult.message} Verified {verificationResult.verifiedCount} records from Genesis block. 0 tamper anomalies detected.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p>?? AUDIT CHAIN INTEGRITY BREACH DETECTED</p>
                <p className="mt-0.5 text-[11px] font-normal opacity-90">{verificationResult.message}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter & Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e2eaf5] bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 size-4 text-[#8ba0bf]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by actor email, action, resource ID, or reason..."
            className="w-full rounded-xl border border-[#d8e2ef] bg-[#f8fbff] py-2 pl-9 pr-3 text-xs text-[#14213d] placeholder:text-[#8ba0bf] focus:border-[#2463eb] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="h-9 rounded-xl border border-[#d8e2ef] bg-[#f8fbff] px-3 text-xs font-semibold text-[#334155] focus:border-[#2463eb] focus:outline-none"
          >
            <option value="ALL">All Actions</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
            <option value="USER_CREATED">USER_CREATED</option>
            <option value="USER_ACTIVATED">USER_ACTIVATED</option>
            <option value="USER_DEACTIVATED">USER_DEACTIVATED</option>
            <option value="DOCUMENT_UPLOAD">DOCUMENT_UPLOAD</option>
            <option value="DOCUMENT_VIEW">DOCUMENT_VIEW</option>
            <option value="DOCUMENT_DOWNLOAD">DOCUMENT_DOWNLOAD</option>
            <option value="PERMISSION_GRANT">PERMISSION_GRANT</option>
            <option value="PERMISSION_REVOKE">PERMISSION_REVOKE</option>
            <option value="ACCESS_REQUEST_CREATED">ACCESS_REQUEST_CREATED</option>
            <option value="ACCESS_REQUEST_APPROVED">ACCESS_REQUEST_APPROVED</option>
            <option value="ACCESS_REQUEST_REJECTED">ACCESS_REQUEST_REJECTED</option>
            <option value="UNAUTHORIZED_ACCESS_ATTEMPT">UNAUTHORIZED_ACCESS_ATTEMPT</option>
            <option value="INACTIVE_USER_ACCESS_ATTEMPT">INACTIVE_USER_ACCESS_ATTEMPT</option>
          </select>

          {/* Result Filter */}
          <select
            value={resultFilter}
            onChange={(e) => {
              setResultFilter(e.target.value as any)
              setCurrentPage(1)
            }}
            className="h-9 rounded-xl border border-[#d8e2ef] bg-[#f8fbff] px-3 text-xs font-semibold text-[#334155] focus:border-[#2463eb] focus:outline-none"
          >
            <option value="ALL">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="DENIED">DENIED</option>
          </select>
        </div>
      </form>

      {/* Audit Logs Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e2eaf5] bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#FDE68A] bg-[#FFFBEB] text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
            <tr>
              <th className="px-5 py-3.5">Timestamp (UTC)</th>
              <th className="px-5 py-3.5">Action</th>
              <th className="px-5 py-3.5">Actor</th>
              <th className="px-5 py-3.5">Resource</th>
              <th className="px-5 py-3.5">Outcome</th>
              <th className="px-5 py-3.5">Details</th>
              <th className="px-5 py-3.5 text-right">Current Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f4fa]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 animate-spin rounded-full border-2 border-[#2463eb] border-t-transparent" />
                    <span>Loading audit records from PostgreSQL...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  No audit log entries found matching your query.
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="cursor-pointer hover:bg-[#fafcff] transition"
                >
                  <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[11px] text-[#61738c]">
                    {new Date(log.timestamp).toLocaleTimeString()} • {new Date(log.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 font-bold text-[#14213d]">
                    <span className="rounded-md border border-[#e2eaf5] bg-[#fafcff] px-2 py-0.5 text-[10px] font-mono">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-[#14213d]">{log.actorEmail}</span>
                    <span className="ml-1.5 rounded bg-[#eef3fb] px-1.5 py-0.5 text-[9px] font-bold text-[#647997]">
                      {log.actorRole}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#546782]">
                    {log.resourceType}: <span className="font-mono text-[10px]">{log.resourceId?.slice(0, 8)}...</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        log.result === 'SUCCESS'
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border border-rose-200 bg-rose-50 text-rose-800'
                      }`}
                    >
                      {log.result}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#546782] max-w-[200px] truncate">
                    {log.reason}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[10px] text-[#8699b2]">
                    {log.currentHash?.slice(0, 12)}...
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e5ebf4] bg-[#fafcff] px-5 py-3 text-xs text-[#64748b]">
            <div>
              Showing page <strong className="text-[#14213d]">{currentPage}</strong> of{' '}
              <strong className="text-[#14213d]">{totalPages}</strong> ({filteredLogs.length} total entries)
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

      {/* AUDIT LOG DETAIL DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-lg bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
            <div>
              <div className="flex items-start justify-between border-b border-[#eef4fa] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#14213d]">Audit Event Details</h3>
                  <p className="font-mono text-xs text-[#71829d]">UUID: {selectedLog.id}</p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                {/* Event Summary */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#14213d] text-sm">{selectedLog.action}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        selectedLog.result === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      {selectedLog.result}
                    </span>
                  </div>
                  <p className="mt-2 text-[#334155] leading-relaxed">{selectedLog.reason}</p>
                </div>

                {/* Actor & Timestamp */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Actor
                    </span>
                    <p className="mt-1 font-bold text-[#14213d] truncate">{selectedLog.actorEmail}</p>
                    <span className="text-[10px] text-[#71829d]">{selectedLog.actorRole}</span>
                  </div>

                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Timestamp (UTC)
                    </span>
                    <p className="mt-1 font-mono text-[11px] text-[#14213d]">
                      {new Date(selectedLog.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Resource Details */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Resource Target
                  </span>
                  <div className="mt-1 font-mono text-xs text-[#334155]">
                    Type: <strong>{selectedLog.resourceType}</strong>
                  </div>
                  <div className="font-mono text-[11px] text-[#71829d]">
                    ID: {selectedLog.resourceId}
                  </div>
                </div>

                {/* Forensic Network Info */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Forensic Source Info
                  </span>
                  <div className="mt-1 text-[11px] text-[#334155]">
                    <div>IP Address: <span className="font-mono">{selectedLog.ipAddress || '127.0.0.1'}</span></div>
                    <div className="mt-1 truncate">User Agent: <span className="font-mono text-[10px] text-[#71829d]">{selectedLog.userAgent || 'Unknown'}</span></div>
                  </div>
                </div>

                {/* Cryptographic Hashes */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0] flex items-center gap-1.5">
                    <Hash className="size-3 text-[#2463eb]" />
                    Cryptographic Hash Chain Links
                  </span>

                  <div>
                    <span className="text-[10px] text-[#71829d] font-bold">PREVIOUS HASH:</span>
                    <div className="mt-0.5 break-all font-mono text-[10px] text-[#546782] bg-white p-2 rounded-lg border border-[#e2eaf5]">
                      {selectedLog.previousHash}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#71829d] font-bold">CURRENT HASH (SHA-256):</span>
                    <div className="mt-0.5 break-all font-mono text-[10px] text-[#2463eb] font-bold bg-white p-2 rounded-lg border border-[#e2eaf5]">
                      {selectedLog.currentHash}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-[#eef4fa] pt-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
