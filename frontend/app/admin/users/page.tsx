'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FolderKanban,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { api, ProjectItem, UserManagementItem } from '../../../lib/api'

function UserManagementContent() {
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<UserManagementItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Filters & Search
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ROLE_ADMIN' | 'ROLE_OWNER' | 'ROLE_MANAGER' | 'ROLE_VIEWER' | 'ROLE_WORKSHOP_MEMBER'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED'>('ALL')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modal & Selection
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserManagementItem | null>(null)

  // Form fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<'ROLE_VIEWER' | 'ROLE_WORKSHOP_MEMBER' | 'ROLE_OWNER' | 'ROLE_MANAGER' | 'ROLE_ADMIN'>('ROLE_WORKSHOP_MEMBER')
  const [initialProjectId, setInitialProjectId] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [userList, projectList] = await Promise.all([
        api.getAdminUsers(),
        api.getProjects().catch(() => []),
      ])
      setUsers(userList)
      setProjects(projectList)
    } catch (err: any) {
      notify(err.message || 'Failed to load user directory', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Check URL query parameter to auto-open create modal
  useEffect(() => {
    if (searchParams?.get('action') === 'new') {
      setCreateModalOpen(true)
    }
  }, [searchParams])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!fullName.trim()) {
      setFormError('Full name is required')
      return
    }

    const emailTrimmed = email.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailTrimmed)) {
      setFormError('Please enter a valid company email address (e.g. name@company.com)')
      return
    }

    if (!password || password.length < 8) {
      setFormError('Password is required and must be at least 8 characters')
      return
    }

    setSubmitting(true)
    try {
      await api.createUser({
        fullName: fullName.trim(),
        email: emailTrimmed,
        role,
        password: password.trim(),
        initialProjectId: initialProjectId || undefined,
      })

      notify(`User "${fullName.trim()}" provisioned successfully. They can now log in immediately.`, 'success')
      setCreateModalOpen(false)
      setFullName('')
      setEmail('')
      setPassword('')
      setShowPassword(false)
      setRole('ROLE_WORKSHOP_MEMBER')
      setInitialProjectId('')
      await loadData()
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (user: UserManagementItem) => {
    const actionWord = user.active ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${actionWord} the account for "${user.fullName}" (${user.email})?`)) {
      return
    }

    try {
      await api.toggleUserStatus(user.id, !user.active)
      notify(`Account for ${user.email} ${!user.active ? 'activated' : 'deactivated'} server-side`, 'success')
      await loadData()
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, active: !user.active })
      }
    } catch (err: any) {
      notify(err.message || `Failed to ${actionWord} user`, 'error')
    }
  }

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesQuery =
        !query ||
        u.fullName.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())

      const matchesRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'ROLE_MANAGER' && (u.role === 'ROLE_MANAGER' || u.role === 'ROLE_OWNER')) ||
        (roleFilter === 'ROLE_WORKSHOP_MEMBER' && (u.role === 'ROLE_WORKSHOP_MEMBER' || u.role === 'ROLE_VIEWER' || u.role === 'ROLE_EDITOR')) ||
        (roleFilter === 'ROLE_ADMIN' && u.role === 'ROLE_ADMIN') ||
        u.role === roleFilter

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.active) ||
        (statusFilter === 'DEACTIVATED' && !u.active)

      return matchesQuery && matchesRole && matchesStatus
    })
  }, [users, query, roleFilter, statusFilter])

  // Paginated users
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage])

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-bold shadow-lg transition animate-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 text-red-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#14213d]">User Directory & Access Provisioning</h2>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Manage enterprise identities, assign system-level roles, and enforce instant account activation/deactivation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-[#e2eaf5] bg-white text-slate-600 hover:bg-[#FFFBEB]/40 disabled:opacity-60"
            title="Refresh User List"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-[#2463eb]' : ''}`} />
          </button>
          <button
            onClick={() => {
              setFormError(null)
              setCreateModalOpen(true)
            }}
            className="flex h-9 items-center gap-2 rounded-xl bg-[#FACC15] px-4 text-xs font-bold text-[#1F2937] shadow-xs hover:bg-[#EAB308]"
          >
            <UserPlus className="size-4" />
            <span>Create User</span>
          </button>
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
            placeholder="Search users by full name or corporate email..."
            className="w-full rounded-xl border border-[#d8e2ef] bg-[#f8fbff] py-2 pl-9 pr-3 text-xs text-[#14213d] placeholder:text-[#8ba0bf] focus:border-[#2463eb] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as any)
              setCurrentPage(1)
            }}
            className="h-9 rounded-xl border border-[#d8e2ef] bg-[#f8fbff] px-3 text-xs font-semibold text-[#334155] focus:border-[#2463eb] focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="ROLE_ADMIN">Admin (ROLE_ADMIN)</option>
            <option value="ROLE_MANAGER">Manager (ROLE_MANAGER)</option>
            <option value="ROLE_WORKSHOP_MEMBER">Workshop Member (ROLE_WORKSHOP_MEMBER)</option>
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
            <option value="ACTIVE">Active Accounts</option>
            <option value="DEACTIVATED">Deactivated Accounts</option>
          </select>
        </div>
      </div>

      {/* User Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e2eaf5] bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#FDE68A] bg-[#FFFBEB] text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
            <tr>
              <th className="px-5 py-3.5">User Identity</th>
              <th className="px-5 py-3.5">System Role</th>
              <th className="px-5 py-3.5">Account Status</th>
              <th className="px-5 py-3.5">Project Assignments</th>
              <th className="px-5 py-3.5">Created Date</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f4fa]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 animate-spin rounded-full border-2 border-[#2463eb] border-t-transparent" />
                    <span>Loading verified accounts from PostgreSQL...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  No accounts found matching your search and filter criteria.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="cursor-pointer hover:bg-[#fafcff] transition"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-[#14213d]">{u.fullName}</p>
                    <p className="text-[11px] text-[#71829d]">{u.email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                        u.role === 'ROLE_ADMIN'
                          ? 'border border-red-200 bg-red-50 text-red-700'
                          : (u.role === 'ROLE_MANAGER' || u.role === 'ROLE_OWNER')
                          ? 'border border-blue-200 bg-blue-50 text-blue-700'
                          : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {u.role === 'ROLE_ADMIN' ? 'Admin' : (u.role === 'ROLE_MANAGER' || u.role === 'ROLE_OWNER') ? 'Manager' : 'Workshop Member'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        u.active
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border border-rose-200 bg-rose-50 text-rose-800'
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          u.active ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span>{u.active ? 'Active' : 'Deactivated'}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#546782]">
                    {u.projectNames && u.projectNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.projectNames.map((pName, i) => (
                          <span
                            key={i}
                            className="rounded-md border border-[#e2eaf5] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-medium text-[#334155]"
                          >
                            {pName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#94a3b8] italic">No projects assigned</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-[#71829d]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        u.active
                          ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {u.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e5ebf4] bg-[#fafcff] px-5 py-3 text-xs text-[#64748b]">
            <div>
              Showing page <strong className="text-[#14213d]">{currentPage}</strong> of{' '}
              <strong className="text-[#14213d]">{totalPages}</strong> ({filteredUsers.length} total users)
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

      {/* CREATE USER MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-[#2463eb]">
                  <UserPlus className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#14213d]">Provision Enterprise User</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#14213d]">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jordan Miller"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Company Email */}
              <div>
                <label className="block text-xs font-bold text-[#14213d]">
                  Corporate Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-[#71829d]">
                  Email uniqueness is enforced by the database. Account will be created in Active status.
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-[#14213d]">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 pr-10 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[#71829d]">
                  Stored securely using BCrypt. Newly created user can immediately log in with this password.
                </p>
              </div>

              {/* System Role */}
              <div>
                <label className="block text-xs font-bold text-[#14213d]">
                  Assign System Role <span className="text-red-500">*</span>
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('ROLE_MANAGER')}
                    className={`rounded-xl border p-2.5 text-left text-xs transition ${
                      role === 'ROLE_MANAGER' || role === 'ROLE_OWNER'
                        ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb] font-bold shadow-xs'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#475569] hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold">Manager</div>
                    <div className="text-[10px] opacity-75">ROLE_MANAGER</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('ROLE_WORKSHOP_MEMBER')}
                    className={`rounded-xl border p-2.5 text-left text-xs transition ${
                      role === 'ROLE_WORKSHOP_MEMBER' || role === 'ROLE_VIEWER'
                        ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb] font-bold shadow-xs'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#475569] hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold">Workshop Member</div>
                    <div className="text-[10px] opacity-75">ROLE_WORKSHOP_MEMBER</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('ROLE_ADMIN')}
                    className={`rounded-xl border p-2.5 text-left text-xs transition ${
                      role === 'ROLE_ADMIN'
                        ? 'border-red-500 bg-red-50 text-red-700 font-bold shadow-xs'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#475569] hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold text-red-700">Admin</div>
                    <div className="text-[10px] opacity-75">ROLE_ADMIN</div>
                  </button>
                </div>
              </div>

              {/* Optional Initial Project Assignment */}
              <div>
                <label className="block text-xs font-bold text-[#14213d]">
                  Optional Initial Project Assignment
                </label>
                <select
                  value={initialProjectId}
                  onChange={(e) => setInitialProjectId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                >
                  <option value="">No project assignment (default)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Manager: {p.ownerName})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-[#71829d]">
                  Note: Project membership does not grant automatic READ/EDIT access to confidential documents.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 border-t border-[#eef4fa] pt-4">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="h-9 rounded-xl border border-[#d8e2ef] bg-white px-4 text-xs font-bold text-[#475569] hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-9 items-center gap-2 rounded-xl bg-[#FACC15] px-5 text-xs font-bold text-[#1F2937] shadow-xs hover:bg-[#EAB308] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <div className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Provision Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER DETAIL DRAWER */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-md bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
            <div>
              <div className="flex items-center justify-between border-b border-[#eef4fa] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#14213d]">{selectedUser.fullName}</h3>
                  <p className="text-xs text-[#71829d]">{selectedUser.email}</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    System Role
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                        selectedUser.role === 'ROLE_ADMIN'
                          ? 'bg-red-50 text-red-700'
                          : (selectedUser.role === 'ROLE_MANAGER' || selectedUser.role === 'ROLE_OWNER')
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {selectedUser.role === 'ROLE_ADMIN' ? 'Admin (ROLE_ADMIN)' : (selectedUser.role === 'ROLE_MANAGER' || selectedUser.role === 'ROLE_OWNER') ? 'Manager (ROLE_MANAGER)' : 'Workshop Member (ROLE_WORKSHOP_MEMBER)'}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Status
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        selectedUser.active
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          selectedUser.active ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span>{selectedUser.active ? 'Active (Permitted)' : 'Deactivated (Blocked)'}</span>
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Account ID
                  </span>
                  <div className="mt-1 font-mono text-xs text-[#334155]">{selectedUser.id}</div>
                </div>

                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Registered Timestamp
                  </span>
                  <div className="mt-1 text-xs text-[#334155]">
                    {new Date(selectedUser.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Project Memberships
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedUser.projectNames && selectedUser.projectNames.length > 0 ? (
                      selectedUser.projectNames.map((p, i) => (
                        <span
                          key={i}
                          className="rounded-lg border border-[#d8e2ef] bg-white px-2.5 py-1 text-xs font-semibold text-[#14213d]"
                        >
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#94a3b8] italic">No assigned projects</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-[#eef4fa] pt-4">
              <button
                onClick={() => handleToggleStatus(selectedUser)}
                className={`w-full h-10 rounded-xl text-xs font-bold transition shadow-xs ${
                  selectedUser.active
                    ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {selectedUser.active ? 'Deactivate Account Immediately' : 'Reactivate Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UserManagementPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-[#64748b]">Loading User Management...</div>}>
      <UserManagementContent />
    </Suspense>
  )
}
