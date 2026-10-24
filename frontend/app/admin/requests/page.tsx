'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Info,
  Lock,
  RefreshCw,
  Search,
  User,
  X,
  XCircle,
} from 'lucide-react'
import { AccessRequestItem, api } from '../../../lib/api'

function AccessRequestsContent() {
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<AccessRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [selectedRequest, setSelectedRequest] = useState<AccessRequestItem | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const loadRequests = async () => {
    setLoading(true)
    try {
      const data = await api.getOwnerAccessRequests()
      setRequests(data)
    } catch (err: any) {
      console.error('Failed to load requests:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  // Check URL query parameter (e.g. ?status=PENDING)
  useEffect(() => {
    const statusParam = searchParams?.get('status')?.toUpperCase()
    if (statusParam === 'PENDING' || statusParam === 'APPROVED' || statusParam === 'REJECTED') {
      setStatusFilter(statusParam as any)
    }
  }, [searchParams])

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === 'PENDING').length,
      approved: requests.filter((r) => r.status === 'APPROVED').length,
      rejected: requests.filter((r) => r.status === 'REJECTED').length,
    }
  }, [requests])

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = query.toLowerCase()
      const matchesQuery =
        !query ||
        (r.documentTitle || '').toLowerCase().includes(q) ||
        r.requesterEmail.toLowerCase().includes(q) ||
        r.requesterName.toLowerCase().includes(q) ||
        (r.reason && r.reason.toLowerCase().includes(q))

      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter

      return matchesQuery && matchesStatus
    })
  }, [requests, query, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize))
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRequests.slice(start, start + pageSize)
  }, [filteredRequests, currentPage])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#14213d]">System-Wide Document Access Requests</h2>
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
              {counts.pending} Awaiting Review
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Monitor all incoming document permission requests, justification notes, and review determinations.
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e2eaf5] bg-white px-3 text-xs font-bold text-[#475569] hover:bg-[#f8fbff] disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-[#2463eb]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Policy Notice Box */}
      <div className="rounded-xl border border-amber-200 bg-[#fffdf9] p-4 text-xs text-[#334155] flex items-start gap-3">
        <Info className="size-4 shrink-0 mt-0.5 text-amber-600" />
        <div>
          <strong className="text-[#14213d]">Access Request Governance:</strong>
          <span className="ml-1 text-[#52637f]">
            Pending access requests require explicit review and authorization by the respective Document Owner. Self-approval is strictly forbidden and rejected server-side. Approved requests create explicit grants; rejected requests maintain full audit traceability.
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e2eaf5] bg-white p-4 shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-1">
          <button
            onClick={() => {
              setStatusFilter('ALL')
              setCurrentPage(1)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === 'ALL'
                ? 'bg-[#2463eb] text-white shadow-xs'
                : 'text-[#64748b] hover:text-[#14213d]'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => {
              setStatusFilter('PENDING')
              setCurrentPage(1)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-[#64748b] hover:text-[#14213d]'
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => {
              setStatusFilter('APPROVED')
              setCurrentPage(1)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#64748b] hover:text-[#14213d]'
            }`}
          >
            Approved ({counts.approved})
          </button>
          <button
            onClick={() => {
              setStatusFilter('REJECTED')
              setCurrentPage(1)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-[#64748b] hover:text-[#14213d]'
            }`}
          >
            Rejected ({counts.rejected})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-[#8ba0bf]" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search by requester, document title, or reason..."
            className="w-full rounded-xl border border-[#d8e2ef] bg-[#f8fbff] py-2 pl-9 pr-3 text-xs text-[#14213d] placeholder:text-[#8ba0bf] focus:border-[#2463eb] focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e2eaf5] bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#FDE68A] bg-[#FFFBEB] text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
            <tr>
              <th className="px-5 py-3.5">Requester</th>
              <th className="px-5 py-3.5">Document Target</th>
              <th className="px-5 py-3.5">Requested Level</th>
              <th className="px-5 py-3.5">Justification Reason</th>
              <th className="px-5 py-3.5">Date Submitted</th>
              <th className="px-5 py-3.5 text-right">Current Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f4fa]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 animate-spin rounded-full border-2 border-[#2463eb] border-t-transparent" />
                    <span>Loading access requests...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  No access requests found matching your filters.
                </td>
              </tr>
            ) : (
              paginatedRequests.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className="cursor-pointer hover:bg-[#fafcff] transition"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-[#14213d]">{req.requesterName}</p>
                    <p className="text-[10px] text-[#71829d]">{req.requesterEmail}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-[#14213d]">{req.documentTitle}</p>
                    <p className="font-mono text-[10px] text-[#71829d]">
                      Doc ID: {req.documentId?.slice(0, 8)}...
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                        req.requestedPermission === 'EDIT'
                          ? 'border border-purple-200 bg-purple-50 text-purple-700'
                          : 'border border-blue-200 bg-blue-50 text-blue-700'
                      }`}
                    >
                      {req.requestedPermission === 'EDIT' ? (
                        <Edit3 className="size-3" />
                      ) : (
                        <Eye className="size-3" />
                      )}
                      <span>{req.requestedPermission}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#334155] max-w-[260px] truncate">
                    {req.reason}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-[#71829d]">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        req.status === 'PENDING'
                          ? 'border border-amber-200 bg-amber-50 text-amber-800'
                          : req.status === 'APPROVED'
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border border-rose-200 bg-rose-50 text-rose-800'
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          req.status === 'PENDING'
                            ? 'bg-amber-500 animate-pulse'
                            : req.status === 'APPROVED'
                            ? 'bg-emerald-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span>{req.status}</span>
                    </span>
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
              <strong className="text-[#14213d]">{totalPages}</strong> ({filteredRequests.length} total records)
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

      {/* REQUEST DETAIL DRAWER */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-md bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
            <div>
              <div className="flex items-start justify-between border-b border-[#eef4fa] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#14213d]">Access Request Details</h3>
                  <p className="font-mono text-xs text-[#71829d]">ID: {selectedRequest.id}</p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Document Target
                  </span>
                  <p className="mt-1 font-bold text-[#14213d] text-sm">{selectedRequest.documentTitle}</p>
                  <p className="font-mono text-[10px] text-[#71829d]">
                    Document UUID: {selectedRequest.documentId}
                  </p>
                </div>

                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Requester
                  </span>
                  <p className="mt-1 font-bold text-[#14213d]">{selectedRequest.requesterName}</p>
                  <p className="text-[#71829d]">{selectedRequest.requesterEmail}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Requested Access
                    </span>
                    <p className="mt-1 font-extrabold text-[#2463eb] text-sm">
                      {selectedRequest.requestedPermission}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Current Status
                    </span>
                    <p
                      className={`mt-1 font-extrabold text-sm ${
                        selectedRequest.status === 'PENDING'
                          ? 'text-amber-600'
                          : selectedRequest.status === 'APPROVED'
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {selectedRequest.status}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Business Justification
                  </span>
                  <p className="mt-1 text-xs text-[#334155] leading-relaxed">
                    {selectedRequest.reason}
                  </p>
                </div>

                {selectedRequest.status !== 'PENDING' && (
                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Review Determination
                    </span>
                    <p className="mt-1 text-xs text-[#334155]">
                      Reviewed by{' '}
                      <strong className="text-[#14213d]">
                        {selectedRequest.reviewedByName || 'Authorized Custodian'}
                      </strong>
                      {selectedRequest.reviewedAt && (
                        <span> on {new Date(selectedRequest.reviewedAt).toLocaleString()}</span>
                      )}
                    </p>
                    {selectedRequest.reviewNote && (
                      <p className="mt-1 rounded-lg border border-[#e2eaf5] bg-white p-2 text-[11px] text-[#546782]">
                        Note: {selectedRequest.reviewNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-[#eef4fa] pt-4">
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50"
              >
                Close Request Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccessRequestsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-[#64748b]">Loading Access Requests...</div>}>
      <AccessRequestsContent />
    </Suspense>
  )
}
