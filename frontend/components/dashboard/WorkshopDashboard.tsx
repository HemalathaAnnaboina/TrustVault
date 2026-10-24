'use client'

import React, { useEffect, useMemo, useState } from 'react'
import ThemeToggle from '../ui/ThemeToggle'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
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
  Settings,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import {
  api,
  DocumentItem,
  DocumentPreviewItem,
  DocumentVersionItem,
  PermissionItem,
  ProjectItem,
  ProjectMemberItem,
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

  // Project Details View State
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null)
  const [projectMembers, setProjectMembers] = useState<ProjectMemberItem[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [projectDocuments, setProjectDocuments] = useState<DocumentItem[]>([])
  const [loadingProjectDocs, setLoadingProjectDocs] = useState(false)

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL')
  const [selectedPermissionFilter, setSelectedPermissionFilter] = useState<string>('ALL')
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL')

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

  // Profile settings state (display name / non-sensitive info)
  const [profileFullName, setProfileFullName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    if (currentUser?.fullName) {
      setProfileFullName(currentUser.fullName)
    }
  }, [currentUser?.fullName])

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

    api.getMe().then((me) => {
      if (!me.active) {
        logout()
        return
      }
      setCurrentUser(me)
    }).catch(() => {
      // keep local user
    })
  }, [router])

  // Central data loader from backend
  const loadAllData = async () => {
    setLoading(true)
    try {
      const [projs, docs, perms, reqs, rens] = await Promise.all([
        api.getProjects().catch(() => []),
        api.getDocuments().catch(() => []),
        api.getMyPermissions().catch(() => []),
        api.getMyAccessRequests().catch(() => []),
        api.getMyRenewals().catch(() => []),
      ])

      const cleanDocs = docs.filter(
        (doc) =>
          doc.userAccessLevel !== 'SUSPENDED' &&
          doc.userAccessLevel !== 'NONE' &&
          doc.userAccessLevel !== 'REVOKED' &&
          doc.userAccessLevel !== 'EXPIRED'
      )

      setProjects(projs)
      setDocuments(cleanDocs)
      setPermissions(perms)
      setAccessRequests(reqs)
      setRenewals(rens)
    } catch (err: any) {
      showToast(err?.message || 'Failed to refresh workspace data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Fetch project members when viewing project details
  const openProjectDetails = async (proj: ProjectItem) => {
    setSelectedProject(proj)
    setLoadingMembers(true)
    try {
      const members = await api.getProjectMembers(proj.id)
      setProjectMembers(members)
    } catch {
      setProjectMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }

  const isEditor = currentUser?.role === 'ROLE_EDITOR'
  const isWorkshopMember =
    currentUser?.role === 'ROLE_WORKSHOP_MEMBER' || currentUser?.role === 'ROLE_VIEWER' || isEditor

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (
        doc.userAccessLevel === 'SUSPENDED' ||
        doc.userAccessLevel === 'NONE' ||
        doc.userAccessLevel === 'REVOKED' ||
        doc.userAccessLevel === 'EXPIRED'
      ) {
        return false
      }

      const matchesQuery =
        !searchQuery ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.originalFilename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.projectName && doc.projectName.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCat = selectedCategory === 'ALL' || doc.category === selectedCategory
      const matchesProj = selectedProjectFilter === 'ALL' || doc.projectId === selectedProjectFilter
      const matchesPerm =
        selectedPermissionFilter === 'ALL' ||
        (selectedPermissionFilter === 'EDIT' && (doc.userAccessLevel === 'EDIT' || doc.userAccessLevel === 'OWNER')) ||
        (selectedPermissionFilter === 'READ' && doc.userAccessLevel === 'READ')

      return matchesQuery && matchesCat && matchesProj && matchesPerm
    })
  }, [documents, searchQuery, selectedCategory, selectedProjectFilter, selectedPermissionFilter])

  // Overview metrics
  const overviewStats = useMemo(() => {
    const accessibleDocs = documents.filter(
      (d) =>
        d.userAccessLevel !== 'SUSPENDED' &&
        d.userAccessLevel !== 'NONE' &&
        d.userAccessLevel !== 'REVOKED' &&
        d.userAccessLevel !== 'EXPIRED'
    )
    const pendingReqs = accessRequests.filter((r) => r.status === 'PENDING')
    const approvedReqs = accessRequests.filter((r) => r.status === 'APPROVED')

    const now = new Date()
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const expiringSoon = permissions.filter((p) => {
      if (!p.expiresAt) return false
      const exp = new Date(p.expiresAt)
      return exp > now && exp <= sevenDaysLater
    })

    return {
      assignedProjectCount: projects.length,
      accessibleDocsCount: accessibleDocs.length,
      pendingReqCount: pendingReqs.length,
      approvedReqCount: approvedReqs.length,
      expiringSoonCount: expiringSoon.length,
      expiringSoonPerms: expiringSoon,
      activePermissionsCount: permissions.length,
    }
  }, [projects, documents, accessRequests, permissions])

  // Document Operations Handlers
  const handleOpenPreview = async (doc: DocumentItem) => {
    setSelectedDoc(doc)
    setLoadingAction(true)
    try {
      const data = await api.getDocumentPreview(doc.id)
      setPreviewData(data)
      setShowPreviewModal(true)
    } catch (err: any) {
      if (err?.message?.includes('403') || err?.message?.includes('denied') || err?.message?.includes('suspension')) {
        setSelectedDoc(null)
        setPreviewData(null)
        loadAllData()
      }
      showToast(err?.message || 'Failed to load preview. Access may have expired or been revoked.', 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleDownload = async (doc: DocumentItem) => {
    try {
      showToast(`Initiating secure download for "${doc.originalFilename}"...`, 'info')
      await api.getDocumentDownload(doc.id, doc.originalFilename)
      showToast('Download started successfully', 'success')
    } catch (err: any) {
      if (err?.message?.includes('403') || err?.message?.includes('denied') || err?.message?.includes('suspension')) {
        loadAllData()
      }
      showToast(err?.message || 'Download forbidden. Access may have been revoked.', 'error')
    }
  }

  const handleOpenEdit = (doc: DocumentItem) => {
    if (doc.userAccessLevel !== 'EDIT' && doc.userAccessLevel !== 'OWNER') {
      showToast('You only have READ permission for this document. Editing is disabled.', 'error')
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
      showToast(err?.message || 'Failed to update document metadata', 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleOpenVersions = async (doc: DocumentItem) => {
    setSelectedDoc(doc)
    setLoadingAction(true)
    try {
      const versions = await api.getDocumentVersions(doc.id)
      setVersionList(versions)
      setShowVersionsModal(true)
    } catch (err: any) {
      showToast(err?.message || 'Failed to retrieve version history', 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleOpenShare = (doc: DocumentItem) => {
    if (doc.userAccessLevel !== 'EDIT' && doc.userAccessLevel !== 'OWNER') {
      showToast('Only members with EDIT access can share documents', 'error')
      return
    }
    setSelectedDoc(doc)
    setShareRecipientEmail('')
    setSharePermissionLevel('READ')
    setShareDurationDays(14)
    setShowShareModal(true)
  }

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDoc || !shareRecipientEmail) return

    setLoadingAction(true)
    try {
      const expDate = new Date()
      expDate.setDate(expDate.getDate() + shareDurationDays)

      await api.grantPermission(selectedDoc.id, {
        userEmail: shareRecipientEmail.trim().toLowerCase(),
        permissionLevel: sharePermissionLevel,
        expiresAt: expDate.toISOString(),
      })

      showToast(`Document permission granted to ${shareRecipientEmail}`, 'success')
      setShowShareModal(false)
      loadAllData()
    } catch (err: any) {
      showToast(err?.message || 'Failed to share document', 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploadError(null)

    if (!uploadFile) {
      setUploadError('Please select a valid document file to upload')
      return
    }
    if (!uploadTitle.trim()) {
      setUploadError('Document title is required')
      return
    }
    if (!uploadProjectId) {
      setUploadError('Please choose the target project workspace')
      return
    }

    setLoadingAction(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      if (uploadTitle.trim()) {
        formData.append('title', uploadTitle.trim())
      }
      if (uploadCategory && uploadCategory.trim()) {
        formData.append('category', uploadCategory.trim())
      }
      if (uploadProjectId && uploadProjectId.trim()) {
        formData.append('projectId', uploadProjectId.trim())
      }

      await api.uploadDocument(formData)

      showToast('Document uploaded successfully to project vault', 'success')
      setUploadFile(null)
      setUploadTitle('')
      setUploadProjectId('')
      setActiveNav('My Documents')
      loadAllData()
    } catch (err: any) {
      setUploadError(err?.message || 'Upload rejected by server')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleRequestAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqValidationError(null)

    let finalDocId = reqDocumentId
    if (reqUseManualFilename) {
      const trimmed = reqManualFilename.trim().toLowerCase()
      if (!trimmed) {
        setReqValidationError('Please enter a target document filename or title')
        return
      }
      const matched = documents.find(
        (d) =>
          d.originalFilename.toLowerCase() === trimmed ||
          d.title.toLowerCase() === trimmed
      )
      if (matched) {
        finalDocId = matched.id
      }
    }

    if (!finalDocId) {
      setReqValidationError('Please select or specify an existing document in your project')
      return
    }
    if (!reqReason.trim()) {
      setReqValidationError('Please state a business reason for this access request')
      return
    }

    setLoadingAction(true)
    try {
      await api.createAccessRequest({
        documentId: finalDocId,
        requestedPermission: reqPermissionLevel,
        durationDays: reqDurationDays,
        reason: reqReason.trim(),
      })

      showToast('Access request submitted for Manager review', 'success')
      setShowRequestAccessModal(false)
      setReqDocumentId('')
      setReqManualFilename('')
      setReqReason('')
      loadAllData()
    } catch (err: any) {
      setReqValidationError(err?.message || 'Failed to submit access request')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleRequestRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renewalPermissionId) {
      showToast('Please select a permission to renew', 'error')
      return
    }
    if (!renewalReason.trim()) {
      showToast('Please specify a reason for this renewal request', 'error')
      return
    }

    const selectedPerm = permissions.find((p) => p.id === renewalPermissionId)
    if (!selectedPerm) {
      showToast('Invalid permission selected', 'error')
      return
    }

    setLoadingAction(true)
    try {
      await api.createRenewal({
        permissionId: selectedPerm.id,
        documentId: selectedPerm.documentId,
        requestedExtensionDays: renewalDurationDays,
        durationDays: renewalDurationDays,
        reason: renewalReason.trim(),
      })

      showToast('Renewal request submitted for Manager review', 'success')
      setShowRequestRenewalModal(false)
      setRenewalPermissionId('')
      setRenewalReason('')
      loadAllData()
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit renewal request', 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMsg(null)

    const trimmed = profileFullName.trim()
    if (!trimmed) {
      setProfileMsg({ text: 'Full name cannot be empty', error: true })
      return
    }

    setSavingProfile(true)
    try {
      const updated = await api.updateProfile(trimmed)
      setCurrentUser((prev) => (prev ? { ...prev, fullName: updated.fullName } : prev))
      setProfileMsg({ text: 'Profile display name updated successfully', error: false })
      showToast('Profile updated successfully', 'success')
    } catch (err: any) {
      setProfileMsg({ text: err?.message || 'Failed to update profile', error: true })
      showToast(err?.message || 'Failed to update profile', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return 'WM'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <div className="flex h-screen bg-[#FFFFFF] text-[#27272A] font-sans overflow-hidden">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-bold shadow-lg transition animate-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : toast.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="size-4 text-emerald-600" />}
          {toast.type === 'error' && <AlertCircle className="size-4 text-rose-600" />}
          {toast.type === 'info' && <Info className="size-4 text-amber-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. SIDEBAR — Clean White with Yellow Accents                  */}
      {/* ============================================================ */}
      <aside className="w-64 shrink-0 border-r border-[#E4E4E7] bg-white flex flex-col justify-between">
        <div>
          {/* Logo & Workspace Brand */}
          <div className="p-6 border-b border-[#E4E4E7]">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-[#FACC15] text-[#27272A] shadow-xs ring-2 ring-yellow-400/40 font-black">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-[#27272A]">TrustVault</h1>
                <p className="text-[10px] font-bold tracking-wider uppercase text-[#B45309]">
                  Workshop Workspace
                </p>
              </div>
            </div>

            {/* Current Member Role Card */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-[#FACC15] ring-2 ring-yellow-400/50" />
                <span className="text-xs font-bold text-[#27272A]">
                  {isEditor ? 'Workshop Editor' : 'Workshop Member'}
                </span>
              </div>
              <span className="rounded-md bg-white border border-[#FDE68A] px-1.5 py-0.5 text-[10px] font-bold text-[#92400E]">
                {currentUser?.email?.split('@')[0]}
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => {
                setSelectedProject(null)
                setActiveNav('Overview')
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeNav === 'Overview' && !selectedProject
                  ? 'bg-[#FACC15] text-[#27272A] shadow-xs ring-1 ring-yellow-400/50'
                  : 'text-[#71717A] hover:bg-[#FFFBEB] hover:text-[#27272A]'
              }`}
            >
              <Home className="size-4 shrink-0" />
              <span>Workshop Dashboard</span>
            </button>

            <button
              onClick={() => {
                setSelectedProject(null)
                setActiveNav('My Projects')
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeNav === 'My Projects'
                  ? 'bg-[#FACC15] text-[#27272A] shadow-xs ring-1 ring-yellow-400/50'
                  : 'text-[#71717A] hover:bg-[#FFFBEB] hover:text-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderKanban className="size-4 shrink-0" />
                <span>My Projects</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeNav === 'My Projects' ? 'bg-[#27272A] text-white' : 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'}`}>
                {projects.length}
              </span>
            </button>

            <button
              onClick={() => {
                setSelectedProject(null)
                setActiveNav('My Documents')
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeNav === 'My Documents'
                  ? 'bg-[#FACC15] text-[#27272A] shadow-xs ring-1 ring-yellow-400/50'
                  : 'text-[#71717A] hover:bg-[#FFFBEB] hover:text-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="size-4 shrink-0" />
                <span>My Documents</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeNav === 'My Documents' ? 'bg-[#27272A] text-white' : 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'}`}>
                {documents.length}
              </span>
            </button>

            {/* Upload Document - Editor only */}
            {isEditor && (
              <button
                onClick={() => {
                  setSelectedProject(null)
                  setActiveNav('Upload Document')
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeNav === 'Upload Document'
                    ? 'bg-[#FACC15] text-[#27272A] shadow-xs ring-1 ring-yellow-400/50'
                    : 'text-[#71717A] hover:bg-[#FFFBEB] hover:text-[#27272A]'
                }`}
              >
                <Upload className="size-4 shrink-0" />
                <span>Upload Document</span>
              </button>
            )}

            <button
              onClick={() => {
                setSelectedProject(null)
                setActiveNav('Access Requests')
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeNav === 'Access Requests'
                  ? 'bg-[#FACC15] text-[#27272A] shadow-xs ring-1 ring-yellow-400/50'
                  : 'text-[#71717A] hover:bg-[#FFFBEB] hover:text-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileCheck2 className="size-4 shrink-0" />
                <span>Access Requests</span>
              </div>
              {overviewStats.pendingReqCount > 0 && (
                <span className="rounded-full bg-[#FACC15] text-[#27272A] font-black px-2 py-0.5 text-[10px] border border-yellow-400">
                  {overviewStats.pendingReqCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedProject(null)
                setActiveNav('Profile')
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeNav === 'Profile'
                  ? 'bg-[#FACC15] text-[#27272A] shadow-xs ring-1 ring-yellow-400/50'
                  : 'text-[#71717A] hover:bg-[#FFFBEB] hover:text-[#27272A]'
              }`}
            >
              <User className="size-4 shrink-0" />
              <span>Profile / Settings</span>
            </button>
          </nav>
        </div>

        {/* User Identity & Logout Footer */}
        <div className="p-4 border-t border-[#E4E4E7] space-y-2 bg-white">
          <div className="flex items-center justify-between px-2 text-xs">
            <div className="min-w-0 pr-2">
              <p className="font-bold text-[#27272A] truncate">{currentUser?.fullName || 'Workshop Member'}</p>
              <p className="text-[10px] text-[#71717A] truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. MAIN VIEW AREA                                             */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-white">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E4E4E7] bg-white/95 px-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            {selectedProject ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FFFBEB] px-2.5 py-1 text-xs font-bold text-[#92400E] hover:bg-amber-100 transition cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Projects</span>
                </button>
                <span className="text-neutral-400">/</span>
                <h2 className="text-sm font-extrabold text-[#27272A]">{selectedProject.name}</h2>
              </div>
            ) : (
              <h2 className="text-base font-extrabold text-[#27272A]">{activeNav}</h2>
            )}

            {overviewStats.expiringSoonCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-bold text-[#92400E]">
                <AlertTriangle className="size-3 text-amber-600" />
                <span>{overviewStats.expiringSoonCount} expiring soon</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Action: Request Access */}
            <button
              onClick={() => {
                setReqValidationError(null)
                setShowRequestAccessModal(true)
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-2 text-xs font-bold text-[#27272A] shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Request Access</span>
            </button>

            {/* Quick Action: Request Renewal */}
            <button
              onClick={() => setShowRequestRenewalModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#FFFBEB] px-3.5 py-2 text-xs font-bold text-[#27272A] shadow-xs transition cursor-pointer"
            >
              <Clock3 className="size-3.5 text-[#B45309]" />
              <span>Request Renewal</span>
            </button>

            {/* Notifications Icon */}
            <button
              onClick={() => {
                setSelectedProject(null)
                setActiveNav('Access Requests')
              }}
              title="Access Requests & Notifications"
              className="relative grid size-9 place-items-center rounded-xl border border-[#E4E4E7] bg-white text-[#71717A] hover:bg-[#FFFBEB] hover:text-[#27272A] transition cursor-pointer shadow-xs"
            >
              <Bell className="size-4" />
              {overviewStats.pendingReqCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#FACC15] text-[9px] font-black text-[#27272A] ring-2 ring-white">
                  {overviewStats.pendingReqCount}
                </span>
              )}
            </button>

            {/* Refresh Data */}
            <button
              onClick={loadAllData}
              title="Refresh Data"
              className="grid size-9 place-items-center rounded-xl border border-[#E4E4E7] bg-white text-[#71717A] hover:bg-[#FFFBEB] hover:text-[#27272A] transition cursor-pointer shadow-xs"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            {/* Profile Avatar / Menu */}
            <button
              onClick={() => {
                setSelectedProject(null)
                setActiveNav('Profile')
              }}
              className="flex items-center gap-2 rounded-xl border border-[#E4E4E7] bg-[#FFFBEB] px-2.5 py-1 text-xs font-bold text-[#27272A] hover:border-[#FACC15] transition cursor-pointer"
            >
              <div className="grid size-6 place-items-center rounded-full bg-[#FACC15] text-[#27272A] text-[10px] font-black">
                {getInitials(currentUser?.fullName)}
              </div>
              <span className="hidden md:inline">{currentUser?.fullName?.split(' ')[0]}</span>
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* Body View Content */}
        <main className="p-8 space-y-6">
          {/* ============================================================ */}
          {/* VIEW: PROJECT DETAILS (When project is selected)             */}
          {/* ============================================================ */}
          {selectedProject && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Project Info Header Card */}
              <div className="rounded-2xl border border-[#E4E4E7] bg-white p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E4E4E7] pb-5 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="rounded-md bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-0.5 text-[10px] font-bold text-[#92400E]">
                        Project Workspace
                      </span>
                      {selectedProject.category && (
                        <span className="rounded-md bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-[#71717A]">
                          {selectedProject.category}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-black text-[#27272A]">{selectedProject.name}</h3>
                    <p className="mt-1 text-xs text-[#71717A] max-w-2xl leading-relaxed">
                      {selectedProject.description || 'No project description provided.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setReqProjectId(selectedProject.id)
                        setShowRequestAccessModal(true)
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-2 text-xs font-bold text-[#27272A] transition shadow-xs cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Request File Access</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-[#71717A] block">Project Manager</span>
                    <span className="font-bold text-[#27272A] mt-0.5 block">{selectedProject.ownerName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#71717A] block">Assigned Members</span>
                    <span className="font-bold text-[#27272A] mt-0.5 block">{projectMembers.length} member(s)</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#71717A] block">Your Accessible Files</span>
                    <span className="font-bold text-[#27272A] mt-0.5 block">
                      {projectDocuments.filter((d) => d.userAccessLevel === 'READ' || d.userAccessLevel === 'EDIT' || d.userAccessLevel === 'OWNER').length} of {projectDocuments.length} file(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#71717A] block">Created Date</span>
                    <span className="font-bold text-[#27272A] mt-0.5 block">
                      {new Date(selectedProject.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Project Members Section */}
              <div className="rounded-2xl border border-[#E4E4E7] bg-white overflow-hidden shadow-xs">
                <div className="bg-[#FFFBEB] border-b border-[#FDE68A] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-[#B45309]" />
                    <h4 className="text-xs font-bold text-[#27272A] uppercase tracking-wider">
                      Project Members &amp; Roles
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-[#92400E]">
                    {projectMembers.length} Assigned
                  </span>
                </div>

                {loadingMembers ? (
                  <div className="p-8 text-center text-xs text-[#71717A]">
                    <RefreshCw className="size-4 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading verified project team members...</span>
                  </div>
                ) : projectMembers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#71717A]">
                    No members listed for this workspace.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E4E4E7] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-[10px] font-bold text-[#71717A] uppercase">
                        <tr>
                          <th className="px-5 py-2.5">Member</th>
                          <th className="px-5 py-2.5">Role / Responsibility</th>
                          <th className="px-5 py-2.5">Membership Status</th>
                          <th className="px-5 py-2.5">Assigned Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E7]">
                        {projectMembers.map((m) => (
                          <tr key={m.id} className="hover:bg-[#FFFBEB]/30 transition">
                            <td className="px-5 py-3">
                              <p className="font-bold text-[#27272A]">{m.fullName}</p>
                              <p className="text-[10px] text-[#71717A]">{m.userEmail}</p>
                            </td>
                            <td className="px-5 py-3">
                              <span className="rounded-md bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 text-[10px] font-bold text-[#92400E]">
                                {m.roleLabel || m.responsibility || 'Member'}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  m.status === 'SUSPENDED'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {m.status === 'SUSPENDED' ? 'Suspended' : 'Active'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-[11px] text-[#71717A]">
                              {m.addedAt ? new Date(m.addedAt).toLocaleDateString() : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Documents in This Project Section */}
              <div className="rounded-2xl border border-[#E4E4E7] bg-white overflow-hidden shadow-xs">
                <div className="bg-[#FFFBEB] border-b border-[#FDE68A] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-[#B45309]" />
                    <h4 className="text-xs font-bold text-[#27272A] uppercase tracking-wider">
                      Documents in This Project
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-[#92400E]">
                    {projectDocuments.length} Total ({projectDocuments.filter((d) => d.userAccessLevel === 'READ' || d.userAccessLevel === 'EDIT' || d.userAccessLevel === 'OWNER').length} Accessible)
                  </span>
                </div>

                {loadingProjectDocs ? (
                  <div className="p-12 text-center text-xs text-[#71717A]">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading documents in this project...</span>
                  </div>
                ) : projectDocuments.length === 0 ? (
                  <div className="p-12 text-center text-xs text-[#71717A] space-y-2">
                    <Lock className="size-8 text-[#71717A] mx-auto opacity-50" />
                    <p className="font-bold text-[#27272A]">No Documents in This Project</p>
                    <p className="max-w-md mx-auto text-[#71717A]">
                      There are no documents uploaded to &quot;{selectedProject.name}&quot; yet.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E4E4E7] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-[10px] font-bold text-[#71717A] uppercase">
                        <tr>
                          <th className="px-5 py-2.5">Document</th>
                          <th className="px-5 py-2.5">Category</th>
                          <th className="px-5 py-2.5">Owner</th>
                          <th className="px-5 py-2.5">Actual Permissions (READ / EDIT)</th>
                          <th className="px-5 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E7]">
                        {projectDocuments.map((doc) => {
                          const isDocOwner = doc.userAccessLevel === 'OWNER'
                          const canEdit = doc.userAccessLevel === 'EDIT' || isDocOwner || !!doc.canEdit
                          const canRead = doc.userAccessLevel === 'READ' || canEdit || !!doc.canRead
                          const hasNoAccess = !canRead || doc.userAccessLevel === 'NONE' || doc.userAccessLevel === 'REVOKED' || doc.userAccessLevel === 'EXPIRED' || doc.userAccessLevel === 'SUSPENDED'

                          return (
                            <tr key={doc.id} className="hover:bg-[#FFFBEB]/30 transition">
                              <td className="px-5 py-3">
                                <p className="font-bold text-[#27272A]">{doc.title}</p>
                                <p className="text-[10px] text-[#71717A]">
                                  {doc.originalFilename} • {doc.formattedSize}
                                </p>
                              </td>
                              <td className="px-5 py-3">
                                <span className="rounded-md bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-[#71717A]">
                                  {doc.category}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-[#27272A]">
                                <span className="font-semibold">{doc.ownerName}</span>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {hasNoAccess ? (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold text-[#71717A]">
                                      <Lock className="size-2.5 text-[#71717A]" />
                                      <span>No Access</span>
                                    </span>
                                  ) : (
                                    <>
                                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                        <Check className="size-3 text-emerald-600" />
                                        <span>READ</span>
                                      </span>

                                      {canEdit ? (
                                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                          <Check className="size-3 text-amber-600" />
                                          <span>EDIT</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-[#71717A]">
                                          <Lock className="size-2.5 text-[#71717A]" />
                                          <span>No Edit</span>
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right">
                                {hasNoAccess ? (
                                  <div className="flex items-center justify-end">
                                    <button
                                      onClick={() => {
                                        setReqProjectId(selectedProject.id)
                                        setReqDocumentId(doc.id)
                                        setShowRequestAccessModal(true)
                                      }}
                                      title="Request Access to this document"
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] px-2.5 py-1 text-[11px] font-bold text-[#27272A] shadow-xs cursor-pointer transition"
                                    >
                                      <Plus className="size-3" />
                                      <span>Request Access</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenPreview(doc)}
                                      title="Preview Document"
                                      className="p-1.5 rounded-lg border border-[#E4E4E7] hover:bg-[#FFFBEB] hover:text-[#92400E] text-[#27272A] transition cursor-pointer"
                                    >
                                      <Eye className="size-3.5" />
                                    </button>
                                    {canEdit && (
                                      <button
                                        onClick={() => handleDownload(doc)}
                                        title="Download Document"
                                        className="p-1.5 rounded-lg border border-[#E4E4E7] hover:bg-[#FFFBEB] hover:text-[#92400E] text-[#27272A] transition cursor-pointer"
                                      >
                                        <Download className="size-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 1: WORKSHOP DASHBOARD (OVERVIEW)                         */}
          {/* ============================================================ */}
          {!selectedProject && activeNav === 'Overview' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* 4 Summary Metric Cards (Assigned Projects, Accessible Docs, Pending Requests, Recent Activity) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-xs transition hover:border-[#FACC15]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#71717A]">
                    <span>Assigned Projects</span>
                    <div className="grid size-8 place-items-center rounded-xl bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                      <FolderKanban className="size-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#27272A]">
                    {overviewStats.assignedProjectCount}
                  </div>
                  <p className="mt-1 text-[11px] text-[#71717A]">Active project memberships</p>
                </div>

                <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-xs transition hover:border-[#FACC15]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#71717A]">
                    <span>Accessible Documents</span>
                    <div className="grid size-8 place-items-center rounded-xl bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                      <FileText className="size-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#27272A]">
                    {overviewStats.accessibleDocsCount}
                  </div>
                  <p className="mt-1 text-[11px] text-[#71717A]">Authorized document grants</p>
                </div>

                <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-xs transition hover:border-[#FACC15]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#71717A]">
                    <span>Pending Requests</span>
                    <div className="grid size-8 place-items-center rounded-xl bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                      <Clock className="size-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#27272A]">
                    {overviewStats.pendingReqCount}
                  </div>
                  <p className="mt-1 text-[11px] text-[#71717A]">Awaiting Manager review</p>
                </div>

                <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-xs transition hover:border-[#FACC15]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#71717A]">
                    <span>Recent Activity</span>
                    <div className="grid size-8 place-items-center rounded-xl bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                      <FileCheck2 className="size-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#27272A]">
                    {overviewStats.activePermissionsCount}
                  </div>
                  <p className="mt-1 text-[11px] text-[#71717A]">Active permission assignments</p>
                </div>
              </div>

              {/* Expiring Soon Alert Banner */}
              {overviewStats.expiringSoonCount > 0 && (
                <div className="rounded-2xl border border-amber-300 bg-[#FFFBEB] p-5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-xs font-bold text-[#92400E]">
                        {overviewStats.expiringSoonCount} document permission(s) expiring within 7 days
                      </h3>
                      <p className="mt-0.5 text-xs text-[#78350F] leading-relaxed">
                        Submit a renewal request before expiration to prevent interruption of access.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {overviewStats.expiringSoonPerms.map((p) => (
                          <div
                            key={p.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#FDE68A] bg-white px-3 py-1.5 text-xs text-[#92400E] shadow-xs"
                          >
                            <span className="font-bold">{p.documentTitle}</span>
                            <span className="text-[10px] text-[#B45309]">
                              Expires {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Accessible Documents Table in Overview */}
              <div className="rounded-2xl border border-[#E4E4E7] bg-white overflow-hidden shadow-xs">
                <div className="bg-[#FFFBEB] border-b border-[#FDE68A] p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#27272A]">
                      Recent Accessible Documents
                    </h3>
                    <p className="text-[11px] text-[#78350F] mt-0.5">
                      Documents currently available under your active security credentials
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveNav('My Documents')}
                    className="text-xs font-bold text-[#B45309] hover:text-[#92400E] flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>

                {documents.length === 0 ? (
                  <div className="p-12 text-center text-xs text-[#71717A]">
                    No documents currently assigned to your account.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E4E4E7] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-[10px] font-bold text-[#71717A] uppercase">
                        <tr>
                          <th className="px-5 py-2.5">Document Title</th>
                          <th className="px-5 py-2.5">Project</th>
                          <th className="px-5 py-2.5">Owner</th>
                          <th className="px-5 py-2.5">Actual Permissions</th>
                          <th className="px-5 py-2.5 text-right">Quick Preview</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E7]">
                        {documents.slice(0, 5).map((doc) => (
                          <tr key={doc.id} className="hover:bg-[#FFFBEB]/30 transition">
                            <td className="px-5 py-3">
                              <p className="font-bold text-[#27272A]">{doc.title}</p>
                              <p className="text-[10px] text-[#71717A]">{doc.originalFilename}</p>
                            </td>
                            <td className="px-5 py-3 text-[#27272A]">
                              <span className="font-semibold">{doc.projectName || 'Unassigned'}</span>
                            </td>
                            <td className="px-5 py-3 text-[#71717A]">{doc.ownerName}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <Check className="size-3 text-emerald-600" />
                                  <span>READ</span>
                                </span>
                                {doc.userAccessLevel === 'EDIT' || doc.userAccessLevel === 'OWNER' ? (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                    <Check className="size-3 text-amber-600" />
                                    <span>EDIT</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-[#71717A]">
                                    <Lock className="size-2.5 text-[#71717A]" />
                                    <span>No Edit</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <button
                                onClick={() => handleOpenPreview(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E4E4E7] hover:bg-[#FFFBEB] hover:text-[#92400E] font-bold text-[11px] text-[#27272A] transition cursor-pointer"
                              >
                                <Eye className="size-3 text-[#B45309]" />
                                <span>Preview</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: MY PROJECTS SECTION                                   */}
          {/* ============================================================ */}
          {!selectedProject && activeNav === 'My Projects' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-[#27272A]">Assigned Projects</h3>
                  <p className="text-xs text-[#71717A]">
                    Workspaces in which your account is an authorized participant. Click any project to inspect its details and accessible files.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => openProjectDetails(proj)}
                    className="flex flex-col justify-between rounded-2xl border border-[#E4E4E7] bg-white p-6 shadow-xs transition hover:border-[#FACC15] hover:shadow-md cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 text-[10px] font-bold text-[#92400E]">
                          Workspace
                        </span>
                        <span className="text-[11px] text-[#71717A]">
                          {new Date(proj.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="mt-3 text-base font-bold text-[#27272A] group-hover:text-[#92400E] transition">
                        {proj.name}
                      </h4>
                      <p className="mt-1 text-xs text-[#71717A] line-clamp-2 leading-relaxed">
                        {proj.description || 'No project description provided.'}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-[#E4E4E7] pt-4 flex items-center justify-between text-xs">
                      <div className="text-[#71717A]">
                        <span>Manager: </span>
                        <span className="font-bold text-[#27272A]">{proj.ownerName}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-xl bg-[#FACC15] group-hover:bg-[#EAB308] px-3 py-1 text-xs font-bold text-[#27272A] shadow-xs transition flex items-center gap-1"
                        >
                          <span>Details</span>
                          <ChevronRight className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {projects.length === 0 && (
                  <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-[#E4E4E7] bg-white space-y-2">
                    <FolderKanban className="size-10 text-[#71717A] mx-auto opacity-50" />
                    <h4 className="text-sm font-bold text-[#27272A]">No Projects Assigned</h4>
                    <p className="text-xs text-[#71717A]">
                      You have not been added to any active project workspaces yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: MY DOCUMENTS SECTION                                  */}
          {/* ============================================================ */}
          {!selectedProject && activeNav === 'My Documents' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E4E4E7] bg-white p-4 shadow-xs">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3.5 top-2.5 size-4 text-[#71717A]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents by title or filename..."
                    className="w-full rounded-xl border border-[#E4E4E7] bg-white py-2 pl-10 pr-4 text-xs text-[#27272A] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-[#FACC15] transition"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Category Filter */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-9 rounded-xl border border-[#E4E4E7] bg-white px-3 text-xs font-semibold text-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Legal">Legal</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                  </select>

                  {/* Project Filter */}
                  <select
                    value={selectedProjectFilter}
                    onChange={(e) => setSelectedProjectFilter(e.target.value)}
                    className="h-9 rounded-xl border border-[#E4E4E7] bg-white px-3 text-xs font-semibold text-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  >
                    <option value="ALL">All Projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  {/* Permission Filter */}
                  <select
                    value={selectedPermissionFilter}
                    onChange={(e) => setSelectedPermissionFilter(e.target.value)}
                    className="h-9 rounded-xl border border-[#E4E4E7] bg-white px-3 text-xs font-semibold text-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  >
                    <option value="ALL">All Permissions</option>
                    <option value="READ">READ (View Only)</option>
                    <option value="EDIT">EDIT (Read + Edit)</option>
                  </select>
                </div>
              </div>

              {/* Documents Table */}
              <div className="rounded-2xl border border-[#E4E4E7] bg-white overflow-hidden shadow-xs">
                {/* Yellow-Highlighted Table Header */}
                <div className="bg-[#FFFBEB] border-b border-[#FDE68A] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-[#B45309]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#27272A]">
                      Accessible Documents Registry
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#92400E]">
                    {filteredDocuments.length} Available
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                      <tr>
                        <th className="px-5 py-3">Document Name &amp; Format</th>
                        <th className="px-5 py-3">Project Workspace</th>
                        <th className="px-5 py-3">Owner / Manager</th>
                        <th className="px-5 py-3">Modified Date</th>
                        <th className="px-5 py-3">Actual Permissions</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E4E7]">
                      {filteredDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-[#FFFBEB]/30 transition">
                          <td className="px-5 py-3.5">
                            <p className="font-bold text-[#27272A]">{doc.title}</p>
                            <p className="text-[10px] text-[#71717A] mt-0.5">
                              {doc.originalFilename} • {doc.formattedSize} • {doc.category}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-[#27272A]">{doc.projectName || 'Unassigned'}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-[#27272A]">{doc.ownerName}</p>
                            <p className="text-[10px] text-[#71717A]">{doc.ownerEmail}</p>
                          </td>
                          <td className="px-5 py-3.5 text-[#71717A]">
                            {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-5 py-3.5">
                            {/* Explicit independent READ & EDIT badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                <Check className="size-3 text-emerald-600" />
                                <span>READ</span>
                              </span>

                              {doc.userAccessLevel === 'EDIT' || doc.userAccessLevel === 'OWNER' ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                  <Check className="size-3 text-amber-600" />
                                  <span>EDIT</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-[#71717A]">
                                  <Lock className="size-2.5 text-[#71717A]" />
                                  <span>No Edit</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPreview(doc)}
                                title="Preview Document Content"
                                className="p-1.5 rounded-lg border border-[#E4E4E7] hover:bg-[#FFFBEB] hover:text-[#92400E] text-[#27272A] transition cursor-pointer"
                              >
                                <Eye className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleDownload(doc)}
                                title="Download Document"
                                className="p-1.5 rounded-lg border border-[#E4E4E7] hover:bg-[#FFFBEB] hover:text-[#92400E] text-[#27272A] transition cursor-pointer"
                              >
                                <Download className="size-3.5" />
                              </button>
                              {(doc.userAccessLevel === 'EDIT' || doc.userAccessLevel === 'OWNER') && (
                                <button
                                  onClick={() => handleOpenEdit(doc)}
                                  title="Edit Document Metadata"
                                  className="p-1.5 rounded-lg border border-[#E4E4E7] hover:bg-[#FFFBEB] hover:text-[#92400E] text-[#27272A] transition cursor-pointer"
                                >
                                  <Edit2 className="size-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenVersions(doc)}
                                title="Version History"
                                className="p-1.5 rounded-lg border border-[#E4E4E7] hover:bg-[#FFFBEB] hover:text-[#92400E] text-[#27272A] transition cursor-pointer"
                              >
                                <History className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredDocuments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-xs text-[#71717A]">
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
          {/* TAB 4: ACCESS REQUESTS SECTION                               */}
          {/* ============================================================ */}
          {!selectedProject && activeNav === 'Access Requests' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#27272A]">My Access Requests &amp; Renewals</h3>
                  <p className="text-xs text-[#71717A]">
                    Track status of pending, approved, and rejected authorization requests submitted to project managers.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => {
                      setReqValidationError(null)
                      setShowRequestAccessModal(true)
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-2 text-xs font-bold text-[#27272A] shadow-xs transition cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>New Access Request</span>
                  </button>
                  <button
                    onClick={() => setShowRequestRenewalModal(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#FFFBEB] px-3.5 py-2 text-xs font-bold text-[#27272A] shadow-xs transition cursor-pointer"
                  >
                    <Clock3 className="size-3.5 text-[#B45309]" />
                    <span>New Renewal Request</span>
                  </button>
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setRequestStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      requestStatusFilter === status
                        ? 'bg-[#FACC15] text-[#27272A] shadow-xs'
                        : 'border border-[#E4E4E7] bg-white text-[#71717A] hover:bg-[#FFFBEB]'
                    }`}
                  >
                    {status === 'ALL' ? 'All Requests' : status}
                  </button>
                ))}
              </div>

              {/* Access Requests Table */}
              <div className="rounded-2xl border border-[#E4E4E7] bg-white overflow-hidden shadow-xs">
                <div className="bg-[#FFFBEB] border-b border-[#FDE68A] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="size-4 text-[#B45309]" />
                    <h4 className="text-xs font-bold text-[#27272A] uppercase tracking-wider">
                      Access Requests Ledger
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-[#92400E]">
                    {accessRequests.length} Total
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 text-[10px] font-bold uppercase text-[#71717A]">
                      <tr>
                        <th className="px-5 py-3">Document Title</th>
                        <th className="px-5 py-3">Requested Permission</th>
                        <th className="px-5 py-3">Business Reason</th>
                        <th className="px-5 py-3">Submission Date</th>
                        <th className="px-5 py-3">Request Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E4E7]">
                      {accessRequests
                        .filter((r) => requestStatusFilter === 'ALL' || r.status === requestStatusFilter)
                        .map((req) => (
                          <tr key={req.id} className="hover:bg-[#FFFBEB]/30 transition">
                            <td className="px-5 py-3.5 font-bold text-[#27272A]">
                              {req.documentTitle}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="rounded-md bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 text-[10px] font-bold text-[#92400E]">
                                {req.requestedPermission}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-[#71717A] max-w-xs truncate">
                              {req.reason}
                            </td>
                            <td className="px-5 py-3.5 text-[#71717A]">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[10px] font-bold border ${
                                  req.status === 'APPROVED'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : req.status === 'REJECTED'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'
                                }`}
                              >
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        ))}

                      {accessRequests.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-xs text-[#71717A]">
                            No access requests submitted yet.
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
          {/* TAB 5: PROFILE & SETTINGS SECTION                            */}
          {/* ============================================================ */}
          {!selectedProject && activeNav === 'Profile' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
              {/* Profile Card */}
              <div className="rounded-2xl border border-[#E4E4E7] bg-white p-6 shadow-xs flex items-center gap-5">
                <div className="size-20 rounded-full bg-[#FACC15] text-[#27272A] font-black text-xl flex items-center justify-center ring-4 ring-[#FEF08A] border-2 border-yellow-400 shrink-0">
                  {getInitials(currentUser?.fullName)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-[#27272A]">{currentUser?.fullName}</h3>
                  <p className="text-xs text-[#71717A]">{currentUser?.email}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="rounded-md bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-0.5 text-[10px] font-bold text-[#92400E]">
                      {currentUser?.role}
                    </span>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Active Account
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Information Settings Card */}
              <div className="rounded-2xl border border-[#E4E4E7] bg-white p-6 sm:p-8 shadow-xs">
                <div className="border-b border-[#E4E4E7] pb-4 mb-6">
                  <div className="flex items-center gap-2 text-[#92400E] mb-1">
                    <User className="size-4" />
                    <h4 className="text-sm font-bold text-[#27272A]">Profile Information</h4>
                  </div>
                  <p className="text-xs text-[#71717A]">
                    Manage your personal display name across TrustVault project workspaces and access request workflows.
                  </p>
                </div>

                {profileMsg && (
                  <div
                    className={`mb-5 p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                      profileMsg.error
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {profileMsg.error ? (
                      <AlertCircle className="size-4 text-rose-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    )}
                    <span>{profileMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#27272A] mb-1.5">
                      Full Name / Display Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      required
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E4E7] bg-white text-xs text-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-[#FACC15]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#27272A] mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={currentUser?.email || ''}
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E4E7] bg-zinc-50 text-xs text-[#71717A] cursor-not-allowed select-none"
                    />
                    <p className="mt-1 text-[11px] text-[#71717A]">
                      Email addresses are uniquely bound to your user account and managed by platform administrators.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#27272A] mb-1.5">
                      Assigned Role
                    </label>
                    <input
                      type="text"
                      value={currentUser?.role || ''}
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E4E7] bg-zinc-50 text-xs text-[#71717A] cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2 text-xs font-bold rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-[#27272A] transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Account Security Policy Card */}
              <div className="rounded-2xl border border-[#E4E4E7] bg-white p-6 sm:p-8 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="size-10 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center shrink-0 text-[#92400E]">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-[#27272A]">Account Security &amp; Credentials Policy</h4>
                    <p className="mt-1 text-xs text-[#71717A] leading-relaxed">
                      Workshop account credentials, role assignments, and password lifecycle are managed centrally by your TrustVault Platform Administrator. Self-service password changes are disabled for Workshop accounts to uphold organizational access governance and security compliance.
                    </p>
                    <div className="mt-3 rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-[11px] text-zinc-600 flex items-center gap-2">
                      <Lock className="size-3.5 text-zinc-500 shrink-0" />
                      <span>If you require a password reset or credential update, please contact your TrustVault Administrator.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 6: UPLOAD DOCUMENT (EDITOR ONLY)                         */}
          {/* ============================================================ */}
          {!selectedProject && activeNav === 'Upload Document' && isEditor && (
            <div className="max-w-2xl mx-auto rounded-2xl border border-[#E4E4E7] bg-white p-6 sm:p-8 shadow-xs animate-in fade-in duration-200">
              <div className="border-b border-[#E4E4E7] pb-4 mb-6">
                <div className="flex items-center gap-2 text-[#92400E] mb-1">
                  <Upload className="size-5" />
                  <h3 className="text-base font-bold text-[#27272A]">Upload New Document</h3>
                </div>
                <p className="text-xs text-[#71717A]">
                  Upload a document to an authorized project workspace. File will be validated and encrypted server-side.
                </p>
              </div>

              {uploadError && (
                <div className="mb-5 p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="size-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#27272A] mb-1.5">
                    Target Project Workspace <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={uploadProjectId}
                    onChange={(e) => setUploadProjectId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E4E7] bg-white text-xs text-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  >
                    <option value="">Select an assigned project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#27272A] mb-1.5">
                    Document Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    required
                    placeholder="e.g. Q3 Technical Architecture Report"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E4E7] bg-white text-xs text-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#27272A] mb-1.5">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E4E7] bg-white text-xs text-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Legal">Legal</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#27272A] mb-1.5">
                    Select File <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs text-[#27272A]"
                  />
                </div>

                <div className="pt-4 border-t border-[#E4E4E7] flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingAction}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-[#27272A] transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {loadingAction ? 'Uploading & Encrypting...' : 'Upload Document'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ============================================================ */}
      {/* 3. MODALS                                                     */}
      {/* ============================================================ */}

      {/* MODAL 1: REQUEST ACCESS */}
      {showRequestAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3">
              <h4 className="text-sm font-bold text-[#27272A]">Request Document Access</h4>
              <button onClick={() => setShowRequestAccessModal(false)} className="text-[#71717A] hover:text-[#27272A] cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            {reqValidationError && (
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="size-4 text-rose-600 shrink-0" />
                <span>{reqValidationError}</span>
              </div>
            )}

            <form onSubmit={handleRequestAccessSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#27272A] mb-1">Target Document</label>
                <select
                  value={reqDocumentId}
                  onChange={(e) => setReqDocumentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs text-[#27272A]"
                >
                  <option value="">Choose document from workspace...</option>
                  {Array.from(new Map([...documents, ...projectDocuments].map((d) => [d.id, d])).values()).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.originalFilename})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#27272A] mb-1">Requested Permission Level</label>
                <select
                  value={reqPermissionLevel}
                  onChange={(e) => setReqPermissionLevel(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs text-[#27272A]"
                >
                  <option value="READ">READ (View and Preview Only)</option>
                  <option value="EDIT">EDIT (Read and Edit)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#27272A] mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={reqDurationDays}
                  onChange={(e) => setReqDurationDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs text-[#27272A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#27272A] mb-1">Business Reason</label>
                <textarea
                  rows={3}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  required
                  placeholder="Explain why you need access to this document..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs text-[#27272A]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowRequestAccessModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E4E4E7] text-[#71717A] hover:bg-neutral-50 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-[#27272A] font-bold shadow-xs cursor-pointer"
                >
                  {loadingAction ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REQUEST RENEWAL */}
      {showRequestRenewalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3">
              <h4 className="text-sm font-bold text-[#27272A]">Request Permission Renewal</h4>
              <button onClick={() => setShowRequestRenewalModal(false)} className="text-[#71717A] hover:text-[#27272A] cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRequestRenewalSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#27272A] mb-1">Permission to Renew</label>
                <select
                  value={renewalPermissionId}
                  onChange={(e) => setRenewalPermissionId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs text-[#27272A]"
                >
                  <option value="">Select active permission...</option>
                  {permissions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.documentTitle} ({p.permissionLevel}) - Expires {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : 'Never'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#27272A] mb-1">Renewal Extension (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={renewalDurationDays}
                  onChange={(e) => setRenewalDurationDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs text-[#27272A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#27272A] mb-1">Justification Reason</label>
                <textarea
                  rows={3}
                  value={renewalReason}
                  onChange={(e) => setRenewalReason(e.target.value)}
                  required
                  placeholder="Explain why you require extended duration..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs text-[#27272A]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowRequestRenewalModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E4E4E7] text-[#71717A] hover:bg-neutral-50 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-[#27272A] font-bold shadow-xs cursor-pointer"
                >
                  {loadingAction ? 'Submitting...' : 'Submit Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PREVIEW */}
      {showPreviewModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3 shrink-0">
              <div>
                <h4 className="text-sm font-bold text-[#27272A]">{selectedDoc.title}</h4>
                <p className="text-[10px] text-[#71717A]">
                  {selectedDoc.originalFilename} • {selectedDoc.formattedSize}
                </p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-[#71717A] hover:text-[#27272A] cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-neutral-50 border border-[#E4E4E7] text-xs font-mono text-[#27272A] whitespace-pre-wrap leading-relaxed">
              {previewData?.textContent || 'No preview content available.'}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E4E4E7] shrink-0 text-xs">
              <span className="text-[11px] text-[#71717A]">
                SHA-256: {selectedDoc.sha256Checksum?.slice(0, 16)}...
              </span>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1.5 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#FFFBEB] font-bold text-[#27272A] cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT METADATA */}
      {showEditModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3">
              <h4 className="text-sm font-bold text-[#27272A]">Edit Document Details</h4>
              <button onClick={() => setShowEditModal(false)} className="text-[#71717A] hover:text-[#27272A] cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#27272A] mb-1">Document Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs text-[#27272A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#27272A] mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs text-[#27272A]"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Legal">Legal</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E4E4E7] text-[#71717A] hover:bg-neutral-50 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-[#27272A] font-bold shadow-xs cursor-pointer"
                >
                  {loadingAction ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: VERSIONS */}
      {showVersionsModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] p-6 max-w-lg w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3">
              <h4 className="text-sm font-bold text-[#27272A]">Document Version History</h4>
              <button onClick={() => setShowVersionsModal(false)} className="text-[#71717A] hover:text-[#27272A] cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="divide-y divide-[#E4E4E7] max-h-60 overflow-y-auto">
              {versionList.map((ver) => (
                <div key={ver.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#27272A]">Version {ver.versionNumber}</span>
                    <p className="text-[10px] text-[#71717A]">
                      Uploaded by {ver.uploaderName} • {new Date(ver.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#71717A]">{ver.fileSizeBytes} B</span>
                </div>
              ))}
              {versionList.length === 0 && (
                <p className="py-4 text-center text-xs text-[#71717A]">No prior versions on record.</p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setShowVersionsModal(false)}
                className="px-4 py-1.5 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#FFFBEB] font-bold text-xs text-[#27272A] cursor-pointer"
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