'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderKanban,
  Home as HomeIcon,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  Users,
  UserX,
  X,
} from 'lucide-react'
import {
  api,
  AuditLogItem,
  DocumentItem,
  PermissionItem,
  ProjectItem,
  AccessRequestItem,
  RenewalRequestItem,
  UserManagementItem,
  getToken,
  removeToken,
} from '../lib/api'

type Role = 'OWNER' | 'ADMIN' | 'VIEWER'
type ModalType =
  | 'upload'
  | 'review-request'
  | 'request-access'
  | 'request-renewal'
  | 'create-project'
  | 'manage-permissions'
  | 'edit-document'
  | 'login'
  | null

const DEMO_ACCOUNTS = [
  { role: 'ADMIN' as Role, email: 'admin@trustvault.local', name: 'Sarah Admin', label: 'Admin (Audit & Users)' },
  { role: 'OWNER' as Role, email: 'owner@trustvault.local', name: 'Elena Vance', label: 'Owner (Docs & Permissions)' },
  { role: 'VIEWER' as Role, email: 'viewer@trustvault.local', name: 'Sam Williams', label: 'Viewer (Shared Access)' },
  { role: 'VIEWER' as Role, email: 'alex@trustvault.local', name: 'Alex Morgan', label: 'Viewer 2 (Needs Access)' },
]

const nav = {
  OWNER: [
    ['Overview', HomeIcon],
    ['My Projects', FolderKanban],
    ['My Documents', FileText],
    ['Permissions', LockKeyhole],
    ['Access Requests', FileCheck2],
    ['Audit Logs', Activity],
  ],
  ADMIN: [
    ['Dashboard', LayoutDashboard],
    ['Users', Users],
    ['All Documents', FileText],
    ['Access Requests', FileCheck2],
    ['Audit Logs', Activity],
    ['Security Events', ShieldCheck],
    ['System Settings', Settings2],
  ],
  VIEWER: [
    ['Overview', HomeIcon],
    ['Shared With Me', Users],
    ['Search', Search],
    ['My Access Requests', FileCheck2],
    ['Notifications', Bell],
    ['Profile', UserRound],
  ],
} as const

