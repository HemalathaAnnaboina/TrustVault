const fs = require('fs');

const workshopDashboardContent = `'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Clock3,
  Copy,
  Download,
  Edit2,
  Edit3,
  Eye,
  File,
  FileCheck2,
  FileText,
  Filter,
  FolderKanban,
  History,
  Home,
  Info,
  Lock,
  LockKeyhole,
  LogOut,
  Mail,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react'
import {
  api,
  AuditLogItem,
  DocumentItem,
  DocumentPreviewItem,
  DocumentVersionItem,
  PermissionItem,
  ProjectItem,
  AccessRequestItem,
  RenewalRequestItem,
  UserProfile,
  getToken,
  getUser,
  logout,
} from '../../lib/api'

type NavSection =
  | 'Overview'
  | 'My Projects'
  | 'My Documents'
  | 'Upload Document'
  | 'Access Requests'
  | 'Shared Documents'
  | 'My Activity'
  | 'Profile'

export default function WorkshopDashboard() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [activeNav, setActiveNav] = useState<NavSection>('Overview')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Real backend data states
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([])
  const [renewals, setRenewals] = useState<RenewalRequestItem[]>([])
  const [activityLogs, setActivityLogs] = useState<AuditLogItem[]>([])

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL')
  const [selectedPermissionFilter, setSelectedPermissionFilter] = useState<string>('ALL')

  // Modals state
  const [showRequestAccessModal, setShowRequestAccessModal] = useState(false)
  const [showRequestRenewalModal, setShowRequestRenewalModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showVersionsModal, setShowVersionsModal] = useState(false)

  // Selected document for modal operations
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null)
  const [previewData, setPreviewData] = useState<DocumentPreviewItem | null>(null)
  const [versionList, setVersionList] = useState<DocumentVersionItem[]>([])
  const [loadingAction, setLoadingAction] = useState(false)

  // Upload state (Editor only)
  const [uploadProjectId, setUploadProjectId] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('Engineering')
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Edit document state (Editor only)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')

  // Share document state
  const [shareRecipientEmail, setShareRecipientEmail] = useState('')
  const [sharePermissionLevel, setSharePermissionLevel] = useState<'READ' | 'EDIT'>('READ')
  const [shareDurationDays, setShareDurationDays] = useState<number>(14)

  // Request Access state
  const [reqProjectId, setReqProjectId] = useState<string>('')
  const [reqDocumentId, setReqDocumentId] = useState<string>('')
  const [reqUseManualFilename, setReqUseManualFilename] = useState<boolean>(false)
  const [reqManualFilename, setReqManualFilename] = useState<string>('')
  const [reqPermissionLevel, setReqPermissionLevel] = useState<'READ' | 'EDIT'>('READ')
  const [reqDurationDays, setReqDurationDays] = useState<number>(7)
  const [reqReason, setReqReason] = useState<string>('')
  const [reqValidationError, setReqValidationError] = useState<string | null>(null)

  // Request Renewal state
  const [renewalPermissionId, setRenewalPermissionId] = useState<string>('')
  const [renewalDurationDays, setRenewalDurationDays] = useState<number>(7)
  const [renewalReason, setRenewalReason] = useState<string>('')

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  // Authentication & initialization
  useEffect(() => {
    const token = getToken()
    const user = getUser()

    if (!token || !user) {
      router.replace('/login')
      return
    }

    if (user.role === 'ROLE_ADMIN') {
      router.replace('/admin')
      return
    }
    if (user.role === 'ROLE_OWNER') {
      router.replace('/owner/dashboard')
      return
    }

    setCurrentUser(user)
    loadAllData()
  }, [router])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [projData, docData, permData, reqData, renData, actData] = await Promise.all([
        api.getProjects().catch(() => []),
        api.getDocuments().catch(() => []),
        api.getMyPermissions().catch(() => []),
        api.getMyAccessRequests().catch(() => []),
        api.getMyRenewals().catch(() => []),
        api.getMyActivity().catch(() => []),
      ])

      setProjects(projData || [])
      setDocuments(docData || [])
      setPermissions(permData || [])
      setAccessRequests(reqData || [])
      setRenewals(renData || [])
      setActivityLogs(actData || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to sync data with server', 'error')
    } finally {
      setLoading(false)
    }
  }

  const isEditor = currentUser?.role === 'ROLE_EDITOR'
  const isViewer = currentUser?.role === 'ROLE_VIEWER'

  // Filtered documents for "My Documents"
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.originalFilename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.projectName && doc.projectName.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCategory =
        selectedCategory === 'ALL' || doc.category.toLowerCase() === selectedCategory.toLowerCase()

      const matchesProject =
        selectedProjectFilter === 'ALL' || doc.projectId === selectedProjectFilter

      const matchesPermission =
        selectedPermissionFilter === 'ALL' || doc.userAccessLevel === selectedPermissionFilter

      return matchesSearch && matchesCategory && matchesProject && matchesPermission
    })
  }, [documents, searchQuery, selectedCategory, selectedProjectFilter, selectedPermissionFilter])

  // Overview calculated statistics (derived directly from real backend responses)
  const overviewStats = useMemo(() => {
    const assignedProjectCount = projects.length
    const accessibleDocsCount = documents.length
    const pendingReqCount = accessRequests.filter((r) => r.status === 'PENDING').length
    const approvedReqCount = accessRequests.filter((r) => r.status === 'APPROVED').length

    // Expiring permissions within 7 days
    const now = new Date().getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const expiringSoonPerms = permissions.filter((p) => {
      if (!p.expiresAt || p.status !== 'ACTIVE') return false
      const expiry = new Date(p.expiresAt).getTime()
      return expiry > now && expiry - now <= sevenDaysMs
    })

    return {
      assignedProjectCount,
      accessibleDocsCount,
      pendingReqCount,
      approvedReqCount,
      expiringSoonCount: expiringSoonPerms.length,
      expiringSoonPerms,
    }
  }, [projects, documents, accessRequests, permissions])

  // Document preview handler
  const handleOpenPreview = async (doc: DocumentItem) => {
    setSelectedDoc(doc)
    setLoadingAction(true)
    setShowPreviewModal(true)
    try {
      const preview = await api.getDocumentPreview(doc.id)
      setPreviewData(preview)
    } catch (err: any) {
      showToast(err.message || 'Unable to preview document', 'error')
      setShowPreviewModal(false)
    } finally {
      setLoadingAction(false)
    }
  }

  // Document download handler (strictly requires EDIT or owner level)
  const handleDownload = async (doc: DocumentItem) => {
    if (doc.userAccessLevel !== 'EDIT' && doc.userAccessLevel !== 'OWNER') {
      showToast('Download denied: Download requires explicit EDIT permission on this document', 'error')
      return
    }

    setLoadingAction(true)
    try {
      const tokenRes = await api.getDownloadToken(doc.id)
      const downloadUrl = api.getDownloadUrl(tokenRes.token)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = doc.originalFilename || doc.title
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      showToast('Download started via secure single-use token', 'success')
      // Refresh activity log
      api.getMyActivity().then(setActivityLogs).catch(() => {})
    } catch (err: any) {
      showToast(err.message || 'Download authorization failed', 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  // Document edit handler (strictly requires EDIT or owner level)
  const handleOpenEdit = (doc: DocumentItem) => {
    if (doc.userAccessLevel !== 'EDIT' && doc.userAccessLevel !== 'OWNER') {
      showToast('Edit denied: Editing requires explicit active EDIT permission', 'error')
      return
    }
    setSelectedDoc(doc)
    setEditTitle(doc.title)
    setEditCategory(doc.category)
    setShowEditModal(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDoc) return

    setLoadingAction(true)
    try {
      await api.updateDocument(selectedDoc.id, {
        title: editTitle.trim(),
        category: editCategory.trim(),
      })
      showToast('Document metadata updated successfully', 'success')
      setShowEditModal(false)
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to update document', 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  // Document version history handler
  const handleOpenVersions = async (doc: DocumentItem) => {
    setSelectedDoc(doc)
    setLoadingAction(true)
    setShowVersionsModal(true)
    try {
      const versions = await api.getDocumentVersions(doc.id)
      setVersionList(versions)
    } catch (err: any) {
      showToast(err.message || 'Failed to load version history', 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  // Share document handler (Editor sharing with Manager/Admin)
  const handleOpenShare = (doc: DocumentItem) => {
    setSelectedDoc(doc)
    setShareRecipientEmail('')
    setSharePermissionLevel('READ')
    setShareDurationDays(14)
    setShowShareModal(true)
  }

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDoc || !shareRecipientEmail.trim()) {
      showToast('Recipient email is required', 'error')
      return
    }

    setLoadingAction(true)
    try {
      const expiry = shareDurationDays > 0 ? new Date(Date.now() + shareDurationDays * 86400000).toISOString() : null
      await api.grantPermission(selectedDoc.id, {
        userEmail: shareRecipientEmail.trim(),
        permissionLevel: sharePermissionLevel,
        expiresAt: expiry,
      })
      showToast(\`Document shared successfully with \${shareRecipientEmail.trim()}\`, 'success')
      setShowShareModal(false)
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Sharing authorization failed. Contact project manager.', 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  // Project-level document upload handler (Editor only)
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploadError(null)

    if (!isEditor) {
      setUploadError('Only authorized project Editors are permitted to upload documents.')
      return
    }
    if (!uploadProjectId) {
      setUploadError('Please select an authorized project.')
      return
    }
    if (!uploadFile) {
      setUploadError('Please select a file to upload.')
      return
    }

    // Client-side file size guard (50 MB)
    if (uploadFile.size > 50 * 1024 * 1024) {
      setUploadError('File size exceeds the 50MB policy limit.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadTitle.trim() || uploadFile.name)
      formData.append('category', uploadCategory.trim() || 'Engineering')
      formData.append('projectId', uploadProjectId)

      await api.uploadDocument(formData)
      showToast(\`Document "\${uploadTitle.trim() || uploadFile.name}" uploaded successfully\`, 'success')
      setUploadFile(null)
      setUploadTitle('')
      setUploadCategory('Engineering')
      setActiveNav('My Documents')
      loadAllData()
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed: Server rejected project upload authorization')
    } finally {
      setLoading(false)
    }
  }

  // Request Access submit handler
  const handleRequestAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqValidationError(null)

    if (!reqReason.trim()) {
      setReqValidationError('A mandatory business justification/reason is required.')
      return
    }
    if (reqDurationDays <= 0 || reqDurationDays > 90) {
      setReqValidationError('Requested duration must be between 1 and 90 days.')
      return
    }
    if (!reqProjectId && !reqDocumentId) {
      setReqValidationError('Please select a project or reference document.')
      return
    }
    if (reqUseManualFilename && !reqManualFilename.trim()) {
      setReqValidationError('Please enter the specific requested document filename.')
      return
    }

    setLoading(true)
    try {
      await api.createAccessRequest({
        documentId: reqUseManualFilename ? null : reqDocumentId || null,
        projectId: reqProjectId || null,
        requestedFilename: reqUseManualFilename ? reqManualFilename.trim() : null,
        requestedPermission: reqPermissionLevel,
        durationDays: reqDurationDays,
        reason: reqReason.trim(),
      })

      showToast('Access request submitted for Manager review', 'success')
      setShowRequestAccessModal(false)
      setReqReason('')
      setReqManualFilename('')
      setReqUseManualFilename(false)
      setReqDocumentId('')
      setReqProjectId('')
      loadAllData()
    } catch (err: any) {
      setReqValidationError(err.message || 'Failed to submit access request')
    } finally {
      setLoading(false)
    }
  }

  // Request Renewal submit handler
  const handleRequestRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renewalPermissionId) {
      showToast('Please select a permission to renew', 'error')
      return
    }
    if (!renewalReason.trim()) {
      showToast('A business justification for renewal is required', 'error')
      return
    }

    setLoading(true)
    try {
      await api.createRenewal({
        permissionId: renewalPermissionId,
        requestedExtensionDays: renewalDurationDays,
        reason: renewalReason.trim(),
      })
      showToast('Renewal request submitted for Manager review', 'success')
      setShowRequestRenewalModal(false)
      setRenewalReason('')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to submit renewal request', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={\`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg backdrop-blur-sm transition-all animate-in fade-in slide-in-from-bottom-3 \${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : toast.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-slate-200 bg-white text-slate-800'
          }\`}
        >
          {toast.type === 'success' && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />}
          {toast.type === 'error' && <AlertCircle className="size-4 shrink-0 text-rose-600" />}
          {toast.type === 'info' && <Info className="size-4 shrink-0 text-teal-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* SIDEBAR NAVIGATION                                            */}
      {/* ============================================================ */}
      <aside className="w-64 shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col justify-between">
        <div>
          {/* Logo & Workspace Title */}
          <div className="p-6 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-[#14213D] text-white shadow-sm">
                <Shield className="size-5 text-[#14B8A6]" />
              </div>
              <div>
                <h1 className="text-sm font-extrabold tracking-tight text-[#14213D]">TrustVault</h1>
                <p className="text-[10px] font-semibold tracking-wider uppercase text-[#0D9488]">
                  Workshop Workspace
                </p>
              </div>
            </div>

            {/* Current Role Badge */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <div className="flex items-center gap-2">
                <div
                  className={\`size-2 rounded-full \${
                    isEditor ? 'bg-amber-500 animate-pulse' : 'bg-teal-500'
                  }\`}
                />
                <span className="text-xs font-bold text-[#14213D]">
                  {isEditor ? 'Workshop Editor' : 'Workshop Viewer'}
                </span>
              </div>
              <span className="rounded-md bg-white border border-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-mono text-[#64748B]">
                {currentUser?.email?.split('@')[0]}
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveNav('Overview')}
              className={\`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition \${
                activeNav === 'Overview'
                  ? 'bg-[#14213D] text-white shadow-sm'
                  : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              }\`}
            >
              <Home className="size-4 shrink-0" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveNav('My Projects')}
              className={\`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition \${
                activeNav === 'My Projects'
                  ? 'bg-[#14213D] text-white shadow-sm'
                  : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              }\`}
            >
              <div className="flex items-center gap-3">
                <FolderKanban className="size-4 shrink-0" />
                <span>My Projects</span>
              </div>
              <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[10px] text-[#334155]">
                {projects.length}
              </span>
            </button>

            <button
              onClick={() => setActiveNav('My Documents')}
              className={\`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition \${
                activeNav === 'My Documents'
                  ? 'bg-[#14213D] text-white shadow-sm'
                  : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              }\`}
            >
              <div className="flex items-center gap-3">
                <FileText className="size-4 shrink-0" />
                <span>My Documents</span>
              </div>
              <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[10px] text-[#334155]">
                {documents.length}
              </span>
            </button>

            {/* Upload Document - Editor only */}
            {isEditor && (
              <button
                onClick={() => setActiveNav('Upload Document')}
                className={\`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition \${
                  activeNav === 'Upload Document'
                    ? 'bg-[#14213D] text-white shadow-sm'
                    : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }\`}
              >
                <Upload className="size-4 shrink-0 text-[#0D9488]" />
                <span>Upload Document</span>
              </button>
            )}

            <button
              onClick={() => setActiveNav('Access Requests')}
              className={\`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition \${
                activeNav === 'Access Requests'
                  ? 'bg-[#14213D] text-white shadow-sm'
                  : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              }\`}
            >
              <div className="flex items-center gap-3">
                <FileCheck2 className="size-4 shrink-0" />
                <span>Access Requests</span>
              </div>
              {overviewStats.pendingReqCount > 0 && (
                <span className="rounded-full bg-amber-100 text-amber-800 font-bold px-2 py-0.5 text-[10px]">
                  {overviewStats.pendingReqCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('Shared Documents')}
              className={\`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition \${
                activeNav === 'Shared Documents'
                  ? 'bg-[#14213D] text-white shadow-sm'
                  : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              }\`}
            >
              <div className="flex items-center gap-3">
                <Share2 className="size-4 shrink-0" />
                <span>Shared Documents</span>
              </div>
              <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[10px] text-[#334155]">
                {permissions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveNav('My Activity')}
              className={\`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition \${
                activeNav === 'My Activity'
                  ? 'bg-[#14213D] text-white shadow-sm'
                  : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              }\`}
            >
              <Activity className="size-4 shrink-0" />
              <span>My Activity</span>
            </button>

            <button
              onClick={() => setActiveNav('Profile')}
              className={\`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition \${
                activeNav === 'Profile'
                  ? 'bg-[#14213D] text-white shadow-sm'
                  : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              }\`}
            >
              <User className="size-4 shrink-0" />
              <span>Profile / Account</span>
            </button>
          </nav>
        </div>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-[#F1F5F9] space-y-3">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#64748B]">
            <div className="font-bold text-[#14213D]">{currentUser?.fullName}</div>
            <div className="text-[11px] truncate">{currentUser?.email}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Account Active</span>
            </div>
          </div>

          <button
            onClick={() => {
              logout()
              router.replace('/login')
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F1F5F9] hover:text-rose-600"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN CONTENT AREA                                             */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white px-8">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-extrabold text-[#14213D]">{activeNav}</h2>
            {overviewStats.expiringSoonCount > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                <AlertTriangle className="size-3 text-amber-600" />
                <span>{overviewStats.expiringSoonCount} expiring soon</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Quick action: Request Access */}
            <button
              onClick={() => {
                setReqValidationError(null)
                setShowRequestAccessModal(true)
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#243B64]"
            >
              <Plus className="size-3.5 text-[#14B8A6]" />
              <span>Request Access</span>
            </button>

            {/* Quick action: Request Renewal */}
            <button
              onClick={() => setShowRequestRenewalModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#14213D] shadow-sm transition hover:bg-[#F8FAFC]"
            >
              <Clock3 className="size-3.5 text-[#0D9488]" />
              <span>Request Renewal</span>
            </button>

            {/* Refresh Data Button */}
            <button
              onClick={loadAllData}
              title="Refresh Data"
              className="grid size-9 place-items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] transition hover:bg-[#E2E8F0] hover:text-[#0F172A]"
            >
              <RefreshCw className={\`size-4 \${loading ? 'animate-spin' : ''}\`} />
            </button>
          </div>
        </header>

        {/* Dynamic View Body */}
        <main className="p-8 space-y-6">
          {/* ============================================================ */}
          {/* TAB 1: OVERVIEW                                              */}
          {/* ============================================================ */}
          {activeNav === 'Overview' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-[#64748B]">
                    <span>Assigned Projects</span>
                    <FolderKanban className="size-4 text-[#0D9488]" />
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-[#14213D]">
                    {overviewStats.assignedProjectCount}
                  </div>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">Authorized project memberships</p>
                </div>

                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-[#64748B]">
                    <span>Accessible Files</span>
                    <FileText className="size-4 text-[#0D9488]" />
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-[#14213D]">
                    {overviewStats.accessibleDocsCount}
                  </div>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">Active authorized document grants</p>
                </div>

                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-[#64748B]">
                    <span>Pending Requests</span>
                    <Clock className="size-4 text-amber-500" />
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-[#14213D]">
                    {overviewStats.pendingReqCount}
                  </div>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">Awaiting Manager review</p>
                </div>

                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-[#64748B]">
                    <span>Approved Requests</span>
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-[#14213D]">
                    {overviewStats.approvedReqCount}
                  </div>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">Permitted by project managers</p>
                </div>
              </div>

              {/* Expiring Soon Alert Banner */}
              {overviewStats.expiringSoonCount > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-xs font-bold text-amber-900">
                        {overviewStats.expiringSoonCount} document permission(s) expiring within 7 days
                      </h3>
                      <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                        Submit a renewal request before expiration to prevent interruption of access.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {overviewStats.expiringSoonPerms.map((p) => (
                          <div
                            key={p.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs text-amber-900 shadow-2xs"
                          >
                            <span className="font-bold">{p.documentTitle}</span>
                            <span className="text-[10px] text-amber-700">
                              Expires {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Authorized Activity */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#14213D]">Recent Authorized Activity</h3>
                    <p className="text-xs text-[#64748B]">
                      Audit history of document operations performed by your account
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveNav('My Activity')}
                    className="flex items-center gap-1 text-xs font-bold text-[#0D9488] hover:underline"
                  >
                    <span>View all activity</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>

                <div className="mt-4 divide-y divide-[#F1F5F9]">
                  {activityLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span
                          className={\`size-2 rounded-full \${
                            log.result === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                          }\`}
                        />
                        <div>
                          <span className="font-bold text-[#14213D]">{log.action}</span>
                          <span className="mx-2 text-[#94A3B8]">•</span>
                          <span className="text-[#64748B]">{log.reason || log.resourceType}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#94A3B8]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}

                  {activityLogs.length === 0 && (
                    <div className="py-8 text-center text-xs text-[#94A3B8]">
                      No recorded activity for your account yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: MY PROJECTS                                           */}
          {/* ============================================================ */}
          {activeNav === 'My Projects' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-[#14213D]">Assigned Projects</h3>
                  <p className="text-xs text-[#64748B]">
                    Projects in which your account is an authorized participant
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition hover:border-[#CBD5E1]"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                          Project
                        </span>
                        <span className="text-[11px] text-[#94A3B8]">
                          {new Date(proj.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="mt-3 text-sm font-extrabold text-[#14213D]">{proj.name}</h4>
                      <p className="mt-1 text-xs text-[#64748B] line-clamp-2">
                        {proj.description || 'No project description provided.'}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-[#F1F5F9] pt-4 flex items-center justify-between text-xs">
                      <div className="text-[#64748B]">
                        <span>Manager: </span>
                        <span className="font-bold text-[#14213D]">{proj.ownerName}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEditor && (
                          <button
                            onClick={() => {
                              setUploadProjectId(proj.id)
                              setActiveNav('Upload Document')
                            }}
                            className="rounded-lg bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-100 transition"
                          >
                            Upload File
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedProjectFilter(proj.id)
                            setActiveNav('My Documents')
                          }}
                          className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-bold text-[#334155] hover:bg-[#F1F5F9] transition"
                        >
                          View Files
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {projects.length === 0 && (
                  <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white">
                    <FolderKanban className="size-10 text-[#94A3B8] mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-[#14213D]">No Projects Assigned</h4>
                    <p className="mt-1 text-xs text-[#64748B]">
                      You have not been added to any active project teams yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: MY DOCUMENTS                                          */}
          {/* ============================================================ */}
          {activeNav === 'My Documents' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Search & Filter Bar */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 size-4 text-[#94A3B8]" />
                    <input
                      type="text"
                      placeholder="Search accessible documents by title or filename..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pl-9 pr-3 text-xs text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <select
                      value={selectedProjectFilter}
                      onChange={(e) => setSelectedProjectFilter(e.target.value)}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#334155] focus:outline-none"
                    >
                      <option value="ALL">All Projects</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedPermissionFilter}
                      onChange={(e) => setSelectedPermissionFilter(e.target.value)}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#334155] focus:outline-none"
                    >
                      <option value="ALL">All Permissions</option>
                      <option value="READ">READ (Preview Only)</option>
                      <option value="EDIT">EDIT (Full Edit & Download)</option>
                      <option value="OWNER">OWNER</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Documents Table */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#F1F5F9] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase">
                      <tr>
                        <th className="px-6 py-3.5">Document</th>
                        <th className="px-6 py-3.5">Project</th>
                        <th className="px-6 py-3.5">Owner / Uploader</th>
                        <th className="px-6 py-3.5">Access Level</th>
                        <th className="px-6 py-3.5">Expiry</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {filteredDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-[#F8FAFC] transition">
                          <td className="px-6 py-4">
                            <div className="font-extrabold text-[#14213D]">{doc.title}</div>
                            <div className="text-[11px] text-[#64748B]">{doc.originalFilename} • {doc.formattedSize}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {doc.projectName || 'General Vault'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#475569]">
                            {doc.ownerName}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={\`rounded-md border px-2 py-0.5 text-[10px] font-bold \${
                                doc.userAccessLevel === 'OWNER'
                                  ? 'border-purple-200 bg-purple-50 text-purple-800'
                                  : doc.userAccessLevel === 'EDIT'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : doc.userAccessLevel === 'READ'
                                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                              }\`}
                            >
                              {doc.userAccessLevel}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#64748B]">
                            {doc.expiresAt ? (
                              <span className={doc.isExpiringSoon ? 'text-amber-600 font-bold' : ''}>
                                {new Date(doc.expiresAt).toLocaleDateString()}
                              </span>
                            ) : (
                              'Permanent'
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Preview Action (allowed for READ, EDIT, OWNER) */}
                              <button
                                onClick={() => handleOpenPreview(doc)}
                                title="Preview Document"
                                className="grid size-8 place-items-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F1F5F9] transition"
                              >
                                <Eye className="size-3.5" />
                              </button>

                              {/* Download Action (strictly EDIT or OWNER) */}
                              {doc.userAccessLevel === 'EDIT' || doc.userAccessLevel === 'OWNER' ? (
                                <button
                                  onClick={() => handleDownload(doc)}
                                  title="Download Document"
                                  className="grid size-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                                >
                                  <Download className="size-3.5" />
                                </button>
                              ) : (
                                <button
                                  disabled
                                  title="Download requires EDIT permission"
                                  className="grid size-8 place-items-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                                >
                                  <Download className="size-3.5" />
                                </button>
                              )}

                              {/* Edit Action (strictly EDIT or OWNER) */}
                              {(doc.userAccessLevel === 'EDIT' || doc.userAccessLevel === 'OWNER') && (
                                <button
                                  onClick={() => handleOpenEdit(doc)}
                                  title="Edit Document"
                                  className="grid size-8 place-items-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F1F5F9] transition"
                                >
                                  <Edit3 className="size-3.5" />
                                </button>
                              )}

                              {/* Version History */}
                              <button
                                onClick={() => handleOpenVersions(doc)}
                                title="Version History"
                                className="grid size-8 place-items-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F1F5F9] transition"
                              >
                                <History className="size-3.5" />
                              </button>

                              {/* Share Document Action (clearly visible) */}
                              <button
                                onClick={() => handleOpenShare(doc)}
                                title="Share Document with Manager / Admin"
                                className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1.5 text-[11px] font-bold text-teal-800 hover:bg-teal-100 transition"
                              >
                                <Share2 className="size-3 text-teal-600" />
                                <span>Share</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredDocuments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-xs text-[#94A3B8]">
                            No documents found matching your filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: UPLOAD DOCUMENT (Editor only, project-scoped)         */}
          {/* ============================================================ */}
          {activeNav === 'Upload Document' && isEditor && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                <div className="border-b border-[#F1F5F9] pb-4">
                  <h3 className="text-sm font-extrabold text-[#14213D]">Project Document Upload</h3>
                  <p className="text-xs text-[#64748B]">
                    Upload files into an assigned project under enterprise security policy
                  </p>
                </div>

                {uploadError && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">
                      Authorized Project *
                    </label>
                    <select
                      required
                      value={uploadProjectId}
                      onChange={(e) => setUploadProjectId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                    >
                      <option value="">Select project...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Manager: {p.ownerName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">Document Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Q4 Architectural Specification"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">Category</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Finance">Finance</option>
                      <option value="Legal">Legal</option>
                      <option value="Security">Security</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">Select File *</label>
                    <input
                      type="file"
                      required
                      onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                      className="mt-1 w-full text-xs text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-[#14213D] file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-[#243B64]"
                    />
                    <p className="mt-1 text-[11px] text-[#94A3B8]">
                      Supported formats: PDF, DOCX, XLSX, TXT, JSON, PNG, JPG (Max 50MB)
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#14213D] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#243B64] transition disabled:opacity-60"
                    >
                      {loading ? (
                        <RefreshCw className="size-4 animate-spin text-teal-300" />
                      ) : (
                        <>
                          <Upload className="size-4 text-[#14B8A6]" />
                          <span>Upload into Project</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 5: ACCESS REQUESTS                                       */}
          {/* ============================================================ */}
          {activeNav === 'Access Requests' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-[#14213D]">My Access Requests</h3>
                  <p className="text-xs text-[#64748B]">
                    Track status of requested document permissions and reviewer feedback
                  </p>
                </div>

                <button
                  onClick={() => {
                    setReqValidationError(null)
                    setShowRequestAccessModal(true)
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64] transition"
                >
                  <Plus className="size-3.5 text-[#14B8A6]" />
                  <span>New Request</span>
                </button>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#F1F5F9] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase">
                    <tr>
                      <th className="px-6 py-3.5">Requested Document</th>
                      <th className="px-6 py-3.5">Project</th>
                      <th className="px-6 py-3.5">Permission & Duration</th>
                      <th className="px-6 py-3.5">Reason / Justification</th>
                      <th className="px-6 py-3.5">Submitted</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Reviewer Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {accessRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-[#F8FAFC] transition">
                        <td className="px-6 py-4 font-bold text-[#14213D]">
                          {req.documentTitle || req.requestedFilename || 'Referenced Document'}
                        </td>
                        <td className="px-6 py-4 text-[#475569]">
                          {req.projectName || 'Project Scope'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#14213D]">{req.requestedPermission}</div>
                          <div className="text-[10px] text-[#94A3B8]">{req.durationDays || 7} days</div>
                        </td>
                        <td className="px-6 py-4 text-[#475569] max-w-xs truncate" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="px-6 py-4 text-[#94A3B8]">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={\`rounded-md border px-2 py-0.5 text-[10px] font-bold \${
                              req.status === 'APPROVED'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : req.status === 'REJECTED'
                                ? 'border-rose-200 bg-rose-50 text-rose-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                            }\`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#64748B]">
                          {req.reviewNote || (req.status === 'PENDING' ? 'Pending Manager Review' : '—')}
                        </td>
                      </tr>
                    ))}

                    {accessRequests.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#94A3B8]">
                          No access requests submitted yet. Click "New Request" above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 6: SHARED DOCUMENTS                                      */}
          {/* ============================================================ */}
          {activeNav === 'Shared Documents' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-[#14213D]">Explicitly Shared With You</h3>
                  <p className="text-xs text-[#64748B]">
                    Active document permissions granted directly to your account
                  </p>
                </div>

                <button
                  onClick={() => setShowRequestRenewalModal(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#14213D] shadow-sm hover:bg-[#F8FAFC] transition"
                >
                  <Clock3 className="size-3.5 text-[#0D9488]" />
                  <span>Request Renewal</span>
                </button>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#F1F5F9] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase">
                    <tr>
                      <th className="px-6 py-3.5">Document Title</th>
                      <th className="px-6 py-3.5">Permission Level</th>
                      <th className="px-6 py-3.5">Granted By</th>
                      <th className="px-6 py-3.5">Expiration</th>
                      <th className="px-6 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {permissions.map((p) => (
                      <tr key={p.id} className="hover:bg-[#F8FAFC] transition">
                        <td className="px-6 py-4 font-bold text-[#14213D]">{p.documentTitle}</td>
                        <td className="px-6 py-4">
                          <span
                            className={\`rounded-md border px-2 py-0.5 text-[10px] font-bold \${
                              p.permissionLevel === 'EDIT'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-sky-200 bg-sky-50 text-sky-800'
                            }\`}
                          >
                            {p.permissionLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#475569]">{p.grantedByName}</td>
                        <td className="px-6 py-4 text-[#64748B]">
                          {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : 'Permanent'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={\`rounded-md border px-2 py-0.5 text-[10px] font-bold \${
                              p.status === 'ACTIVE'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : p.status === 'REVOKED'
                                ? 'border-rose-200 bg-rose-50 text-rose-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                            }\`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {permissions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-[#94A3B8]">
                          No documents currently shared with your account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 7: MY ACTIVITY                                           */}
          {/* ============================================================ */}
          {activeNav === 'My Activity' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-sm font-extrabold text-[#14213D]">Account Activity Log</h3>
                <p className="text-xs text-[#64748B]">
                  Tamper-evident record of document views, downloads, edits, shares, and requests
                </p>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#F1F5F9] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase">
                    <tr>
                      <th className="px-6 py-3.5">Timestamp</th>
                      <th className="px-6 py-3.5">Action</th>
                      <th className="px-6 py-3.5">Resource Scope</th>
                      <th className="px-6 py-3.5">Result</th>
                      <th className="px-6 py-3.5">Event Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8FAFC] transition">
                        <td className="px-6 py-3.5 text-[#94A3B8] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-[#14213D]">{log.action}</td>
                        <td className="px-6 py-3.5 text-[#475569]">{log.resourceType}</td>
                        <td className="px-6 py-3.5">
                          <span
                            className={\`rounded-md border px-2 py-0.5 text-[10px] font-bold \${
                              log.result === 'SUCCESS' || log.result === 'ALLOWED'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                            }\`}
                          >
                            {log.result}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[#64748B] max-w-sm truncate" title={log.reason}>
                          {log.reason || '—'}
                        </td>
                      </tr>
                    ))}

                    {activityLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-[#94A3B8]">
                          No recorded activity yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 8: PROFILE / ACCOUNT                                     */}
          {/* ============================================================ */}
          {activeNav === 'Profile' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                <div className="border-b border-[#F1F5F9] pb-4">
                  <h3 className="text-sm font-extrabold text-[#14213D]">Profile & Enterprise Credentials</h3>
                  <p className="text-xs text-[#64748B]">
                    Authorized account details under TrustVault enterprise security
                  </p>
                </div>

                <div className="mt-6 space-y-4 text-xs">
                  <div className="flex justify-between border-b border-[#F1F5F9] pb-3">
                    <span className="font-semibold text-[#64748B]">Full Name</span>
                    <span className="font-bold text-[#14213D]">{currentUser?.fullName}</span>
                  </div>

                  <div className="flex justify-between border-b border-[#F1F5F9] pb-3">
                    <span className="font-semibold text-[#64748B]">Company Email</span>
                    <span className="font-mono text-[#14213D]">{currentUser?.email}</span>
                  </div>

                  <div className="flex justify-between border-b border-[#F1F5F9] pb-3">
                    <span className="font-semibold text-[#64748B]">System Role</span>
                    <span className="font-bold text-[#0D9488]">
                      {isEditor ? 'Workshop Editor (ROLE_EDITOR)' : 'Workshop Viewer (ROLE_VIEWER)'}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-[#F1F5F9] pb-3">
                    <span className="font-semibold text-[#64748B]">Account Status</span>
                    <span className="font-bold text-emerald-700">Active & Verified</span>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <ShieldCheck className="size-4 text-teal-600" />
                    <span>Security Policy Notice</span>
                  </div>
                  <p className="mt-1">
                    Password self-service is restricted for workshop roles. Credential resets, role elevation, and project access grants are administered by authorized Managers and System Administrators.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: REQUEST ACCESS (WITH CUSTOM DURATION CONTROLS)      */}
      {/* ============================================================ */}
      {showRequestAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-sm font-extrabold text-[#14213D]">Request Document Access</h3>
              <button
                onClick={() => setShowRequestAccessModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            {reqValidationError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{reqValidationError}</span>
              </div>
            )}

            <form onSubmit={handleRequestAccessSubmit} className="mt-4 space-y-4 text-xs">
              {/* Project Selection */}
              <div>
                <label className="block font-bold text-[#14213D]">Project Context *</label>
                <select
                  required
                  value={reqProjectId}
                  onChange={(e) => setReqProjectId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                >
                  <option value="">Select project context...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Manager: {p.ownerName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Toggle: Select Known Document vs Type Filename */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <span className="font-semibold text-slate-700">Specify by manual filename?</span>
                <button
                  type="button"
                  onClick={() => setReqUseManualFilename(!reqUseManualFilename)}
                  className={\`rounded-lg px-2.5 py-1 text-[11px] font-bold transition \${
                    reqUseManualFilename
                      ? 'bg-[#14213D] text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }\`}
                >
                  {reqUseManualFilename ? 'Manual Filename' : 'Pick from Project'}
                </button>
              </div>

              {reqUseManualFilename ? (
                <div>
                  <label className="block font-bold text-[#14213D]">Document Filename *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Contract_Amendment_v2.pdf"
                    value={reqManualFilename}
                    onChange={(e) => setReqManualFilename(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#94A3B8]">
                    Manual entries must be verified against actual files in the project by the Manager.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-[#14213D]">Select Document</label>
                  <select
                    value={reqDocumentId}
                    onChange={(e) => setReqDocumentId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                  >
                    <option value="">Choose known document or leave blank...</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d.originalFilename})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Requested Permission */}
              <div>
                <label className="block font-bold text-[#14213D]">Requested Permission Level *</label>
                <select
                  value={reqPermissionLevel}
                  onChange={(e) => setReqPermissionLevel(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                >
                  <option value="READ">READ (Preview Only)</option>
                  <option value="EDIT">EDIT (Modify Document & Download)</option>
                </select>
              </div>

              {/* Custom Duration in Days: Minus / Plus / Numeric Input Control */}
              <div>
                <label className="block font-bold text-[#14213D]">
                  Requested Duration (1 - 90 Days) *
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReqDurationDays(Math.max(1, reqDurationDays - 1))}
                    className="grid size-9 place-items-center rounded-xl border border-[#CBD5E1] bg-white text-[#14213D] hover:bg-[#F8FAFC] transition"
                  >
                    <Minus className="size-4" />
                  </button>

                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      required
                      value={reqDurationDays}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1
                        setReqDurationDays(Math.min(90, Math.max(1, val)))
                      }}
                      className="w-full text-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 text-xs font-bold text-[#14213D] focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-[#94A3B8]">
                      days
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReqDurationDays(Math.min(90, reqDurationDays + 1))}
                    className="grid size-9 place-items-center rounded-xl border border-[#CBD5E1] bg-white text-[#14213D] hover:bg-[#F8FAFC] transition"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              {/* Business Justification */}
              <div>
                <label className="block font-bold text-[#14213D]">
                  Business Justification (Mandatory) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Please provide access to the ABC contract file so I can review it for the assigned project."
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowRequestAccessModal(false)}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-5 py-2 font-bold text-white shadow-sm hover:bg-[#243B64] transition disabled:opacity-60"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: REQUEST RENEWAL (WITH CUSTOM DURATION CONTROLS)     */}
      {/* ============================================================ */}
      {showRequestRenewalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-sm font-extrabold text-[#14213D]">Request Access Renewal</h3>
              <button
                onClick={() => setShowRequestRenewalModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRequestRenewalSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14213D]">Select Document Permission *</label>
                <select
                  required
                  value={renewalPermissionId}
                  onChange={(e) => setRenewalPermissionId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                >
                  <option value="">Select permission to extend...</option>
                  {permissions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.documentTitle} ({p.permissionLevel} • Current: {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : 'Permanent'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Duration in Days */}
              <div>
                <label className="block font-bold text-[#14213D]">
                  Extension Duration (1 - 90 Days) *
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRenewalDurationDays(Math.max(1, renewalDurationDays - 1))}
                    className="grid size-9 place-items-center rounded-xl border border-[#CBD5E1] bg-white text-[#14213D] hover:bg-[#F8FAFC] transition"
                  >
                    <Minus className="size-4" />
                  </button>

                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      required
                      value={renewalDurationDays}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1
                        setRenewalDurationDays(Math.min(90, Math.max(1, val)))
                      }}
                      className="w-full text-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 text-xs font-bold text-[#14213D] focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-[#94A3B8]">
                      days
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRenewalDurationDays(Math.min(90, renewalDurationDays + 1))}
                    className="grid size-9 place-items-center rounded-xl border border-[#CBD5E1] bg-white text-[#14213D] hover:bg-[#F8FAFC] transition"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#14213D]">Reason for Extension *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why an extension of access is needed for this project..."
                  value={renewalReason}
                  onChange={(e) => setRenewalReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowRequestRenewalModal(false)}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-5 py-2 font-bold text-white shadow-sm hover:bg-[#243B64] transition disabled:opacity-60"
                >
                  Submit Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: SHARE DOCUMENT (CLEARLY VISIBLE SHARE ACTION)        */}
      {/* ============================================================ */}
      {showShareModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="size-4 text-[#0D9488]" />
                <h3 className="text-sm font-extrabold text-[#14213D]">Share Document</h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleShareSubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div className="font-extrabold text-[#14213D]">{selectedDoc.title}</div>
                <div className="text-[11px] text-[#64748B]">{selectedDoc.originalFilename} • Project: {selectedDoc.projectName || 'General'}</div>
              </div>

              <div>
                <label className="block font-bold text-[#14213D]">Authorized Recipient Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. manager@trustvault.local or admin@trustvault.local"
                  value={shareRecipientEmail}
                  onChange={(e) => setShareRecipientEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Default recipients include the responsible Project Manager and System Administrators.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#14213D]">Permission Level to Grant *</label>
                <select
                  value={sharePermissionLevel}
                  onChange={(e) => setSharePermissionLevel(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                >
                  <option value="READ">READ (View and Preview)</option>
                  <option value="EDIT">EDIT (Modify Document & Download)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#14213D]">Access Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={shareDurationDays}
                  onChange={(e) => setShareDurationDays(parseInt(e.target.value) || 14)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="rounded-xl bg-[#14213D] px-5 py-2 font-bold text-white shadow-sm hover:bg-[#243B64] transition disabled:opacity-60"
                >
                  Confirm Share
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: DOCUMENT PREVIEW                                    */}
      {/* ============================================================ */}
      {showPreviewModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] p-5">
              <div>
                <h3 className="text-sm font-extrabold text-[#14213D]">{selectedDoc.title}</h3>
                <p className="text-[11px] text-[#64748B]">
                  {selectedDoc.originalFilename} • {selectedDoc.contentType} • Access Level: {selectedDoc.userAccessLevel}
                </p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 text-xs">
              {loadingAction ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="size-6 animate-spin text-teal-600" />
                  <span>Loading document preview...</span>
                </div>
              ) : previewData?.textContent ? (
                <pre className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {previewData.textContent}
                </pre>
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <FileText className="size-12 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">Preview Rendered</p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    {previewData?.message || 'Binary or structured file format. Content metadata verified through cryptographic SHA-256 ledger.'}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-[#F1F5F9] p-4 flex justify-between items-center text-xs">
              <span className="font-mono text-[10px] text-slate-400 truncate max-w-xs">
                SHA-256: {selectedDoc.sha256Checksum}
              </span>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="rounded-xl bg-[#14213D] px-4 py-2 font-bold text-white shadow-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: EDIT DOCUMENT METADATA (EDIT permission only)       */}
      {/* ============================================================ */}
      {showEditModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-sm font-extrabold text-[#14213D]">Edit Document</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14213D]">Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#14213D]">Category *</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#14213D] focus:outline-none"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Finance">Finance</option>
                  <option value="Legal">Legal</option>
                  <option value="Security">Security</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="rounded-xl bg-[#14213D] px-5 py-2 font-bold text-white shadow-sm hover:bg-[#243B64] transition disabled:opacity-60"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 6: VERSION HISTORY                                      */}
      {/* ============================================================ */}
      {showVersionsModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <History className="size-4 text-[#0D9488]" />
                <h3 className="text-sm font-extrabold text-[#14213D]">Version History</h3>
              </div>
              <button
                onClick={() => setShowVersionsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto text-xs">
              {versionList.map((ver) => (
                <div key={ver.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#14213D]">Version {ver.versionNumber}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-700">{ver.title} ({ver.formattedSize})</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Created by {ver.createdByName}
                  </div>
                </div>
              ))}

              {versionList.length === 0 && (
                <div className="py-8 text-center text-slate-400">
                  Initial version (v1) active. No prior revisions recorded.
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end pt-3 border-t border-[#F1F5F9]">
              <button
                onClick={() => setShowVersionsModal(false)}
                className="rounded-xl bg-[#14213D] px-4 py-2 font-bold text-white shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
`;

fs.writeFileSync('D:/AI_Agents/trust1/components/dashboard/WorkshopDashboard.tsx', workshopDashboardContent, 'utf8');
console.log('Successfully wrote D:/AI_Agents/trust1/components/dashboard/WorkshopDashboard.tsx');
