'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Filter,
  LockKeyhole,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  User,
  Users,
  UserPlus,
  Trash2,
  Plus,
  Check,
  AlertCircle,
  X,
} from 'lucide-react'
import { api, PermissionItem, DocumentItem, UserManagementItem } from '../../../lib/api'

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'READ' | 'EDIT'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'>('ALL')
  const [selectedPerm, setSelectedPerm] = useState<PermissionItem | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Document and user lists for granting
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([])
  const [allUsers, setAllUsers] = useState<UserManagementItem[]>([])

  // Grant Modal State
  const [grantModalOpen, setGrantModalOpen] = useState(false)
  const [grantDocId, setGrantDocId] = useState('')
  const [grantUserEmail, setGrantUserEmail] = useState('')
  const [grantLevel, setGrantLevel] = useState<'READ' | 'EDIT'>('READ')
  const [grantExpiryDays, setGrantExpiryDays] = useState('0')
  const [submittingGrant, setSubmittingGrant] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)

  // Update Modal State
  const [updateModalPerm, setUpdateModalPerm] = useState<PermissionItem | null>(null)
  const [updateLevel, setUpdateLevel] = useState<'READ' | 'EDIT'>('READ')
  const [updateExpiryDays, setUpdateExpiryDays] = useState('0')
  const [submittingUpdate, setSubmittingUpdate] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadDependencies = async () => {
    try {
      const [docs, users] = await Promise.all([
        api.getDocuments().catch(() => []),
        api.getAdminUsers().catch(() => []),
      ])
      setAllDocs(docs)
      setAllUsers(users)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadDependencies()
  }, [])

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!grantDocId || !grantUserEmail) {
      setGrantError('Please select both a document and a user')
      return
    }
    setSubmittingGrant(true)
    setGrantError(null)

    try {
      let expiresAt: string | null = null
      const days = parseInt(grantExpiryDays, 10)
      if (days > 0) {
        expiresAt = new Date(Date.now() + days * 86400000).toISOString()
      }

      await api.grantPermission(grantDocId, {
        userEmail: grantUserEmail,
        permissionLevel: grantLevel,
        expiresAt,
      })

      notify(`Granted ${grantLevel} permission to ${grantUserEmail} successfully.`, 'success')
      setGrantModalOpen(false)
      setGrantDocId('')
      setGrantUserEmail('')
      setGrantLevel('READ')
      setGrantExpiryDays('0')
      await loadPermissions()
    } catch (err: any) {
      setGrantError(err.message || 'Failed to grant permission')
    } finally {
      setSubmittingGrant(false)
    }
  }

  const openUpdateModal = (perm: PermissionItem) => {
    setUpdateModalPerm(perm)
    setUpdateLevel(perm.permissionLevel)
    setUpdateExpiryDays('0')
    setUpdateError(null)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!updateModalPerm) return
    setSubmittingUpdate(true)
    setUpdateError(null)

    try {
      let expiresAt: string | null = null
      const days = parseInt(updateExpiryDays, 10)
      if (days > 0) {
        expiresAt = new Date(Date.now() + days * 86400000).toISOString()
      }

      const updated = await api.updatePermission(updateModalPerm.id, {
        permissionLevel: updateLevel,
        expiresAt,
      })

      notify(`Updated permission for ${updateModalPerm.userEmail} to ${updateLevel}.`, 'success')
      setUpdateModalPerm(null)
      if (selectedPerm?.id === updateModalPerm.id) {
        setSelectedPerm(updated)
      }
      await loadPermissions()
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update permission')
    } finally {
      setSubmittingUpdate(false)
    }
  }

  const handleRevoke = async (permissionId: string, email: string, docTitle: string) => {
    if (!confirm(`Revoke access for ${email} on "${docTitle}" immediately?`)) return

    try {
      await api.revokePermission(permissionId)
      notify(`Revoked access for ${email} successfully.`, 'success')
      if (selectedPerm?.id === permissionId) {
        setSelectedPerm((prev) => (prev ? { ...prev, status: 'REVOKED' } : null))
      }
      await loadPermissions()
    } catch (err: any) {
      notify(err.message || 'Failed to revoke permission', 'error')
    }
  }

  const loadPermissions = async () => {
    setLoading(true)
    try {
      const data = await api.getOwnerPermissions()
      setPermissions(data)
    } catch (err: any) {
      console.error('Failed to load permissions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPermissions()
  }, [])

  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      const q = query.toLowerCase()
      const matchesQuery =
        !query ||
        p.documentTitle.toLowerCase().includes(q) ||
        p.userEmail.toLowerCase().includes(q) ||
        p.userName.toLowerCase().includes(q) ||
        p.grantedByName.toLowerCase().includes(q)

      const matchesLevel = levelFilter === 'ALL' || p.permissionLevel === levelFilter

      let matchesStatus = true
      if (statusFilter === 'ACTIVE') {
        matchesStatus = p.status === 'ACTIVE' && !p.isExpired
      } else if (statusFilter === 'REVOKED') {
        matchesStatus = p.status === 'REVOKED'
      } else if (statusFilter === 'EXPIRED') {
        matchesStatus = p.status === 'EXPIRED' || p.isExpired
      }

      return matchesQuery && matchesLevel && matchesStatus
    })
  }, [permissions, query, levelFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPermissions.length / pageSize))
  const paginatedPermissions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredPermissions.slice(start, start + pageSize)
  }, [filteredPermissions, currentPage])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#14213d]">System-Wide Document Permissions</h2>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
              Granular Authorization
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Inspect explicit person-specific access grants, validity periods, and revocation statuses across all confidential documents.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setGrantModalOpen(true)
              setGrantError(null)
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-3.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Grant Permission</span>
          </button>
          <button
            onClick={loadPermissions}
            disabled={loading}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e2eaf5] bg-white px-3 text-xs font-bold text-[#475569] hover:bg-[#f8fbff] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-[#2463eb]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Policy Notice Box */}
      <div className="rounded-xl border border-emerald-200 bg-[#f7fdfa] p-4 text-xs text-[#334155] flex items-start gap-3">
        <LockKeyhole className="size-4 shrink-0 mt-0.5 text-emerald-600" />
        <div>
          <strong className="text-[#14213d]">Explicit Document-Level Access Control:</strong>
          <span className="ml-1 text-[#52637f]">
            Access is never inherited or inferred from project membership. READ allows authenticated viewing/downloading via single-use tokens; EDIT allows updating authorized content but does not grant sharing or deletion powers. Expired and revoked grants are blocked immediately on the server.
          </span>
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
            placeholder="Search permissions by document title, grantee email, or granter..."
            className="w-full rounded-xl border border-[#d8e2ef] bg-[#f8fbff] py-2 pl-9 pr-3 text-xs text-[#14213d] placeholder:text-[#8ba0bf] focus:border-[#2463eb] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value as any)
              setCurrentPage(1)
            }}
            className="h-9 rounded-xl border border-[#d8e2ef] bg-[#f8fbff] px-3 text-xs font-semibold text-[#334155] focus:border-[#2463eb] focus:outline-none"
          >
            <option value="ALL">All Levels</option>
            <option value="READ">READ Permission</option>
            <option value="EDIT">EDIT Permission</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any)
              setCurrentPage(1)
            }}
            className="h-9 rounded-xl border border-[#d8e2ef] bg-[#f8fbff] px-3 text-xs font-semibold text-[#334155] focus:border-[#2463eb] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Grants</option>
            <option value="REVOKED">Revoked Grants</option>
            <option value="EXPIRED">Expired Grants</option>
          </select>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e2eaf5] bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#FDE68A] bg-[#FFFBEB] text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
            <tr>
              <th className="px-5 py-3.5">Document Target</th>
              <th className="px-5 py-3.5">Grantee (User)</th>
              <th className="px-5 py-3.5">Access Level</th>
              <th className="px-5 py-3.5">Granted By</th>
              <th className="px-5 py-3.5">Granted Date</th>
              <th className="px-5 py-3.5">Expiration</th>
              <th className="px-5 py-3.5 text-right">Grant Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f4fa]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 animate-spin rounded-full border-2 border-[#2463eb] border-t-transparent" />
                    <span>Loading permissions from database...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedPermissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  No document permissions found matching your criteria.
                </td>
              </tr>
            ) : (
              paginatedPermissions.map((perm) => (
                <tr
                  key={perm.id}
                  onClick={() => setSelectedPerm(perm)}
                  className="cursor-pointer hover:bg-[#fafcff] transition"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-[#14213d]">{perm.documentTitle}</p>
                    <p className="font-mono text-[10px] text-[#71829d]">
                      Doc ID: {perm.documentId?.slice(0, 8)}...
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-[#14213d]">{perm.userName}</p>
                    <p className="text-[10px] text-[#71829d]">{perm.userEmail}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                        perm.permissionLevel === 'EDIT'
                          ? 'border border-purple-200 bg-purple-50 text-purple-700'
                          : 'border border-blue-200 bg-blue-50 text-blue-700'
                      }`}
                    >
                      {perm.permissionLevel === 'EDIT' ? (
                        <Edit3 className="size-3" />
                      ) : (
                        <Eye className="size-3" />
                      )}
                      <span>{perm.permissionLevel}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#334155] font-medium">
                    {perm.grantedByName}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-[#71829d]">
                    {new Date(perm.grantedAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-[#546782]">
                    {perm.expiresAt ? (
                      <span className={perm.isExpired ? 'text-rose-600 font-bold' : ''}>
                        {new Date(perm.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-[#94a3b8] italic">No Expiry</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        perm.status === 'REVOKED'
                          ? 'border border-rose-200 bg-rose-50 text-rose-700'
                          : perm.isExpired
                          ? 'border border-amber-200 bg-amber-50 text-amber-700'
                          : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {perm.status === 'REVOKED'
                        ? 'Revoked'
                        : perm.isExpired
                        ? 'Expired'
                        : 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {perm.status === 'ACTIVE' && !perm.isExpired && (
                        <>
                          <button
                            type="button"
                            onClick={() => openUpdateModal(perm)}
                            className="rounded-lg border border-[#d8e2ef] bg-white px-2.5 py-1 text-[11px] font-bold text-[#2463eb] hover:bg-[#edf4ff] hover:border-[#2463eb] transition cursor-pointer"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(perm.id, perm.userEmail, perm.documentTitle)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
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
              <strong className="text-[#14213d]">{totalPages}</strong> ({filteredPermissions.length} total grants)
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

      {/* PERMISSION DETAIL DRAWER */}
      {selectedPerm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-md bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
            <div>
              <div className="flex items-start justify-between border-b border-[#eef4fa] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#14213d]">Permission Record</h3>
                  <p className="font-mono text-xs text-[#71829d]">ID: {selectedPerm.id}</p>
                </div>
                <button
                  onClick={() => setSelectedPerm(null)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Document Target
                  </span>
                  <p className="mt-1 font-bold text-[#14213d] text-sm">{selectedPerm.documentTitle}</p>
                  <p className="font-mono text-[10px] text-[#71829d]">
                    Document UUID: {selectedPerm.documentId}
                  </p>
                </div>

                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Beneficiary (Grantee)
                  </span>
                  <p className="mt-1 font-bold text-[#14213d]">{selectedPerm.userName}</p>
                  <p className="text-xs text-[#71829d]">{selectedPerm.userEmail}</p>
                  <p className="font-mono text-[10px] text-[#8ca0c2] mt-0.5">
                    User UUID: {selectedPerm.userId}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Level
                    </span>
                    <p className="mt-1 font-extrabold text-[#2463eb] text-sm">
                      {selectedPerm.permissionLevel}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Status
                    </span>
                    <p className="mt-1 font-extrabold text-[#14213d] text-sm">
                      {selectedPerm.isExpired ? 'EXPIRED' : selectedPerm.status}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Grant Custody
                  </span>
                  <p className="mt-1 text-xs text-[#334155]">
                    Granted by <strong className="text-[#14213d]">{selectedPerm.grantedByName}</strong> on{' '}
                    {new Date(selectedPerm.grantedAt).toLocaleString()}
                  </p>
                </div>

                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Expiration Date
                  </span>
                  <p className="mt-1 text-xs text-[#334155]">
                    {selectedPerm.expiresAt ? (
                      <span className={selectedPerm.isExpired ? 'text-rose-600 font-bold' : ''}>
                        {new Date(selectedPerm.expiresAt).toLocaleString()}{' '}
                        {selectedPerm.isExpired && '(Access Denied - Expired)'}
                      </span>
                    ) : (
                      'Indefinite Grant (No expiration timestamp configured)'
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-[#eef4fa] pt-4 space-y-2">
              {selectedPerm.status === 'ACTIVE' && !selectedPerm.isExpired && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openUpdateModal(selectedPerm)}
                    className="h-9 rounded-xl border border-[#2463eb] bg-[#edf4ff] text-xs font-bold text-[#2463eb] hover:bg-[#2463eb] hover:text-white transition cursor-pointer"
                  >
                    Update Access Level
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(selectedPerm.id, selectedPerm.userEmail, selectedPerm.documentTitle)}
                    className="h-9 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    Revoke Grant
                  </button>
                </div>
              )}
              <button
                onClick={() => setSelectedPerm(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
              >
                Close Permission Record
              </button>
            </div>
          </div>
        </div>
      )}
      {/* GRANT PERMISSION MODAL */}
      {grantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-[#2463eb]">
                  <Plus className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#14213d]">Grant Document Permission</h3>
              </div>
              <button
                onClick={() => setGrantModalOpen(false)}
                className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {grantError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <span>{grantError}</span>
              </div>
            )}

            <form onSubmit={handleGrant} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14213d] mb-1">
                  Target Document <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={grantDocId}
                  onChange={(e) => setGrantDocId(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                >
                  <option value="">Select a document...</option>
                  {allDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.formattedSize} - {d.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#14213d] mb-1">
                  Recipient User <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={grantUserEmail}
                  onChange={(e) => setGrantUserEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                >
                  <option value="">Select a registered user...</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.fullName} ({u.email}) - {u.role.replace('ROLE_', '')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#14213d] mb-1">Permission Level</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGrantLevel('READ')}
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      grantLevel === 'READ'
                        ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb]'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }`}
                  >
                    READ Permission
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantLevel('EDIT')}
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      grantLevel === 'EDIT'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }`}
                  >
                    EDIT Permission
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[#71829d]">
                  READ allows viewing/downloading. EDIT allows updating content but does not permit deletion.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#14213d] mb-1">Optional Expiry</label>
                <select
                  value={grantExpiryDays}
                  onChange={(e) => setGrantExpiryDays(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                >
                  <option value="0">Never Expires (Indefinite)</option>
                  <option value="7">Expires in 7 days</option>
                  <option value="14">Expires in 14 days</option>
                  <option value="30">Expires in 30 days</option>
                  <option value="90">Expires in 90 days</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#eef4fa]">
                <button
                  type="button"
                  onClick={() => setGrantModalOpen(false)}
                  className="h-9 rounded-xl border border-[#d8e2ef] px-4 font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!grantDocId || !grantUserEmail || submittingGrant}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-4 font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {submittingGrant ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  <span>Grant Permission</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE PERMISSION MODAL */}
      {updateModalPerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-[#2463eb]">
                  <Edit3 className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#14213d]">Update Permission Grant</h3>
              </div>
              <button
                onClick={() => setUpdateModalPerm(null)}
                className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1 text-xs">
              <p className="text-[#64748b]">
                Document: <strong className="text-[#14213d]">{updateModalPerm.documentTitle}</strong>
              </p>
              <p className="text-[#64748b]">
                Grantee: <strong className="text-[#14213d]">{updateModalPerm.userEmail}</strong>
              </p>
            </div>

            {updateError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <span>{updateError}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14213d] mb-1">Access Level</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpdateLevel('READ')}
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      updateLevel === 'READ'
                        ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb]'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }`}
                  >
                    READ
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateLevel('EDIT')}
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      updateLevel === 'EDIT'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }`}
                  >
                    EDIT
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#14213d] mb-1">Update Expiry</label>
                <select
                  value={updateExpiryDays}
                  onChange={(e) => setUpdateExpiryDays(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                >
                  <option value="0">Never Expires (Indefinite)</option>
                  <option value="7">Extend by 7 days</option>
                  <option value="14">Extend by 14 days</option>
                  <option value="30">Extend by 30 days</option>
                  <option value="90">Extend by 90 days</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#eef4fa]">
                <button
                  type="button"
                  onClick={() => setUpdateModalPerm(null)}
                  className="h-9 rounded-xl border border-[#d8e2ef] px-4 font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUpdate}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-4 font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {submittingUpdate ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Edit3 className="size-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg animate-in slide-in-from-bottom-2 ${
            toast.type === 'error' ? 'bg-[#e53e3e] text-white' : 'bg-[#14213d] text-white'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="size-4 text-white" />
          ) : (
            <Check className="size-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}