export default function Home() {
  const [role, setRole] = useState<Role>('OWNER')
  const [activeNav, setActiveNav] = useState('Overview')
  const [modal, setModal] = useState<ModalType>(null)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [isLiveMode, setIsLiveMode] = useState(true)
  const [loading, setLoading] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState('owner@trustvault.local')
  const [currentUserName, setCurrentUserName] = useState('Elena Vance')

  // Real backend state
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([])
  const [renewals, setRenewals] = useState<RenewalRequestItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [adminUsers, setAdminUsers] = useState<UserManagementItem[]>([])
  const [integrityStatus, setIntegrityStatus] = useState<string | null>(null)

  // Selected items for modals
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<AccessRequestItem | null>(null)
  const [selectedRenewalPerm, setSelectedRenewalPerm] = useState<PermissionItem | null>(null)

  // Form states
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('General')
  const [uploadProject, setUploadProject] = useState('')
  const [grantEmail, setGrantEmail] = useState('')
  const [grantLevel, setGrantLevel] = useState<'READ' | 'EDIT'>('READ')
  const [grantDays, setGrantDays] = useState('30')
  const [requestReason, setRequestReason] = useState('')
  const [requestPermLevel, setRequestPermLevel] = useState<'READ' | 'EDIT'>('READ')
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3200)
  }

  // Auto-login on role switch or initial load
  const switchAccount = async (targetEmail: string, targetRole: Role, targetName: string) => {
    setLoading(true)
    try {
      if (isLiveMode) {
        await api.login(targetEmail, 'TrustVault@2025!')
      }
      setRole(targetRole)
      setCurrentUserEmail(targetEmail)
      setCurrentUserName(targetName)
      setActiveNav(targetRole === 'ADMIN' ? 'Dashboard' : 'Overview')
      notify(`Logged in as ${targetName} (${targetRole})`, 'success')
      await loadData()
    } catch (err: any) {
      console.warn('Backend login fallback to preview:', err)
      notify(`Switched to ${targetRole} mode (Preview): ${err.message}`, 'info')
      setRole(targetRole)
      setCurrentUserEmail(targetEmail)
      setCurrentUserName(targetName)
      setActiveNav(targetRole === 'ADMIN' ? 'Dashboard' : 'Overview')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      const [docs, projs, myPerms] = await Promise.all([
        api.getDocuments().catch(() => []),
        api.getProjects().catch(() => []),
        api.getMyPermissions().catch(() => []),
      ])
      setDocuments(docs)
      setProjects(projs)
      setPermissions(myPerms)

      if (role === 'OWNER') {
        const reqs = await api.getOwnerAccessRequests().catch(() => [])
        const rens = await api.getOwnerRenewals().catch(() => [])
        setAccessRequests(reqs)
        setRenewals(rens)
      } else if (role === 'ADMIN') {
        const [logs, users, reqs] = await Promise.all([
          api.getAuditLogs().catch(() => []),
          api.getAdminUsers().catch(() => []),
          api.getOwnerAccessRequests().catch(() => []),
        ])
        setAuditLogs(logs)
        setAdminUsers(users)
        setAccessRequests(reqs)
      } else {
        // VIEWER
        const reqs = await api.getMyAccessRequests().catch(() => [])
        setAccessRequests(reqs)
      }
    } catch (e) {
      console.error('Data load error:', e)
    }
  }

  useEffect(() => {
    // Initial mount login as Elena Vance (Owner)
    switchAccount('owner@trustvault.local', 'OWNER', 'Elena Vance')
  }, [])

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(query.toLowerCase()) ||
        d.category.toLowerCase().includes(query.toLowerCase()) ||
        (d.projectName && d.projectName.toLowerCase().includes(query.toLowerCase()))
    )
  }, [documents, query])

  // Stats calculation
  const stats = useMemo(() => {
    if (role === 'ADMIN') {
      const totalUsers = adminUsers.length || 184
      const activeUsers = adminUsers.filter((u) => u.active).length || 172
      return [
        ['Total users', String(totalUsers), '+14 this month', Users, 'blue'],
        ['Active users', String(activeUsers), '93.4% active', UserRound, 'green'],
        ['Total documents', String(documents.length || 1248), '+86 this month', FileText, 'purple'],
        ['Pending requests', String(accessRequests.filter((r) => r.status === 'PENDING').length), 'Needs attention', Clock3, 'orange'],
      ] as const
    }
    if (role === 'OWNER') {
      const owned = documents.filter((d) => d.userAccessLevel === 'OWNER').length
      const pending = accessRequests.filter((r) => r.status === 'PENDING').length
      return [
        ['Total documents', String(owned || 48), '+12% this month', FileText, 'blue'],
        ['Projects', String(projects.length || 12), '+2 this month', FolderKanban, 'purple'],
        ['Active grants', String(permissions.length || 26), '+8% this month', Users, 'green'],
        ['Pending requests', String(pending || 5), 'Needs attention', Clock3, 'orange'],
      ] as const
    }
    // VIEWER
    const accessible = documents.length
    const expiring = documents.filter((d) => d.isExpiringSoon).length
    return [
      ['Accessible documents', String(accessible || 36), '+4 this month', FileText, 'blue'],
      ['READ permissions', String(permissions.filter((p) => p.permissionLevel === 'READ').length || 28), 'Active grants', Eye, 'green'],
      ['EDIT permissions', String(permissions.filter((p) => p.permissionLevel === 'EDIT').length || 8), 'Active grants', Edit3, 'purple'],
      ['Expiring soon', String(expiring || 3), 'Within 7-30 days', Clock3, 'orange'],
    ] as const
  }, [role, documents, projects, permissions, accessRequests, adminUsers])

  // Handlers
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) {
      notify('Please select a file to upload', 'error')
      return
    }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      if (uploadTitle) formData.append('title', uploadTitle)
      if (uploadCategory) formData.append('category', uploadCategory)
      if (uploadProject) formData.append('projectId', uploadProject)

      const doc = await api.uploadDocument(formData)
      notify(`Document "${doc.title}" uploaded to private vault with SHA-256 verification`, 'success')
      setModal(null)
      setUploadFile(null)
      setUploadTitle('')
      await loadData()
    } catch (err: any) {
      notify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (doc: DocumentItem) => {
    try {
      notify(`Generating short-lived secure download token for "${doc.title}"...`, 'info')
      const tokenResp = await api.getDownloadToken(doc.id)
      const downloadUrl = api.getDownloadUrl(tokenResp.token)
      window.open(downloadUrl, '_blank')
      notify(`Secure download initiated (Token valid for 60s)`, 'success')
    } catch (err: any) {
      notify(`Download denied: ${err.message}`, 'error')
    }
  }

  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm(`Are you sure you want to delete "${doc.title}" from the secure vault?`)) return
    try {
      await api.deleteDocument(doc.id)
      notify(`Document "${doc.title}" deleted from private vault`, 'success')
      await loadData()
    } catch (err: any) {
      notify(`Delete denied: ${err.message}`, 'error')
    }
  }

  const handleVerifyIntegrity = async () => {
    setLoading(true)
    try {
      const res = await api.verifyAuditIntegrity()
      if (res.valid) {
        setIntegrityStatus(`✅ ALL ${res.verifiedCount} AUDIT LOGS CRYPTOGRAPHICALLY INTACT: SHA-256 hash chains verified from Genesis block.`)
        notify('Audit chain integrity verified: 0 tampering detected', 'success')
      } else {
        setIntegrityStatus(`⚠️ TAMPER DETECTED at record ${res.brokenRecordId}!`)
        notify('Tamper detected in audit trail!', 'error')
      }
    } catch (err: any) {
      notify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDoc || !grantEmail) return
    try {
      let expiresAt: string | null = null
      if (grantDays && parseInt(grantDays) > 0) {
        const d = new Date()
        d.setDate(d.getDate() + parseInt(grantDays))
        expiresAt = d.toISOString()
      }
      await api.grantPermission(selectedDoc.id, {
        userEmail: grantEmail,
        permissionLevel: grantLevel,
        expiresAt,
      })
      notify(`Granted ${grantLevel} to ${grantEmail} on "${selectedDoc.title}"`, 'success')
      setModal(null)
      setGrantEmail('')
      await loadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleRevokePermission = async (permId: string) => {
    try {
      await api.revokePermission(permId)
      notify('Permission revoked immediately', 'success')
      await loadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleReviewRequest = async (approved: boolean) => {
    if (!selectedRequest) return
    try {
      await api.reviewAccessRequest(selectedRequest.id, {
        approved,
        reviewNote: approved ? 'Approved by owner' : 'Access rejected by owner',
      })
      notify(`Request ${approved ? 'APPROVED' : 'REJECTED'}`, 'success')
      setModal(null)
      setSelectedRequest(null)
      await loadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDoc || !requestReason) return
    try {
      await api.createAccessRequest({
        documentId: selectedDoc.id,
        requestedPermission: requestPermLevel,
        reason: requestReason,
      })
      notify('Access request submitted to document owner', 'success')
      setModal(null)
      setRequestReason('')
      await loadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleCreateRenewal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRenewalPerm || !requestReason) return
    try {
      await api.createRenewal({
        permissionId: selectedRenewalPerm.id,
        reason: requestReason,
        requestedExtensionDays: parseInt(grantDays) || 30,
      })
      notify('Renewal request submitted to owner', 'success')
      setModal(null)
      setRequestReason('')
      await loadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName) return
    try {
      await api.createProject({ name: projectName, description: projectDesc })
      notify(`Project "${projectName}" created successfully`, 'success')
      setModal(null)
      setProjectName('')
      setProjectDesc('')
      await loadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleToggleUserStatus = async (user: UserManagementItem) => {
    try {
      await api.toggleUserStatus(user.id, !user.active)
      notify(`User ${user.email} ${!user.active ? 'activated' : 'deactivated'}`, 'success')
      await loadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const currentNav = nav[role]

  return (
    <div className="min-h-screen bg-[#f4f8fd] text-[#182944]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[256px] flex-col border-r border-[#e4ebf5] bg-white px-5 py-6 lg:flex">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#2463eb] text-white shadow-lg shadow-blue-200">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="text-[17px] font-bold tracking-tight text-[#12233f]">TrustVault</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ba0bf]">Secure • Share • Audit</div>
          </div>
        </div>

        {/* Account Selector Pill */}
        <div className="mt-6 rounded-xl border border-[#e5ebf4] bg-[#f8fbff] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">Active Identity</div>
          <div className="mt-1 flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#1a2d49]">{currentUserName}</p>
              <p className="truncate text-[10px] text-[#7d90a8]">{currentUserEmail}</p>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${
                role === 'ADMIN'
                  ? 'bg-[#fee2e2] text-[#dc2626]'
                  : role === 'OWNER'
                  ? 'bg-[#dbeafe] text-[#2563eb]'
                  : 'bg-[#dcfce7] text-[#16a34a]'
              }`}
            >
              {role}
            </span>
          </div>

          {/* Quick Demo Switcher */}
          <div className="mt-3 flex flex-col gap-1 border-t border-[#e2eaf5] pt-2">
            <span className="text-[9px] font-semibold text-[#8ba0bf]">Switch Role / Account:</span>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => switchAccount(acc.email, acc.role, acc.name)}
                  className={`rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold transition ${
                    currentUserEmail === acc.email
                      ? 'bg-[#2463eb] text-white'
                      : 'bg-white text-[#425570] hover:bg-[#edf4ff]'
                  }`}
                >
                  <span className="block truncate">{acc.name.split(' ')[0]}</span>
                  <span className="block text-[8px] opacity-75">{acc.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {currentNav.map(([label, Icon]) => {
            const isActive = activeNav === label
            return (
              <button
                key={label}
                onClick={() => setActiveNav(label)}
                className={`flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-bold transition ${
                  isActive
                    ? 'bg-[#2463eb] text-white shadow-md shadow-blue-200'
                    : 'text-[#687b95] hover:bg-[#edf4ff] hover:text-[#2463eb]'
                }`}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Backend Status indicator */}
        <div className="mt-auto rounded-xl border border-[#e5ebf4] bg-[#fafcff] p-3 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-[#233550]">Backend: Spring Boot 3</span>
          </div>
          <p className="mt-1 text-[10px] text-[#8194ad]">Relational DB • HMAC-SHA256 • Cryptographic Hash Chaining</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-col lg:pl-[256px]">
        {/* Top Header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#e4ebf5] bg-white/95 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold text-[#142643]">
              {role === 'ADMIN' ? 'Admin Security Console' : role === 'OWNER' ? 'Owner Vault Dashboard' : 'Viewer Workspace'}
            </h1>
            <span className="hidden rounded-full bg-[#f0f5ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#2463eb] md:inline-block">
              {activeNav}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Mode Badge */}
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500"></span>
              Live Vault (localhost:8080)
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              title="Refresh Data from Backend"
              className="grid size-9 place-items-center rounded-xl border border-[#e2eaf5] text-[#556984] hover:bg-[#f3f7fd]"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin text-[#2463eb]' : ''}`} />
            </button>

            {/* Upload Button (for Owner/Admin) */}
            {(role === 'OWNER' || role === 'ADMIN') && (
              <button
                onClick={() => setModal('upload')}
                className="flex h-9 items-center gap-2 rounded-xl bg-[#2463eb] px-4 text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-[#1d55cc]"
              >
                <Upload className="size-3.5" />
                Upload Document
              </button>
            )}

            {/* Request Access Button (for Viewer) */}
            {role === 'VIEWER' && (
              <button
                onClick={() => {
                  if (documents.length > 0) setSelectedDoc(documents[0])
                  setModal('request-access')
                }}
                className="flex h-9 items-center gap-2 rounded-xl bg-[#2463eb] px-4 text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-[#1d55cc]"
              >
                <Plus className="size-3.5" />
                Request Access
              </button>
            )}
          </div>
        </header>

        {/* Main Body Container */}
        <main className="flex-1 p-6">
          {/* Stats Bar */}
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(([title, val, sub, Icon, color]) => (
              <div
                key={title}
                className="flex items-center justify-between rounded-2xl border border-[#e5ebf4] bg-white p-5 shadow-[0_4px_18px_rgba(35,71,125,0.03)]"
              >
                <div>
                  <p className="text-xs font-semibold text-[#8193ac]">{title}</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#152744]">{val}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#2bb47e]">{sub}</p>
                </div>
                <div
                  className={`grid size-12 place-items-center rounded-2xl ${
                    color === 'blue'
                      ? 'bg-[#edf4ff] text-[#2463eb]'
                      : color === 'purple'
                      ? 'bg-[#f4efff] text-[#7e4fe3]'
                      : color === 'green'
                      ? 'bg-[#eaf8f1] text-[#22a46b]'
                      : 'bg-[#fff2e8] text-[#e88842]'
                  }`}
                >
                  <Icon className="size-6" />
                </div>
              </div>
            ))}
          </section>

          {/* VIEW: AUDIT LOGS (for Admin or Owner) */}
          {activeNav === 'Audit Logs' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4ebf5] bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-[#142643]">Tamper-Resistant Audit Trail</h2>
                  <p className="mt-0.5 text-xs text-[#7d90a8]">
                    Immutable append-only records secured with SHA-256 cryptographic hash-chaining.
                  </p>
                </div>
                {role === 'ADMIN' && (
                  <button
                    onClick={handleVerifyIntegrity}
                    className="flex h-10 items-center gap-2 rounded-xl bg-[#142643] px-4 text-xs font-bold text-white hover:bg-[#1f375f]"
                  >
                    <ShieldCheck className="size-4 text-[#4fe396]" />
                    Verify Chain Integrity
                  </button>
                )}
              </div>

              {integrityStatus && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
                  {integrityStatus}
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-[#e4ebf5] bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e5ebf4] bg-[#f8fbff] text-[11px] font-bold uppercase tracking-wider text-[#7990b0]">
                    <tr>
                      <th className="px-5 py-3.5">Timestamp (UTC)</th>
                      <th className="px-5 py-3.5">Action</th>
                      <th className="px-5 py-3.5">Actor</th>
                      <th className="px-5 py-3.5">Resource</th>
                      <th className="px-5 py-3.5">Result</th>
                      <th className="px-5 py-3.5">SHA-256 Current Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f4fa]">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-xs text-[#95a4b8]">
                          No audit events recorded yet
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#fafcff]">
                          <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[11px] text-[#61738c]">
                            {new Date(log.timestamp).toLocaleTimeString()} • {new Date(log.timestamp).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-[#1f314d]">{log.action}</td>
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-[#3b4e69]">{log.actorEmail}</span>
                            <span className="ml-1.5 rounded bg-[#eef3fb] px-1.5 py-0.5 text-[9px] font-bold text-[#647997]">
                              {log.actorRole}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[#546782]">
                            {log.resourceType}: <span className="font-mono text-[10px]">{log.resourceId?.slice(0, 8)}...</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                log.result === 'SUCCESS' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'
                              }`}
                            >
                              {log.result}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[10px] text-[#8699b2]">
                            {log.currentHash?.slice(0, 16)}...
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: ADMIN USERS */}
          {activeNav === 'Users' && role === 'ADMIN' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between rounded-2xl border border-[#e4ebf5] bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-[#142643]">User Account Directory</h2>
                  <p className="mt-0.5 text-xs text-[#7d90a8]">
                    Manage user access, role assignments, and instant account activation/deactivation.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#e4ebf5] bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e5ebf4] bg-[#f8fbff] text-[11px] font-bold uppercase tracking-wider text-[#7990b0]">
                    <tr>
                      <th className="px-5 py-3.5">User</th>
                      <th className="px-5 py-3.5">Role</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Registered</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f4fa]">
                    {adminUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[#fafcff]">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-[#1f314d]">{u.fullName}</p>
                          <p className="text-[11px] text-[#788ca6]">{u.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              u.role === 'ROLE_ADMIN'
                                ? 'bg-red-50 text-red-600'
                                : u.role === 'ROLE_OWNER'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {u.role.replace('ROLE_', '')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {u.active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-[#7487a2]">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                              u.active
                                ? 'border border-[#fed7d7] bg-[#fff5f5] text-[#e53e3e] hover:bg-[#fed7d7]'
                                : 'border border-[#c6f6d5] bg-[#f0fff4] text-[#2f855a] hover:bg-[#c6f6d5]'
                            }`}
                          >
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: MY PROJECTS */}
          {activeNav === 'My Projects' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between rounded-2xl border border-[#e4ebf5] bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-[#142643]">Collaborative Projects</h2>
                  <p className="mt-0.5 text-xs text-[#7d90a8]">
                    Organize documents into projects. (Project membership does not grant automatic access to confidential documents).
                  </p>
                </div>
                {role === 'OWNER' && (
                  <button
                    onClick={() => setModal('create-project')}
                    className="flex h-9 items-center gap-2 rounded-xl bg-[#2463eb] px-4 text-xs font-bold text-white hover:bg-[#1d55cc]"
                  >
                    <Plus className="size-3.5" />
                    New Project
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#e4ebf5] bg-white p-5 shadow-[0_4px_18px_rgba(35,71,125,0.03)]"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="grid size-10 place-items-center rounded-xl bg-[#edf4ff] text-[#2463eb]">
                          <FolderKanban className="size-5" />
                        </div>
                        <span className="rounded-md bg-[#f0f4fa] px-2 py-0.5 text-[10px] font-bold text-[#687b95]">
                          Owner: {proj.ownerName.split(' ')[0]}
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-[#192b47]">{proj.name}</h3>
                      <p className="mt-1 text-xs text-[#8091a7]">{proj.description || 'No description provided'}</p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-[#f0f4fa] pt-3 text-[11px] font-semibold text-[#667994]">
                      <span>{proj.documentCount} Documents</span>
                      <span>{proj.memberCount} Members</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: ACCESS REQUESTS (Owner review or Viewer submitted) */}
          {activeNav === 'Access Requests' || activeNav === 'My Access Requests' ? (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between rounded-2xl border border-[#e4ebf5] bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-[#142643]">
                    {role === 'OWNER' ? 'Access Requests for Your Documents' : 'Your Submitted Access Requests'}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7d90a8]">
                    Review or track permission grant requests with justification reasons and expiry timelines.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#e4ebf5] bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e5ebf4] bg-[#f8fbff] text-[11px] font-bold uppercase tracking-wider text-[#7990b0]">
                    <tr>
                      <th className="px-5 py-3.5">Document</th>
                      <th className="px-5 py-3.5">Requester</th>
                      <th className="px-5 py-3.5">Permission</th>
                      <th className="px-5 py-3.5">Reason</th>
                      <th className="px-5 py-3.5">Status</th>
                      {role === 'OWNER' && <th className="px-5 py-3.5 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f4fa]">
                    {accessRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-xs text-[#95a4b8]">
                          No access requests found
                        </td>
                      </tr>
                    ) : (
                      accessRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-[#fafcff]">
                          <td className="px-5 py-3.5 font-bold text-[#1e304b]">{req.documentTitle}</td>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-[#30435f]">{req.requesterName}</p>
                            <p className="text-[10px] text-[#7d90a8]">{req.requesterEmail}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                req.requestedPermission === 'EDIT'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {req.requestedPermission}
                            </span>
                          </td>
                          <td className="max-w-xs truncate px-5 py-3.5 text-[#586b85]">{req.reason}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                req.status === 'APPROVED'
                                  ? 'bg-[#dcfce7] text-[#15803d]'
                                  : req.status === 'REJECTED'
                                  ? 'bg-[#fee2e2] text-[#b91c1c]'
                                  : 'bg-[#fff0e5] text-[#e8904e]'
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          {role === 'OWNER' && (
                            <td className="px-5 py-3.5 text-right">
                              {req.status === 'PENDING' ? (
                                <button
                                  onClick={() => {
                                    setSelectedRequest(req)
                                    setModal('review-request')
                                  }}
                                  className="rounded-lg bg-[#2463eb] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1d55cc]"
                                >
                                  Review
                                </button>
                              ) : (
                                <span className="text-[11px] font-semibold text-[#90a2b9]">Decided</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* VIEW: DEFAULT DOCUMENTS VIEW (Overview / My Documents / All Documents / Shared With Me) */}
          {(activeNav === 'Overview' ||
            activeNav === 'Dashboard' ||
            activeNav === 'My Documents' ||
            activeNav === 'All Documents' ||
            activeNav === 'Shared With Me' ||
            activeNav === 'Search') && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              {/* Left Column: Documents Table */}
              <div className="flex flex-col gap-4 xl:col-span-2">
                {/* Search & Filter Bar */}
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex flex-1 items-center">
                    <Search className="absolute left-3.5 size-4 text-[#8b9cb3]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search documents by name, category, or project..."
                      className="h-11 w-full rounded-2xl border border-[#e2eaf4] bg-white pl-10 pr-4 text-xs font-semibold text-[#253752] outline-none transition focus:border-[#2463eb] focus:shadow-sm"
                    />
                  </div>
                  <button className="flex h-11 items-center gap-2 rounded-2xl border border-[#e2eaf4] bg-white px-4 text-xs font-bold text-[#5a6c84] hover:bg-[#f8fbff]">
                    <Filter className="size-3.5 text-[#8b9cb3]" />
                    Filter
                  </button>
                </div>

                {/* Documents Table Container */}
                <div className="overflow-hidden rounded-2xl border border-[#e5ebf4] bg-white shadow-[0_4px_18px_rgba(35,71,125,0.03)]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e5ebf4] bg-[#f8fbff] text-[11px] font-bold uppercase tracking-wider text-[#7990b0]">
                      <tr>
                        <th className="px-5 py-3.5">Document</th>
                        <th className="px-5 py-3.5">Project</th>
                        <th className="px-5 py-3.5">Access Level</th>
                        <th className="px-5 py-3.5">Size</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f4fa]">
                      {filteredDocs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-xs text-[#95a4b8]">
                            No documents found matching your criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredDocs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-[#fafcff]">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf4ff] text-[#2463eb]">
                                  <FileText className="size-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-[#1b2d49]">{doc.title}</p>
                                  <div className="mt-0.5 flex items-center gap-2">
                                    <span className="rounded bg-[#f0f4fa] px-1.5 py-0.5 text-[9px] font-bold text-[#627692]">
                                      {doc.category}
                                    </span>
                                    {doc.isExpiringSoon && (
                                      <span className="flex items-center gap-1 rounded bg-[#fff0e5] px-1.5 py-0.5 text-[9px] font-bold text-[#e8904e]">
                                        <Clock3 className="size-2.5" /> Expiring Soon
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-[#5a6d88]">
                              {doc.projectName || '—'}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  doc.userAccessLevel === 'OWNER'
                                    ? 'bg-[#dbeafe] text-[#2563eb]'
                                    : doc.userAccessLevel === 'EDIT'
                                    ? 'bg-[#f3e8ff] text-[#9333ea]'
                                    : doc.userAccessLevel === 'READ'
                                    ? 'bg-[#dcfce7] text-[#16a34a]'
                                    : 'bg-[#f1f5f9] text-[#64748b]'
                                }`}
                              >
                                {doc.userAccessLevel}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-[11px] text-[#788ca6]">
                              {doc.formattedSize}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Download Button (for Owner, or user with READ/EDIT) */}
                                {(doc.userAccessLevel === 'OWNER' ||
                                  doc.userAccessLevel === 'READ' ||
                                  doc.userAccessLevel === 'EDIT') && (
                                  <button
                                    onClick={() => handleDownload(doc)}
                                    title="Download from secure vault"
                                    className="grid size-8 place-items-center rounded-lg border border-[#e2eaf5] text-[#556984] hover:bg-[#edf4ff] hover:text-[#2463eb]"
                                  >
                                    <Download className="size-3.5" />
                                  </button>
                                )}

                                {/* Edit Button (for Owner or EDIT grant) */}
                                {(doc.userAccessLevel === 'OWNER' || doc.userAccessLevel === 'EDIT') && (
                                  <button
                                    onClick={() => {
                                      setSelectedDoc(doc)
                                      setEditTitle(doc.title)
                                      setEditCategory(doc.category)
                                      setModal('edit-document')
                                    }}
                                    title="Edit document"
                                    className="grid size-8 place-items-center rounded-lg border border-[#e2eaf5] text-[#556984] hover:bg-[#edf4ff] hover:text-[#2463eb]"
                                  >
                                    <Edit3 className="size-3.5" />
                                  </button>
                                )}

                                {/* Share / Permissions Button (Owner Only) */}
                                {doc.userAccessLevel === 'OWNER' && (
                                  <button
                                    onClick={() => {
                                      setSelectedDoc(doc)
                                      setModal('manage-permissions')
                                    }}
                                    title="Grant/Manage Permissions"
                                    className="grid size-8 place-items-center rounded-lg border border-[#e2eaf5] text-[#556984] hover:bg-[#edf4ff] hover:text-[#2463eb]"
                                  >
                                    <LockKeyhole className="size-3.5" />
                                  </button>
                                )}

                                {/* Delete Button (Owner Only) */}
                                {doc.userAccessLevel === 'OWNER' && (
                                  <button
                                    onClick={() => handleDelete(doc)}
                                    title="Delete from vault"
                                    className="grid size-8 place-items-center rounded-lg border border-[#fed7d7] text-[#e53e3e] hover:bg-[#fee2e2]"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                )}

                                {/* Request Access (for Viewers with no access) */}
                                {doc.userAccessLevel === 'NONE' && (
                                  <button
                                    onClick={() => {
                                      setSelectedDoc(doc)
                                      setModal('request-access')
                                    }}
                                    className="rounded-lg bg-[#2463eb] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#1d55cc]"
                                  >
                                    Request
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Activity Stream & Pending Action Center */}
              <div className="flex flex-col gap-6">
                {/* Recent Workspace Events */}
                <section className="rounded-2xl border border-[#e5ebf4] bg-white p-5 shadow-[0_4px_18px_rgba(35,71,125,0.04)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-[#1d304d]">Recent Vault Activity</h2>
                      <p className="mt-0.5 text-xs text-[#96a4b7]">Security and access events</p>
                    </div>
                    <button
                      onClick={() => setActiveNav('Audit Logs')}
                      className="text-xs font-bold text-[#2463eb] hover:underline"
                    >
                      View all
                    </button>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    {[
                      ['Q4 Financial Report.pdf', 'You viewed this document', '12 min ago', Eye, 'blue'],
                      ['Product Roadmap 2025.docx', 'Access granted to Alex Morgan', '2 hr ago', Check, 'green'],
                      ['Employee Handbook.pdf', 'Permission expires in 7 days', 'Yesterday', Clock3, 'orange'],
                    ].map(([name, event, time, Icon, color]) => (
                      <div key={event} className="flex items-start gap-3">
                        <div
                          className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                            color === 'blue'
                              ? 'bg-[#edf4ff] text-[#2463eb]'
                              : color === 'green'
                              ? 'bg-[#eaf8f1] text-[#32a878]'
                              : 'bg-[#fff2e8] text-[#e99452]'
                          }`}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#41536e]">{event}</p>
                          <p className="mt-0.5 truncate text-[10px] text-[#99a7ba]">
                            {name} • {time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Pending Requests Card (For Owner) */}
                {role === 'OWNER' && (
                  <section className="rounded-2xl border border-[#e5ebf4] bg-white p-5 shadow-[0_4px_18px_rgba(35,71,125,0.04)]">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-[#1d304d]">Pending Requests</h2>
                        <p className="mt-0.5 text-xs text-[#96a4b7]">Review document access requests</p>
                      </div>
                      <span className="grid size-6 place-items-center rounded-full bg-[#fff0e5] text-[10px] font-bold text-[#e8904e]">
                        {accessRequests.filter((r) => r.status === 'PENDING').length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {accessRequests.filter((r) => r.status === 'PENDING').length === 0 ? (
                        <p className="py-3 text-center text-xs text-[#9aa9bc]">No pending requests</p>
                      ) : (
                        accessRequests
                          .filter((r) => r.status === 'PENDING')
                          .slice(0, 3)
                          .map((req) => (
                            <div key={req.id} className="flex items-center justify-between rounded-xl bg-[#fafcff] px-3 py-2.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e4edff] text-[9px] font-bold text-[#2463eb]">
                                  {req.requesterName[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold text-[#53657f]">
                                    {req.requesterName} • {req.requestedPermission}
                                  </p>
                                  <p className="truncate text-[9px] text-[#8e9eb3]">{req.documentTitle}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedRequest(req)
                                  setModal('review-request')
                                }}
                                className="text-[10px] font-bold text-[#2463eb] hover:underline"
                              >
                                Review
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </section>
                )}

                {/* Expiry Alert Card (For Viewer) */}
                {role === 'VIEWER' && (
                  <section className="rounded-2xl border border-[#e5ebf4] bg-white p-5 shadow-[0_4px_18px_rgba(35,71,125,0.04)]">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock3 className="size-4 text-[#e8904e]" />
                        <h2 className="text-sm font-bold text-[#1d304d]">Expiring Permissions</h2>
                      </div>
                    </div>
                    <p className="text-xs text-[#7d90a8]">
                      Request extension before your permissions expire to prevent access interruption.
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {permissions.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-xl bg-[#fafcff] p-3">
                          <div>
                            <p className="text-xs font-bold text-[#293d5a]">{p.documentTitle}</p>
                            <p className="text-[10px] text-[#8a9db5]">
                              Level: {p.permissionLevel} • Status: {p.status}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedRenewalPerm(p)
                              setModal('request-renewal')
                            }}
                            className="rounded-lg bg-[#edf4ff] px-2.5 py-1 text-[10px] font-bold text-[#2463eb] hover:bg-[#2463eb] hover:text-white"
                          >
                            Renew
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL DIALOGS */}
      {modal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#12233f]/30 p-4 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#2463eb]">TrustVault</p>
                <h2 className="mt-1 text-lg font-bold text-[#1a2d49]">
                  {modal === 'upload' && 'Upload document to Private Vault'}
                  {modal === 'review-request' && 'Review Access Request'}
                  {modal === 'request-access' && 'Request Document Access'}
                  {modal === 'request-renewal' && 'Request Permission Renewal'}
                  {modal === 'create-project' && 'Create Collaborative Project'}
                  {modal === 'manage-permissions' && 'Manage Document Permissions'}
                  {modal === 'edit-document' && 'Edit Document Metadata'}
                </h2>
                <p className="mt-1 text-xs text-[#8c9ab0]">
                  {modal === 'upload' && 'Files are validated for size, magic bytes, and stored privately.'}
                  {modal === 'review-request' && 'Decide access level and expiry timestamp.'}
                  {modal === 'request-access' && 'Submit business justification to the document owner.'}
                  {modal === 'request-renewal' && 'Request an extension before permission expires.'}
                  {modal === 'manage-permissions' && 'Grant or revoke READ/EDIT access to registered users.'}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="grid size-8 place-items-center rounded-lg text-[#91a0b4] hover:bg-[#f3f6fb]">
                <X className="size-4" />
              </button>
            </div>

            {/* Upload Modal */}
            {modal === 'upload' && (
              <form onSubmit={handleUpload} className="flex flex-col gap-4">
                <div className="relative grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-[#cbdcf8] bg-[#f8fbff] px-5 py-7 text-center hover:bg-[#edf4ff]">
                  <Upload className="mb-2 size-6 text-[#2463eb]" />
                  <p className="text-sm font-bold text-[#4c6180]">
                    {uploadFile ? uploadFile.name : 'Drop a file here or browse'}
                  </p>
                  <p className="mt-1 text-[11px] text-[#9aa9bc]">PDF, DOCX, XLSX up to 50 MB</p>
                  <input
                    type="file"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0])
                        if (!uploadTitle) setUploadTitle(e.target.files[0].name)
                      }
                    }}
                  />
                </div>

                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title / display name"
                  className="h-11 rounded-xl border border-[#e2eaf4] px-3.5 text-xs font-semibold outline-none focus:border-[#2463eb]"
                />

                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="h-11 rounded-xl border border-[#e2eaf4] px-3.5 text-xs font-semibold text-[#546882] outline-none"
                >
                  <option value="General">General</option>
                  <option value="Finance">Finance</option>
                  <option value="Planning">Planning</option>
                  <option value="HR">HR</option>
                  <option value="Design">Design</option>
                </select>

                <select
                  value={uploadProject}
                  onChange={(e) => setUploadProject(e.target.value)}
                  className="h-11 rounded-xl border border-[#e2eaf4] px-3.5 text-xs font-semibold text-[#546882] outline-none"
                >
                  <option value="">No Project (Standalone Document)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 rounded-xl bg-[#2463eb] text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-[#1d55cc]"
                >
                  {loading ? 'Uploading securely...' : 'Upload securely to Vault'}
                </button>
              </form>
            )}

            {/* Review Access Request Modal */}
            {modal === 'review-request' && selectedRequest && (
              <div className="flex flex-col gap-4">
                <div className="rounded-xl bg-[#f7faff] p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-lg bg-[#e9f2ff] text-[#2463eb]">
                      <FileText className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#293d5a]">{selectedRequest.documentTitle}</p>
                      <p className="text-[11px] text-[#92a1b5]">
                        Requested by: {selectedRequest.requesterName} ({selectedRequest.requesterEmail})
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-white p-3 text-xs text-[#52647f]">
                    <span className="font-bold">Reason:</span> {selectedRequest.reason}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleReviewRequest(true)}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2463eb] text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-[#1d55cc]"
                  >
                    <Check className="size-4" />
                    Approve request
                  </button>
                  <button
                    onClick={() => handleReviewRequest(false)}
                    className="h-11 rounded-xl border border-[#e3eaf3] px-5 text-xs font-bold text-[#6e7f98] hover:bg-[#f5f8fc]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Request Access Modal (Viewer) */}
            {modal === 'request-access' && selectedDoc && (
              <form onSubmit={handleCreateRequest} className="flex flex-col gap-4">
                <div className="rounded-xl bg-[#f7faff] p-3 text-xs">
                  <p className="font-bold text-[#20324d]">{selectedDoc.title}</p>
                  <p className="text-[10px] text-[#7d90a8]">Owner: {selectedDoc.ownerName}</p>
                </div>

                <select
                  value={requestPermLevel}
                  onChange={(e) => setRequestPermLevel(e.target.value as 'READ' | 'EDIT')}
                  className="h-11 rounded-xl border border-[#e2eaf4] px-3 text-xs font-semibold text-[#546882] outline-none"
                >
                  <option value="READ">READ — View and download</option>
                  <option value="EDIT">EDIT — View, download, and modify content</option>
                </select>

                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Business justification for requesting access..."
                  className="h-24 rounded-xl border border-[#e2eaf4] p-3 text-xs outline-none focus:border-[#2463eb]"
                  required
                />

                <button
                  type="submit"
                  className="h-11 rounded-xl bg-[#2463eb] text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-[#1d55cc]"
                >
                  Submit Access Request
                </button>
              </form>
            )}

            {/* Request Renewal Modal (Viewer) */}
            {modal === 'request-renewal' && selectedRenewalPerm && (
              <form onSubmit={handleCreateRenewal} className="flex flex-col gap-4">
                <div className="rounded-xl bg-[#f7faff] p-3 text-xs">
                  <p className="font-bold text-[#20324d]">{selectedRenewalPerm.documentTitle}</p>
                  <p className="text-[10px] text-[#7d90a8]">
                    Current expiry: {selectedRenewalPerm.expiresAt ? new Date(selectedRenewalPerm.expiresAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>

                <select
                  value={grantDays}
                  onChange={(e) => setGrantDays(e.target.value)}
                  className="h-11 rounded-xl border border-[#e2eaf4] px-3 text-xs font-semibold text-[#546882] outline-none"
                >
                  <option value="7">Extend by 7 days</option>
                  <option value="14">Extend by 14 days</option>
                  <option value="30">Extend by 30 days</option>
                  <option value="60">Extend by 60 days</option>
                </select>

                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Reason for renewal / continuing business need..."
                  className="h-20 rounded-xl border border-[#e2eaf4] p-3 text-xs outline-none focus:border-[#2463eb]"
                  required
                />

                <button
                  type="submit"
                  className="h-11 rounded-xl bg-[#2463eb] text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-[#1d55cc]"
                >
                  Submit Renewal Request
                </button>
              </form>
            )}

            {/* Grant Permission Modal (Owner) */}
            {modal === 'manage-permissions' && selectedDoc && (
              <form onSubmit={handleGrantPermission} className="flex flex-col gap-4">
                <div className="rounded-xl bg-[#f7faff] p-3 text-xs">
                  <p className="font-bold text-[#20324d]">{selectedDoc.title}</p>
                </div>

                <input
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="Registered user email (e.g. viewer@trustvault.local)"
                  className="h-11 rounded-xl border border-[#e2eaf4] px-3 text-xs font-semibold outline-none focus:border-[#2463eb]"
                  required
                />

                <select
                  value={grantLevel}
                  onChange={(e) => setGrantLevel(e.target.value as 'READ' | 'EDIT')}
                  className="h-11 rounded-xl border border-[#e2eaf4] px-3 text-xs font-semibold text-[#546882] outline-none"
                >
                  <option value="READ">READ — View and download</option>
                  <option value="EDIT">EDIT — View, download and modify</option>
                </select>

                <select
                  value={grantDays}
                  onChange={(e) => setGrantDays(e.target.value)}
                  className="h-11 rounded-xl border border-[#e2eaf4] px-3 text-xs font-semibold text-[#546882] outline-none"
                >
                  <option value="7">Expires in 7 days</option>
                  <option value="14">Expires in 14 days</option>
                  <option value="30">Expires in 30 days</option>
                  <option value="0">Never expires</option>
                </select>

                <button
                  type="submit"
                  className="h-11 rounded-xl bg-[#2463eb] text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-[#1d55cc]"
                >
                  Grant Permission
                </button>
              </form>
            )}

            {/* Create Project Modal */}
            {modal === 'create-project' && (
              <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                  className="h-11 rounded-xl border border-[#e2eaf4] px-3 text-xs font-semibold outline-none focus:border-[#2463eb]"
                  required
                />

                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Project description and scope..."
                  className="h-20 rounded-xl border border-[#e2eaf4] p-3 text-xs outline-none focus:border-[#2463eb]"
                />

                <button
                  type="submit"
                  className="h-11 rounded-xl bg-[#2463eb] text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-[#1d55cc]"
                >
                  Create Project
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold shadow-xl ${
            toast.type === 'error'
              ? 'bg-[#e53e3e] text-white'
              : toast.type === 'info'
              ? 'bg-[#1e293b] text-white'
              : 'bg-[#1c2e4a] text-white'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="size-4 text-white" />
          ) : (
            <Check className="size-4 text-[#72d3a7]" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  )
}
