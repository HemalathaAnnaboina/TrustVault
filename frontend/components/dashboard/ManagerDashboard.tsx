'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import ThemeToggle from '../ui/ThemeToggle'
import { useRouter } from 'next/navigation'
import {
  FolderKanban,
  FileText,
  Users,
  Clock3,
  LockKeyhole,
  Activity,
  ShieldCheck,
  Plus,
  Minus,
  Menu,
  Search,
  Filter,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Download,
  Eye,
  Edit2,
  Trash2,
  UserPlus,
  UserX,
  UserCheck,
  Share2,
  Calendar,
  ChevronRight,
  ChevronDown,
  Settings,
  Home,
  Briefcase,
  Clock,
  ExternalLink,
  Lock,
  Shield,
  Layers,
  FileUp,
  FileCheck,
  Building,
  CheckSquare,
  Square,
  LogOut,
  Info,
  SlidersHorizontal,
} from 'lucide-react'
import {
  api,
  UserProfile,
  ProjectItem,
  ProjectMemberItem,
  DocumentItem,
  DocumentPreviewItem,
  EmployeeDirectoryItem,
  AccessRequestItem,
  RenewalRequestItem,
  AuditLogItem,
  ManagerStats,
  CreateProjectPayload,
  MemberAllocationPayload,
  DocumentPermissionAssignmentPayload,
  PermissionItem,
  getUser,
  getToken,
  logout,
} from '../../lib/api'

interface ManagerDashboardProps {
  initialTab?: string
}


interface DurationInputProps {
  label?: string
  value: number
  onChange: (val: number) => void
  min?: number
  max?: number
  helperText?: string
  showExpiry?: boolean
}

function DurationInput({
  label,
  value,
  onChange,
  min = 1,
  max = 30,
  helperText,
  showExpiry = true,
}: DurationInputProps) {
  const [localStr, setLocalStr] = useState(String(value))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLocalStr(String(value))
    setError(null)
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setLocalStr(raw)

    if (raw.trim() === '') {
      setError('Duration is required')
      return
    }
    if (raw.includes('.') || raw.includes(',')) {
      setError('Decimal values are not allowed')
      return
    }
    const num = Number(raw)
    if (!Number.isInteger(num)) {
      setError('Please enter a valid whole number')
      return
    }
    if (num <= 0) {
      setError('Duration must be at least 1 day')
      return
    }
    if (num > max) {
      setError(`Duration cannot exceed ${max} days`)
      return
    }

    setError(null)
    onChange(num)
  }

  const handleBlur = () => {
    if (error || !localStr) {
      setLocalStr(String(value))
      setError(null)
    }
  }

  const decrement = () => {
    const next = Math.max(min, value - 1)
    onChange(next)
    setLocalStr(String(next))
    setError(null)
  }

  const increment = () => {
    const next = Math.min(max, value + 1)
    onChange(next)
    setLocalStr(String(next))
    setError(null)
  }

  const expectedExpiry = new Date(Date.now() + value * 86400000)

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-neutral-900">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= min}
          className="size-8 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 flex items-center justify-center font-bold text-neutral-700 disabled:opacity-40 cursor-pointer shadow-xs transition"
          aria-label="Decrease duration"
        >
          <Minus className="size-3.5" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={localStr}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`w-18 text-center font-bold text-neutral-900 border rounded-lg py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            error ? 'border-rose-400 bg-rose-50/50' : 'border-neutral-300 bg-white'
          }`}
        />
        <button
          type="button"
          onClick={increment}
          disabled={value >= max}
          className="size-8 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 flex items-center justify-center font-bold text-neutral-700 disabled:opacity-40 cursor-pointer shadow-xs transition"
          aria-label="Increase duration"
        >
          <Plus className="size-3.5" />
        </button>
        <span className="text-xs text-neutral-500 font-semibold">days</span>
      </div>

      {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}

      {showExpiry && !error && (
        <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1.5 pt-0.5">
          <Clock className="size-3 text-amber-600 shrink-0" />
          <span>
            Expected Expiry: <strong>{expectedExpiry.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</strong> ({value} days from grant)
          </span>
        </p>
      )}

      {helperText && (
        <p className="text-[11px] text-neutral-400 leading-relaxed">{helperText}</p>
      )}
    </div>
  )
}

export default function ManagerDashboard({ initialTab = 'overview' }: ManagerDashboardProps) {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Scoped Dashboard Data
  const [stats, setStats] = useState<ManagerStats>({
    totalProjects: 0,
    vaultDocuments: 0,
    activeTeamMembers: 0,
    pendingRequests: 0,
    expiringPermissions: 0,
    securityEvents: 0,
  })
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [members, setMembers] = useState<EmployeeDirectoryItem[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([])
  const [renewalRequests, setRenewalRequests] = useState<RenewalRequestItem[]>([])
  const [loadingRequests, setLoadingRequests] = useState<boolean>(true)
  const [requestsError, setRequestsError] = useState<string | null>(null)
  const [requestTabFilter, setRequestTabFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])

  // Duration Selection States
  const [wizardDefaultDocumentDuration, setWizardDefaultDocumentDuration] = useState<number>(30)
  const [addMemberDuration, setAddMemberDuration] = useState<number>(30)
  const [shareDuration, setShareDuration] = useState<number>(30)

  // Review Renewal Modal State
  const [showReviewRenewalModal, setShowReviewRenewalModal] = useState<boolean>(false)
  const [selectedRenewal, setSelectedRenewal] = useState<RenewalRequestItem | null>(null)
  const [renewalExtensionDays, setRenewalExtensionDays] = useState<number>(30)
  const [renewalNotes, setRenewalNotes] = useState<string>('')
  const [submittingRenewalReview, setSubmittingRenewalReview] = useState<boolean>(false)

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'members' | 'docs'>('date')

  // Selected Project for Detail Modal
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null)
  const [projectDetailTab, setProjectDetailTab] = useState<'overview' | 'members' | 'documents' | 'permissions' | 'requests' | 'audit'>('overview')
  const [selectedProjectMembers, setSelectedProjectMembers] = useState<ProjectMemberItem[]>([])
  const [loadingProjectMembers, setLoadingProjectMembers] = useState(false)

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)
  const [previewData, setPreviewData] = useState<DocumentPreviewItem | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Create Project Wizard State
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState<number>(1)
  const [submittingWizard, setSubmittingWizard] = useState(false)

  // Wizard Form Data
  const [wizardName, setWizardName] = useState('')
  const [wizardDesc, setWizardDesc] = useState('')
  const [wizardCategory, setWizardCategory] = useState('General')
  const [wizardSelectedMembers, setWizardSelectedMembers] = useState<Array<{
    email: string
    name: string
    responsibility: string
    canView: boolean
    canEdit: boolean
  }>>([])
  const [wizardMemberSearch, setWizardMemberSearch] = useState('')
  const [wizardUploadedFiles, setWizardUploadedFiles] = useState<File[]>([])
  const [wizardSelectedExistingDocIds, setWizardSelectedExistingDocIds] = useState<string[]>([])
  const [wizardExistingDocSearch, setWizardExistingDocSearch] = useState('')

  // Wizard Permission Matrix: key is `${docIdentifier}_${userEmail}`
  const [wizardPermissions, setWizardPermissions] = useState<Record<string, {
    permissionLevel: 'READ' | 'EDIT' | 'DOWNLOAD'
    preset: 'Viewer' | 'Reader' | 'Editor' | 'Custom' | 'No access'
    durationDays?: number
    expiresAt: string
  }>>({})

  // Combined Access & Renewal Requests for Manager
  const combinedRequests = useMemo(() => {
    type UnifiedReqItem = {
      id: string
      type: 'ACCESS' | 'RENEWAL'
      requesterName: string
      requesterEmail: string
      documentTitle: string
      projectName?: string
      requestedCapability: string
      durationDays?: number
      reason: string
      status: string
      createdAt: string
      rawAccess?: AccessRequestItem
      rawRenewal?: RenewalRequestItem
    }

    const list: UnifiedReqItem[] = []

    accessRequests.forEach((ar) => {
      list.push({
        id: ar.id,
        type: 'ACCESS',
        requesterName: ar.requesterName || ar.requesterEmail,
        requesterEmail: ar.requesterEmail,
        documentTitle: ar.documentTitle || ar.requestedFilename || 'Document',
        projectName: ar.projectName || undefined,
        requestedCapability: ar.requestedPermission || 'READ',
        durationDays: ar.durationDays || 30,
        reason: ar.reason || 'Not specified',
        status: ar.status,
        createdAt: ar.createdAt,
        rawAccess: ar,
      })
    })

    renewalRequests.forEach((rr) => {
      list.push({
        id: rr.id,
        type: 'RENEWAL',
        requesterName: rr.requesterName || rr.requesterEmail,
        requesterEmail: rr.requesterEmail,
        documentTitle: rr.documentTitle || 'Document',
        projectName: rr.projectName || undefined,
        requestedCapability: `Renewal (+${rr.requestedExtensionDays || 30}d)`,
        durationDays: rr.requestedExtensionDays || 30,
        reason: rr.reason || 'Not specified',
        status: rr.status,
        createdAt: rr.createdAt,
        rawRenewal: rr,
      })
    })

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return list
  }, [accessRequests, renewalRequests])

  const filteredCombinedRequests = useMemo(() => {
    if (requestTabFilter === 'ALL') return combinedRequests
    return combinedRequests.filter((r) => r.status === requestTabFilter)
  }, [combinedRequests, requestTabFilter])

  // Add Member to Existing Project Modal State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [addMemberEmail, setAddMemberEmail] = useState('')
  const [addMemberResp, setAddMemberResp] = useState('Contributor')
  const [addMemberDocPerms, setAddMemberDocPerms] = useState<Record<string, 'READ' | 'EDIT' | 'NONE'>>({})
  const [submittingAddMember, setSubmittingAddMember] = useState(false)

  // Share Document Modal State
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareDoc, setShareDoc] = useState<DocumentItem | null>(null)
  const [shareRecipients, setShareRecipients] = useState<Array<{ email: string; permissionLevel: 'READ' | 'EDIT' | 'DOWNLOAD'; expiresAt?: string }>>([])
  const [submittingShare, setSubmittingShare] = useState(false)

  // Review Access Request Modal State
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedReq, setSelectedReq] = useState<AccessRequestItem | null>(null)
  const [reviewGrantLevel, setReviewGrantLevel] = useState<'READ' | 'EDIT'>('READ')
  const [reviewDurationDays, setReviewDurationDays] = useState(30)
  const [reviewNotes, setReviewNotes] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Confirmation Action Modal State
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    actionLabel: string
    isDestructive: boolean
    onConfirm: () => Promise<void>
  } | null>(null)
  const [submittingConfirm, setSubmittingConfirm] = useState(false)

  // File Upload Modal for Single File inside Project
  const [showDocUploadModal, setShowDocUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('General')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Load Initial Data
  const loadDashboardData = async () => {
    try {
      setLoadingStats(true)
      const u = getUser()
      setCurrentUser(u)

      setLoadingRequests(true)
      setRequestsError(null)

      // Fetch manager stats, projects, documents, employees, access requests, renewals, audit logs concurrently
      const [statsRes, projRes, docRes, empRes, reqRes, renRes, auditRes] = await Promise.allSettled([
        api.getManagerStats(),
        api.getProjects(),
        api.getDocuments(),
        api.getEmployees(),
        api.getAccessRequests(),
        api.getOwnerRenewals(),
        api.getAuditLogs({ size: 50 }),
      ])

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value)
      }
      if (projRes.status === 'fulfilled') {
        setProjects(projRes.value)
      }
      if (docRes.status === 'fulfilled') {
        setDocuments(docRes.value)
      }
      if (empRes.status === 'fulfilled') {
        setMembers(empRes.value)
      }

      let hadReqError = false
      if (reqRes.status === 'fulfilled') {
        setAccessRequests(reqRes.value)
      } else {
        hadReqError = true
      }
      if (renRes.status === 'fulfilled') {
        setRenewalRequests(renRes.value)
      } else {
        hadReqError = true
      }

      if (hadReqError && reqRes.status === 'rejected' && renRes.status === 'rejected') {
        setRequestsError('Unable to load requests. Please check network connection and try again.')
      }

      if (auditRes.status === 'fulfilled') {
        setAuditLogs(auditRes.value)
      }
      setLoadingRequests(false)
    } catch (err: any) {
      showToast(err.message || 'Error loading manager dashboard data', 'error')
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Load project members when selected project changes
  useEffect(() => {
    if (selectedProject) {
      loadProjectMembers(selectedProject.id)
    }
  }, [selectedProject])

  const loadProjectMembers = async (projectId: string) => {
    try {
      setLoadingProjectMembers(true)
      const res = await api.getProjectMembers(projectId)
      setSelectedProjectMembers(res)
    } catch (err: any) {
      showToast(err.message || 'Failed to load project members', 'error')
    } finally {
      setLoadingProjectMembers(false)
    }
  }

  // Filtered Projects for All Projects View
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStatus =
        statusFilter === 'ALL' || (p.status || 'ACTIVE').toUpperCase() === statusFilter.toUpperCase()

      const matchesCategory =
        categoryFilter === 'ALL' || (p.category || 'General').toLowerCase() === categoryFilter.toLowerCase()

      return matchesSearch && matchesStatus && matchesCategory
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'members') return (b.memberCount || 0) - (a.memberCount || 0)
      if (sortBy === 'docs') return (b.documentCount || 0) - (a.documentCount || 0)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [projects, searchQuery, statusFilter, categoryFilter, sortBy])

  // Filtered members for Wizard Step 2
  const filteredWizardEligibleMembers = useMemo(() => {
    return members.filter((m) => {
      const q = wizardMemberSearch.toLowerCase()
      return !wizardMemberSearch || m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    })
  }, [members, wizardMemberSearch])

  // Combined documents list for Wizard Steps 4 & 5
  const wizardAllDocs = useMemo(() => {
    const list: Array<{ id: string; name: string; isNewUpload: boolean; file?: File; existingDoc?: DocumentItem }> = []
    wizardUploadedFiles.forEach((file) => {
      list.push({ id: file.name, name: file.name, isNewUpload: true, file })
    })
    wizardSelectedExistingDocIds.forEach((docId) => {
      const found = documents.find((d) => d.id === docId)
      if (found) {
        list.push({ id: found.id, name: found.title || found.originalFilename, isNewUpload: false, existingDoc: found })
      }
    })
    return list
  }, [wizardUploadedFiles, wizardSelectedExistingDocIds, documents])

  // Toggle member selection in wizard
  const toggleWizardMember = (member: EmployeeDirectoryItem) => {
    setWizardSelectedMembers((prev) => {
      const exists = prev.some((m) => m.email.toLowerCase() === member.email.toLowerCase())
      if (exists) {
        return prev.filter((m) => m.email.toLowerCase() !== member.email.toLowerCase())
      } else {
        return [
          ...prev,
          {
            email: member.email,
            name: member.fullName,
            responsibility: 'Contributor',
            canView: true,
            canEdit: false,
          },
        ]
      }
    })
  }

  // Select/Deselect All currently filtered members
  const toggleSelectAllFilteredMembers = () => {
    const allFilteredSelected = filteredWizardEligibleMembers.every((m) =>
      wizardSelectedMembers.some((sm) => sm.email.toLowerCase() === m.email.toLowerCase())
    )

    if (allFilteredSelected) {
      const filteredEmails = new Set(filteredWizardEligibleMembers.map((m) => m.email.toLowerCase()))
      setWizardSelectedMembers((prev) => prev.filter((m) => !filteredEmails.has(m.email.toLowerCase())))
    } else {
      const existingEmails = new Set(wizardSelectedMembers.map((m) => m.email.toLowerCase()))
      const toAdd = filteredWizardEligibleMembers
        .filter((m) => !existingEmails.has(m.email.toLowerCase()))
        .map((m) => ({
          email: m.email,
          name: m.fullName,
          responsibility: 'Contributor',
          canView: true,
          canEdit: false,
        }))
      setWizardSelectedMembers((prev) => [...prev, ...toAdd])
    }
  }

  // Handle Wizard Permission Matrix Cell Change
  const updateWizardPermissionCell = (
    docKey: string,
    userEmail: string,
    preset: 'Viewer' | 'Reader' | 'Editor' | 'Custom' | 'No access',
    capabilities?: { level: 'READ' | 'EDIT' | 'DOWNLOAD'; expiresAt?: string }
  ) => {
    const cellKey = `${docKey}_${userEmail}`
    let level: 'READ' | 'EDIT' | 'DOWNLOAD' = 'READ'

    if (preset === 'Editor') {
      level = 'EDIT'
    } else if (preset === 'No access') {
      level = 'READ'
    } else if (preset === 'Custom' && capabilities) {
      level = capabilities.level
    }

    const defaultExpiry = new Date(Date.now() + 30 * 86400000).toISOString()

    setWizardPermissions((prev) => ({
      ...prev,
      [cellKey]: {
        preset,
        permissionLevel: level,
        expiresAt: capabilities?.expiresAt || prev[cellKey]?.expiresAt || defaultExpiry,
      },
    }))
  }

  // Bulk Apply Permission Preset for all members on a document
  const applyPresetToAllMembersForDoc = (
    docKey: string,
    preset: 'Viewer' | 'Reader' | 'Editor' | 'No access'
  ) => {
    const defaultExpiry = new Date(Date.now() + 30 * 86400000).toISOString()
    const level: 'READ' | 'EDIT' | 'DOWNLOAD' = preset === 'Editor' ? 'EDIT' : 'READ'

    setWizardPermissions((prev) => {
      const updated = { ...prev }
      wizardSelectedMembers.forEach((m) => {
        const cellKey = `${docKey}_${m.email}`
        updated[cellKey] = {
          preset,
          permissionLevel: level,
          expiresAt: prev[cellKey]?.expiresAt || defaultExpiry,
        }
      })
      return updated
    })
  }

  // Handle Wizard Submission
  const handleCreateProjectSubmit = async () => {
    if (!wizardName.trim()) {
      showToast('Project name is required', 'error')
      setWizardStep(1)
      return
    }

    setSubmittingWizard(true)
    try {
      // 1. Upload new files first if any
      const newlyUploadedDocIds: string[] = []
      for (const file of wizardUploadedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', file.name)
        formData.append('category', wizardCategory || 'General')
        const uploaded = await api.uploadDocument(formData)
        newlyUploadedDocIds.push(uploaded.id)
      }

      // Combine existing doc IDs + newly uploaded doc IDs
      const allDocIdsToAttach = [...wizardSelectedExistingDocIds, ...newlyUploadedDocIds]

      // 2. Prepare atomic permissions assignment payload
      const permissionsPayload: DocumentPermissionAssignmentPayload[] = []
      wizardAllDocs.forEach((doc, idx) => {
        const actualDocId = doc.isNewUpload ? newlyUploadedDocIds[idx] : doc.id
        wizardSelectedMembers.forEach((m) => {
          const cell = wizardPermissions[`${doc.id}_${m.email}`]
          if (cell && cell.preset !== 'No access') {
            const chosenDuration = cell.durationDays || wizardDefaultDocumentDuration
            const chosenExpiry = cell.expiresAt || new Date(Date.now() + chosenDuration * 86400000).toISOString()
            permissionsPayload.push({
              documentId: actualDocId,
              documentTitle: doc.name,
              userEmail: m.email,
              permissionLevel: cell.permissionLevel,
              durationDays: chosenDuration,
              expiresAt: chosenExpiry,
            })
          }
        })
      })

      // 3. Prepare Member Allocations
      const memberAllocations: MemberAllocationPayload[] = wizardSelectedMembers.map((m) => ({
        userEmail: m.email,
        responsibility: m.responsibility || 'Contributor',
        canView: m.canView ?? true,
        canEdit: m.canEdit ?? false,
      }))

      // 4. Submit atomic create project request
      const payload: CreateProjectPayload = {
        name: wizardName.trim(),
        description: wizardDesc.trim() || undefined,
        category: wizardCategory || 'General',
        status: 'ACTIVE',
        defaultDocumentDurationDays: wizardDefaultDocumentDuration,
        members: memberAllocations,
        existingDocumentIds: allDocIdsToAttach,
        permissions: permissionsPayload,
      }

      const created = await api.createProject(payload)
      showToast(`Project "${created.name}" created successfully!`, 'success')

      // Reset wizard
      setShowWizard(false)
      setWizardStep(1)
      setWizardName('')
      setWizardDesc('')
      setWizardCategory('General')
      setWizardSelectedMembers([])
      setWizardUploadedFiles([])
      setWizardSelectedExistingDocIds([])
      setWizardPermissions({})

      // Refresh dashboard data & open project overview modal
      await loadDashboardData()
      setSelectedProject(created)
      setProjectDetailTab('overview')
    } catch (err: any) {
      showToast(err.message || 'Failed to create project', 'error')
    } finally {
      setSubmittingWizard(false)
    }
  }

  // Scoped Suspend Member
  const handleSuspendMember = (member: ProjectMemberItem) => {
    if (!selectedProject) return
    setConfirmModal({
      title: 'Suspend Project Membership',
      message: `Are you sure you want to suspend ${member.fullName || member.userEmail} from project "${selectedProject.name}"? They will be immediately denied access to all documents in this project without affecting their account in other projects.`,
      actionLabel: 'Suspend Membership',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api.suspendProjectMember(selectedProject.id, member.id, 'Suspended by Project Manager')
          showToast(`Membership for ${member.userEmail} suspended`, 'success')
          await loadProjectMembers(selectedProject.id)
          await loadDashboardData()
        } catch (err: any) {
          showToast(err.message || 'Failed to suspend member', 'error')
        }
      },
    })
  }

  // Scoped Reactivate Member
  const handleReactivateMember = async (member: ProjectMemberItem) => {
    if (!selectedProject) return
    try {
      await api.reactivateProjectMember(selectedProject.id, member.id)
      showToast(`Membership for ${member.userEmail} reactivated`, 'success')
      await loadProjectMembers(selectedProject.id)
      await loadDashboardData()
    } catch (err: any) {
      showToast(err.message || 'Failed to reactivate member', 'error')
    }
  }

  // Remove Project Member
  const handleRemoveMember = (member: ProjectMemberItem) => {
    if (!selectedProject) return
    setConfirmModal({
      title: 'Remove Member from Project',
      message: `Remove ${member.fullName || member.userEmail} from project "${selectedProject.name}"? Their document permissions in this project will be revoked.`,
      actionLabel: 'Remove Member',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api.removeProjectMember(selectedProject.id, member.id)
          showToast('Member removed from project', 'success')
          await loadProjectMembers(selectedProject.id)
          await loadDashboardData()
        } catch (err: any) {
          showToast(err.message || 'Failed to remove member', 'error')
        }
      },
    })
  }

  // Add Member to Existing Project
  const handleAddMemberToProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject || !addMemberEmail) return

    setSubmittingAddMember(true)
    try {
      await api.addProjectMember(selectedProject.id, addMemberEmail, addMemberResp, addMemberDuration)

      // Apply chosen document permissions if any
      const assignments: Array<{ userEmail: string; permissionLevel: 'READ' | 'EDIT' | 'DOWNLOAD'; durationDays?: number }> = []
      Object.entries(addMemberDocPerms).forEach(([docId, perm]) => {
        if (perm === 'READ' || perm === 'EDIT') {
          assignments.push({ userEmail: addMemberEmail, permissionLevel: perm, durationDays: addMemberDuration })
          api.shareProjectDocument(selectedProject.id, docId, [
            { userEmail: addMemberEmail, permissionLevel: perm, durationDays: addMemberDuration },
          ]).catch(() => {})
        }
      })

      showToast(`Added ${addMemberEmail} to project`, 'success')
      setShowAddMemberModal(false)
      setAddMemberEmail('')
      setAddMemberResp('Contributor')
      setAddMemberDocPerms({})
      await loadProjectMembers(selectedProject.id)
      await loadDashboardData()
    } catch (err: any) {
      showToast(err.message || 'Failed to add member to project', 'error')
    } finally {
      setSubmittingAddMember(false)
    }
  }

  // Secure Preview Document
  const handlePreviewDoc = async (doc: DocumentItem) => {
    setPreviewDoc(doc)
    setPreviewData(null)
    setLoadingPreview(true)
    try {
      const data = await api.getDocumentPreview(doc.id)
      setPreviewData(data)
    } catch (err: any) {
      showToast(err.message || 'Failed to load document preview', 'error')
    } finally {
      setLoadingPreview(false)
    }
  }

  // Handle Download File with Single-Use Token
  const handleDownloadDoc = async (doc: DocumentItem) => {
    try {
      showToast('Generating secure download token...', 'info')
      const { downloadUrl } = await api.getDownloadToken(doc.id)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.setAttribute('download', doc.originalFilename || doc.title)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('Download started', 'success')
    } catch (err: any) {
      showToast(err.message || 'Download denied: You do not have DOWNLOAD permission for this file', 'error')
    }
  }

  // Review Access Request (Approve/Reject)
  const handleReviewAccessSubmit = async (approved: boolean) => {
    if (!selectedReq) return
    setSubmittingReview(true)
    try {
      await api.reviewAccessRequest(selectedReq.id, {
        approved,
        grantedPermission: approved ? reviewGrantLevel : undefined,
        durationDays: approved ? reviewDurationDays : undefined,
        reviewerNotes: reviewNotes.trim() || undefined,
      })
      showToast(
        approved
          ? `Approved request for ${selectedReq.requesterEmail} with ${reviewGrantLevel} access`
          : `Rejected request for ${selectedReq.requesterEmail}`,
        approved ? 'success' : 'info'
      )
      setShowReviewModal(false)
      setSelectedReq(null)
      await loadDashboardData()
    } catch (err: any) {
      showToast(err.message || 'Failed to process request', 'error')
    } finally {
      setSubmittingReview(false)
    }
  }

  // Review Renewal Request (Approve/Reject)
  const handleReviewRenewalSubmit = async (approved: boolean) => {
    if (!selectedRenewal) return
    setSubmittingRenewalReview(true)
    try {
      await api.reviewRenewal(selectedRenewal.id, {
        approved,
        extensionDays: approved ? renewalExtensionDays : undefined,
        reviewNote: renewalNotes.trim() || undefined,
      })
      showToast(
        approved
          ? `Approved renewal for ${selectedRenewal.requesterEmail} (+${renewalExtensionDays} days)`
          : `Rejected renewal for ${selectedRenewal.requesterEmail}`,
        approved ? 'success' : 'info'
      )
      setShowReviewRenewalModal(false)
      setSelectedRenewal(null)
      await loadDashboardData()
    } catch (err: any) {
      showToast(err.message || 'Failed to process renewal request', 'error')
    } finally {
      setSubmittingRenewalReview(false)
    }
  }

  // Documents attached to selected project
  const selectedProjectDocs = useMemo(() => {
    if (!selectedProject) return []
    return documents.filter((d) => d.projectId === selectedProject.id)
  }, [selectedProject, documents])

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex font-sans overflow-x-hidden">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="size-4 text-emerald-600" />}
          {toast.type === 'error' && <AlertCircle className="size-4 text-rose-600" />}
          {toast.type === 'info' && <Info className="size-4 text-amber-600" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75 cursor-pointer">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Mobile Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* ============================================================ */}
      {/* VERTICAL LEFT SIDEBAR - 100vh Full Height, Fixed on Left     */}
      {/* ============================================================ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col justify-between border-r border-neutral-200 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Sidebar Brand Header */}
          <div className="p-5 border-b border-neutral-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-xl bg-amber-400 text-neutral-950 font-black shadow-xs ring-2 ring-yellow-400/40">
                  <Shield className="size-5 text-neutral-950" />
                </div>
                <div>
                  <h1 className="text-base font-extrabold tracking-tight text-neutral-900">TrustVault</h1>
                  <span className="rounded-md bg-amber-100 border border-amber-300 px-1.5 py-0.2 text-[9px] font-bold text-amber-900 uppercase tracking-wide">
                    Manager Workspace
                  </span>
                </div>
              </div>

              {/* Close Button on Mobile */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 lg:hidden cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Current Manager Identity Card */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 shadow-xs">
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <div className="size-7 rounded-full bg-amber-400 text-neutral-950 font-black text-xs grid place-items-center shrink-0 ring-1 ring-yellow-500/50">
                  {currentUser?.fullName?.charAt(0) || 'M'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-900 truncate leading-tight">
                    {currentUser?.fullName || 'Manager'}
                  </p>
                  <p className="text-[10px] text-amber-900 font-semibold truncate leading-tight">ROLE_MANAGER</p>
                </div>
              </div>
              <button
                onClick={() => {
                  logout()
                  router.push('/login')
                }}
                title="Sign Out"
                className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Navigation Items (Arranged vertically one below another) */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {[
              { id: 'overview', label: 'Overview', icon: Home },
              { id: 'projects', label: 'All Projects', icon: FolderKanban, badge: stats.totalProjects },
              { id: 'documents', label: 'Vault Documents', icon: FileText, badge: stats.vaultDocuments },
              { id: 'members', label: 'Active Team Members', icon: Users, badge: stats.activeTeamMembers },
              { id: 'requests', label: 'Pending Requests', icon: Clock3, badge: stats.pendingRequests, alert: stats.pendingRequests > 0 },
              { id: 'expiring', label: 'Expiring Permissions', icon: LockKeyhole, badge: stats.expiringPermissions },
              { id: 'audit', label: 'Security Events', icon: Activity, badge: stats.securityEvents },
              { id: 'settings', label: 'Manager Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-neutral-950 shadow-xs ring-1 ring-yellow-400/60'
                      : 'text-neutral-600 hover:bg-amber-50/60 hover:text-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`size-4 shrink-0 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black shrink-0 ${
                        isActive
                          ? 'bg-neutral-950 text-white'
                          : item.alert
                          ? 'bg-amber-400 text-neutral-950 border border-amber-500'
                          : 'bg-neutral-200 text-neutral-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Sidebar Footer Action */}
          <div className="p-3 border-t border-neutral-200 space-y-2 bg-white">
            <button
              onClick={() => {
                setWizardStep(1)
                setShowWizard(true)
                setMobileMenuOpen(false)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>Create Project</span>
            </button>
            <div className="flex items-center justify-between px-2 pt-1 text-[10px] text-neutral-400 font-medium">
              <span>Zero-Trust Vault</span>
              <span>v2.4 Secured</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* RIGHT MAIN CONTAINER (Uses remaining width via lg:pl-64)     */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/95 px-6 backdrop-blur-xs shadow-xs">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="grid size-9 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 lg:hidden cursor-pointer"
              aria-label="Open sidebar navigation"
            >
              <Menu className="size-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-neutral-900 tracking-tight">
                  {activeTab === 'overview' && 'Dashboard Overview'}
                  {activeTab === 'projects' && 'Project Management'}
                  {activeTab === 'documents' && 'Vault Documents'}
                  {activeTab === 'members' && 'Team Members & Responsibilities'}
                  {activeTab === 'requests' && 'Pending Access & Renewal Requests'}
                  {activeTab === 'expiring' && 'Expiring Permissions'}
                  {activeTab === 'audit' && 'Security Audit Trail'}
                  {activeTab === 'settings' && 'Manager Settings'}
                </h2>
                <span className="hidden sm:inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Zero-Trust
                </span>
              </div>
              <p className="text-xs text-neutral-500 hidden sm:block">
                Document-level access control & tamper-evident audit logging
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setWizardStep(1)
                setShowWizard(true)
              }}
              className="hidden sm:flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>Create Project</span>
            </button>

            <button
              onClick={() => loadDashboardData()}
              disabled={loadingStats}
              title="Refresh Data"
              className="grid size-9 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 transition shadow-xs cursor-pointer"
            >
              <RefreshCw className={`size-4 ${loadingStats ? 'animate-spin text-amber-600' : ''}`} />
            </button>

            <ThemeToggle />

            <div className="h-6 w-px bg-neutral-200 mx-1" />

            <div className="flex items-center gap-2.5 pl-1">
              <div className="size-8 rounded-full bg-neutral-200 border border-neutral-300 grid place-items-center text-neutral-700 font-bold text-xs">
                {currentUser?.fullName?.charAt(0) || 'M'}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-neutral-900 leading-tight">
                  {currentUser?.fullName || 'Manager'}
                </div>
                <div className="text-[10px] text-neutral-500 leading-tight">ROLE_MANAGER</div>
              </div>
              <button
                onClick={() => {
                  logout()
                  router.push('/login')
                }}
                title="Logout"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition ml-1 cursor-pointer"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* ======================= TAB: OVERVIEW ======================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Six Clickable Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card 1: All Projects */}
              <div
                onClick={() => setActiveTab('projects')}
                role="button"
                tabIndex={0}
                className="group p-5 rounded-2xl bg-white border border-neutral-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">All Projects</span>
                  <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700 group-hover:bg-amber-400 group-hover:text-neutral-950 transition">
                    <FolderKanban className="size-4.5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black text-neutral-900">
                    {loadingStats ? <span className="animate-pulse">...</span> : stats.totalProjects}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 flex items-center justify-between">
                    <span>Authorized project workspaces</span>
                    <ChevronRight className="size-3.5 text-neutral-400 group-hover:translate-x-1 transition" />
                  </p>
                </div>
              </div>

              {/* Card 2: Vault Documents */}
              <div
                onClick={() => setActiveTab('documents')}
                role="button"
                tabIndex={0}
                className="group p-5 rounded-2xl bg-white border border-neutral-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Vault Documents</span>
                  <div className="grid size-9 place-items-center rounded-xl bg-neutral-100 text-neutral-700 group-hover:bg-amber-400 group-hover:text-neutral-950 transition">
                    <FileText className="size-4.5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black text-neutral-900">
                    {loadingStats ? <span className="animate-pulse">...</span> : stats.vaultDocuments}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 flex items-center justify-between">
                    <span>SHA-256 integrity protected files</span>
                    <ChevronRight className="size-3.5 text-neutral-400 group-hover:translate-x-1 transition" />
                  </p>
                </div>
              </div>

              {/* Card 3: Active Team Members */}
              <div
                onClick={() => setActiveTab('members')}
                role="button"
                tabIndex={0}
                className="group p-5 rounded-2xl bg-white border border-neutral-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Active Team Members</span>
                  <div className="grid size-9 place-items-center rounded-xl bg-neutral-100 text-neutral-700 group-hover:bg-amber-400 group-hover:text-neutral-950 transition">
                    <Users className="size-4.5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black text-neutral-900">
                    {loadingStats ? <span className="animate-pulse">...</span> : stats.activeTeamMembers}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 flex items-center justify-between">
                    <span>Active members across projects</span>
                    <ChevronRight className="size-3.5 text-neutral-400 group-hover:translate-x-1 transition" />
                  </p>
                </div>
              </div>

              {/* Card 4: Pending Requests */}
              <div
                onClick={() => setActiveTab('requests')}
                role="button"
                tabIndex={0}
                className="group p-5 rounded-2xl bg-white border border-neutral-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Pending Requests</span>
                  <div className="grid size-9 place-items-center rounded-xl bg-amber-100 text-amber-800 group-hover:bg-amber-400 group-hover:text-neutral-950 transition">
                    <Clock3 className="size-4.5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black text-neutral-900">
                    {loadingStats ? <span className="animate-pulse">...</span> : stats.pendingRequests}
                  </div>
                  <p className="mt-1 text-xs text-amber-700 font-semibold flex items-center justify-between">
                    <span>Requires manager review</span>
                    <ChevronRight className="size-3.5 text-neutral-400 group-hover:translate-x-1 transition" />
                  </p>
                </div>
              </div>

              {/* Card 5: Expiring Permissions */}
              <div
                onClick={() => setActiveTab('expiring')}
                role="button"
                tabIndex={0}
                className="group p-5 rounded-2xl bg-white border border-neutral-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Expiring Permissions</span>
                  <div className="grid size-9 place-items-center rounded-xl bg-neutral-100 text-neutral-700 group-hover:bg-amber-400 group-hover:text-neutral-950 transition">
                    <LockKeyhole className="size-4.5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black text-neutral-900">
                    {loadingStats ? <span className="animate-pulse">...</span> : stats.expiringPermissions}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 flex items-center justify-between">
                    <span>Expiring within 30 days</span>
                    <ChevronRight className="size-3.5 text-neutral-400 group-hover:translate-x-1 transition" />
                  </p>
                </div>
              </div>

              {/* Card 6: Security Events */}
              <div
                onClick={() => setActiveTab('audit')}
                role="button"
                tabIndex={0}
                className="group p-5 rounded-2xl bg-white border border-neutral-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Security Events</span>
                  <div className="grid size-9 place-items-center rounded-xl bg-neutral-100 text-neutral-700 group-hover:bg-amber-400 group-hover:text-neutral-950 transition">
                    <Activity className="size-4.5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black text-neutral-900">
                    {loadingStats ? <span className="animate-pulse">...</span> : stats.securityEvents}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 flex items-center justify-between">
                    <span>Audit ledger events in past 30 days</span>
                    <ChevronRight className="size-3.5 text-neutral-400 group-hover:translate-x-1 transition" />
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="p-4 rounded-2xl bg-white border border-neutral-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-amber-500" />
                <span>Quick Actions</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setWizardStep(1)
                    setShowWizard(true)
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <Plus className="size-3.5" />
                  <span>Create Project</span>
                </button>
                <button
                  onClick={() => {
                    setShowDocUploadModal(true)
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                >
                  <FileUp className="size-3.5" />
                  <span>Upload Document</span>
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className="flex items-center gap-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                >
                  <Users className="size-3.5" />
                  <span>Manage Members</span>
                </button>
                <button
                  onClick={() => setActiveTab('requests')}
                  className="flex items-center gap-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                >
                  <Clock3 className="size-3.5" />
                  <span>Review Requests</span>
                </button>
              </div>
            </div>

            {/* Two Column Layout: Recent Projects & Pending Requests */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Projects */}
              <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="size-4 text-amber-500" />
                    <h2 className="text-sm font-bold text-neutral-900">Recent Projects</h2>
                  </div>
                  <button
                    onClick={() => setActiveTab('projects')}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All</span>
                    <ArrowRight className="size-3" />
                  </button>
                </div>

                <div className="divide-y divide-neutral-100 mt-2">
                  {projects.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProject(p)
                        setProjectDetailTab('overview')
                      }}
                      className="py-3 flex items-center justify-between hover:bg-neutral-50 px-2 rounded-xl transition cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-neutral-900">{p.name}</span>
                          <span className="rounded bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                            {p.category || 'General'}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                          {p.description || 'No description'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div className="text-[11px] text-neutral-500">
                          <div>{p.memberCount || 0} members</div>
                          <div>{p.documentCount || 0} docs</div>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            (p.status || 'ACTIVE') === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {p.status || 'ACTIVE'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="py-6 text-center text-xs text-neutral-400">
                      No projects created yet. Click "Create Project" to get started.
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Requests Requiring Attention */}
              <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-4 text-amber-600" />
                    <h2 className="text-sm font-bold text-neutral-900">Pending Access Requests</h2>
                  </div>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All</span>
                    <ArrowRight className="size-3" />
                  </button>
                </div>

                <div className="divide-y divide-neutral-100 mt-2">
                  {combinedRequests.filter((r) => r.status === 'PENDING').slice(0, 4).map((req) => (
                    <div key={`${req.type}_${req.id}`} className="py-3 flex items-center justify-between hover:bg-neutral-50 px-2 rounded-xl transition">
                      <div>
                        <div className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                          <span>{req.documentTitle || 'Document'}</span>
                          <span className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${
                            req.type === 'RENEWAL' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {req.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          Requester: <span className="font-medium text-neutral-700">{req.requesterEmail}</span>
                        </div>
                        <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                          Requested: {req.requestedCapability} • Reason: {req.reason || 'Not specified'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (req.type === 'ACCESS' && req.rawAccess) {
                            setSelectedReq(req.rawAccess)
                            setReviewGrantLevel((req.rawAccess.requestedPermission as any) === 'EDIT' ? 'EDIT' : 'READ')
                            setReviewDurationDays(req.rawAccess.durationDays || 30)
                            setShowReviewModal(true)
                          } else if (req.type === 'RENEWAL' && req.rawRenewal) {
                            setSelectedRenewal(req.rawRenewal)
                            setRenewalExtensionDays(req.rawRenewal.requestedExtensionDays || 30)
                            setShowReviewRenewalModal(true)
                          }
                        }}
                        className="rounded-lg bg-amber-400 hover:bg-amber-500 text-neutral-950 px-2.5 py-1 text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                  {combinedRequests.filter((r) => r.status === 'PENDING').length === 0 && (
                    <div className="py-6 text-center text-xs text-neutral-400">
                      No pending requests requiring review.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Audit Activity */}
            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-neutral-900">Recent Security Activity</h2>
                </div>
                <button
                  onClick={() => setActiveTab('audit')}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Full Ledger</span>
                  <ArrowRight className="size-3" />
                </button>
              </div>

              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Resource</th>
                      <th className="py-2.5 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {auditLogs.slice(0, 5).map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50 transition">
                        <td className="py-2.5 px-3 text-neutral-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-neutral-800">
                          {log.actorEmail}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-neutral-900">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          {log.resourceType}: {log.resourceId?.substring(0, 8)}...
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              log.result === 'SUCCESS' || log.result === 'ALLOWED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {log.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-neutral-400">
                          No audit activity recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB: ALL PROJECTS ======================= */}
        {activeTab === 'projects' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Header / Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {/* Search Input */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects by name..."
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-8 pr-3 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ARCHIVED">Archived</option>
                </select>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Categories</option>
                  <option value="General">General</option>
                  <option value="College">College</option>
                  <option value="Hospital">Hospital</option>
                  <option value="Business">Business</option>
                  <option value="Financial">Financial</option>
                  <option value="Other">Other</option>
                </select>

                {/* Sorting */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-amber-400"
                >
                  <option value="date">Sort: Created Date</option>
                  <option value="name">Sort: Project Name</option>
                  <option value="members">Sort: Member Count</option>
                  <option value="docs">Sort: Document Count</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setWizardStep(1)
                  setShowWizard(true)
                }}
                className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Plus className="size-4 stroke-[2.5]" />
                <span>Create Project</span>
              </button>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((p) => (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-amber-400 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                        {p.category || 'General'}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          (p.status || 'ACTIVE') === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {p.status || 'ACTIVE'}
                      </span>
                    </div>

                    <h3 className="mt-3 text-sm font-bold text-neutral-900 line-clamp-1">{p.name}</h3>
                    <p className="mt-1 text-xs text-neutral-500 line-clamp-2 min-h-[32px]">
                      {p.description || 'No project description provided.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
                    <div className="text-[11px] text-neutral-500 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Users className="size-3 text-neutral-400" />
                        <span>{p.memberCount || 0} active members</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="size-3 text-neutral-400" />
                        <span>{p.documentCount || 0} documents</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedProject(p)
                        setProjectDetailTab('overview')
                      }}
                      className="flex items-center gap-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                    >
                      <span>Open Project</span>
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredProjects.length === 0 && (
              <div className="p-12 text-center rounded-2xl bg-white border border-neutral-200">
                <FolderKanban className="size-10 text-neutral-300 mx-auto" />
                <h3 className="mt-3 text-sm font-bold text-neutral-900">No Projects Found</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  {searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                    ? 'No projects match your filter criteria.'
                    : 'You have not created any projects yet.'}
                </p>
                <button
                  onClick={() => {
                    setWizardStep(1)
                    setShowWizard(true)
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 px-4 py-2 text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Create First Project</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB: VAULT DOCUMENTS ======================= */}
        {activeTab === 'documents' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Authorized Vault Documents</h2>
                <p className="text-xs text-neutral-500">
                  Total documents discoverable and manageable under your authorization
                </p>
              </div>
              <button
                onClick={() => setShowDocUploadModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <FileUp className="size-3.5" />
                <span>Upload Document</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Title / Filename</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Uploaded</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-neutral-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900">{doc.title}</div>
                        <div className="text-[10px] text-neutral-400">{doc.originalFilename}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                          {doc.category || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-500">{doc.formattedSize || `${doc.fileSizeBytes} B`}</td>
                      <td className="py-3 px-4 text-neutral-700 font-medium">
                        {doc.projectName || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 text-neutral-500">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handlePreviewDoc(doc)}
                          className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-bold transition cursor-pointer"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => {
                            setShareDoc(doc)
                            setShowShareModal(true)
                          }}
                          className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold transition cursor-pointer"
                        >
                          Share
                        </button>
                        <button
                          onClick={() => handleDownloadDoc(doc)}
                          className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-bold transition cursor-pointer"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-400">
                        No documents stored in vault.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB: ACTIVE TEAM MEMBERS ======================= */}
        {activeTab === 'members' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Active Workshop Members</h2>
                <p className="text-xs text-neutral-500">
                  Provisioned accounts created by Administrators eligible for project assignment
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Global Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Assigned Projects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-50 transition">
                      <td className="py-3 px-4 font-bold text-neutral-900">{m.fullName}</td>
                      <td className="py-3 px-4 text-neutral-600">{m.email}</td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            m.active ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                          }`}
                        >
                          {m.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-500 font-semibold">
                        {m.assignedProjectsCount || 0}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-400">
                        No team members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB: PENDING REQUESTS ======================= */}
        {activeTab === 'requests' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Access & Renewal Requests</h2>
                <p className="text-xs text-neutral-500">
                  Workshop member access and renewal requests scoped to your managed documents
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 border border-neutral-200 text-xs font-bold">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setRequestTabFilter(st)}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      requestTabFilter === st
                        ? 'bg-white text-neutral-900 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'All'
                      : st === 'PENDING'
                      ? `Pending (${combinedRequests.filter((r) => r.status === 'PENDING').length})`
                      : st.charAt(0) + st.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Error State */}
            {requestsError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-800 shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4.5 text-rose-600 shrink-0" />
                  <span>{requestsError}</span>
                </div>
                <button
                  onClick={loadDashboardData}
                  className="px-3 py-1 rounded-lg bg-rose-200 hover:bg-rose-300 text-rose-900 font-bold transition cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Requester</th>
                    <th className="py-3 px-4">Document / Project</th>
                    <th className="py-3 px-4">Requested Capability</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loadingRequests && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="size-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                          <span className="font-medium text-xs">Loading access & renewal requests...</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loadingRequests &&
                    filteredCombinedRequests.map((r) => (
                      <tr key={`${r.type}_${r.id}`} className="hover:bg-neutral-50 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-neutral-900">{r.requesterName}</div>
                          <div className="text-[10px] text-neutral-400">{r.requesterEmail}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-800 line-clamp-1">{r.documentTitle}</div>
                          {r.projectName && (
                            <div className="text-[10px] text-neutral-400">Project: {r.projectName}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1 ${
                              r.type === 'RENEWAL'
                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                : 'bg-amber-50 border-amber-200 text-amber-900'
                            }`}
                          >
                            {r.type === 'RENEWAL' ? 'RENEWAL' : 'ACCESS'}: {r.requestedCapability}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-neutral-600 max-w-xs truncate" title={r.reason}>
                          {r.reason || 'None provided'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              r.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : r.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.status === 'PENDING' ? (
                            <button
                              onClick={() => {
                                if (r.type === 'ACCESS' && r.rawAccess) {
                                  setSelectedReq(r.rawAccess)
                                  setReviewGrantLevel(
                                    (r.rawAccess.requestedPermission as any) === 'EDIT' ? 'EDIT' : 'READ'
                                  )
                                  setReviewDurationDays(r.rawAccess.durationDays || 30)
                                  setShowReviewModal(true)
                                } else if (r.type === 'RENEWAL' && r.rawRenewal) {
                                  setSelectedRenewal(r.rawRenewal)
                                  setRenewalExtensionDays(r.rawRenewal.requestedExtensionDays || 30)
                                  setShowReviewRenewalModal(true)
                                }
                              }}
                              className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold text-xs transition cursor-pointer shadow-xs"
                            >
                              Review
                            </button>
                          ) : (
                            <span className="text-[11px] text-neutral-400 font-medium">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))}

                  {!loadingRequests && filteredCombinedRequests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-neutral-400 text-xs">
                        No access requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB: EXPIRING PERMISSIONS ======================= */}
        {activeTab === 'expiring' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
              <h2 className="text-sm font-bold text-neutral-900">Expiring Permission Grants</h2>
              <p className="text-xs text-neutral-500">
                Document permissions that expire within the next 30 days
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.filter((d) => d.isExpiringSoon || d.expiresAt).map((d) => (
                <div key={d.id} className="p-4 rounded-2xl bg-white border border-neutral-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-neutral-900">{d.title}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">Project: {d.projectName || 'General'}</div>
                    <div className="text-[11px] text-rose-700 font-semibold mt-1 flex items-center gap-1">
                      <Clock className="size-3" />
                      <span>Expires: {d.expiresAt ? new Date(d.expiresAt).toLocaleString() : 'Soon'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShareDoc(d)
                      setShowShareModal(true)
                    }}
                    className="rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                  >
                    Extend / Re-grant
                  </button>
                </div>
              ))}
              {documents.filter((d) => d.isExpiringSoon || d.expiresAt).length === 0 && (
                <div className="col-span-2 p-8 text-center bg-white rounded-2xl border border-neutral-200 text-xs text-neutral-400">
                  No grants currently expiring within 30 days.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= TAB: SECURITY EVENTS / AUDIT LOGS ======================= */}
        {activeTab === 'audit' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Cryptographic Audit Ledger</h2>
                <p className="text-xs text-neutral-500">
                  Immutable SHA-256 chained security events for your managed projects and files
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Resource</th>
                    <th className="py-3 px-4">Result</th>
                    <th className="py-3 px-4">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {auditLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-neutral-50 transition">
                      <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                        {new Date(l.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-800">{l.actorEmail}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900">{l.action}</td>
                      <td className="py-3 px-4 text-neutral-600">{l.resourceType}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            l.result === 'SUCCESS' || l.result === 'ALLOWED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {l.result}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-500 line-clamp-1">{l.reason || 'N/A'}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-400">
                        No audit events recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB: MANAGER SETTINGS ======================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl">
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-neutral-900">Manager Profile</h2>
              <p className="text-xs text-neutral-500">
                Your authenticated profile and assigned managerial permissions
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase">Full Name</span>
                  <div className="font-bold text-neutral-900 mt-1">{currentUser?.fullName || 'Manager'}</div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase">Email Address</span>
                  <div className="font-bold text-neutral-900 mt-1">{currentUser?.email || 'N/A'}</div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase">Global Role</span>
                  <div className="font-bold text-neutral-900 mt-1">ROLE_MANAGER</div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase">Account Status</span>
                  <div className="font-bold text-emerald-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" />
                    <span>Active & Verified</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Display Preferences */}
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-neutral-900">Display & Notification Preferences</h2>
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200 cursor-pointer">
                  <div>
                    <span className="font-bold text-neutral-900 block">Interface Theme</span>
                    <span className="text-neutral-500">Professional High-Contrast Light Theme Active</span>
                  </div>
                  <span className="rounded-md bg-amber-400 text-neutral-950 font-bold px-2 py-0.5 text-[10px]">Light Mode</span>
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200 cursor-pointer">
                  <div>
                    <span className="font-bold text-neutral-900 block">Access Request In-App Alerts</span>
                    <span className="text-neutral-500">Notify when workshop members request document access</span>
                  </div>
                  <input type="checkbox" defaultChecked className="size-4 accent-amber-500 rounded" />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200 cursor-pointer">
                  <div>
                    <span className="font-bold text-neutral-900 block">30-Day Expiry Notifications</span>
                    <span className="text-neutral-500">Alert on temporary document permission expiration</span>
                  </div>
                  <input type="checkbox" defaultChecked className="size-4 accent-amber-500 rounded" />
                </label>
              </div>
            </div>

            {/* Security Notice (NO password change action per requirements) */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <ShieldCheck className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">Enterprise Security Policy</strong>
                <p className="mt-0.5 text-neutral-600">
                  Password changes, credential lifecycle, and role provisioning are securely managed by TrustVault Platform Administrators. Managers cannot alter system credentials directly.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* ======================= MODAL: 6-STEP PROJECT WIZARD ======================= */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl border border-neutral-200 shadow-2xl flex flex-col overflow-hidden">
            {/* Wizard Header */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-xl bg-amber-400 text-neutral-950 font-bold">
                  <FolderKanban className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-neutral-900">Create New Project</h3>
                  <p className="text-[11px] text-neutral-500">Guided multi-step project & permission wizard</p>
                </div>
              </div>
              <button
                onClick={() => setShowWizard(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Stepper Indicator */}
            <div className="px-6 py-2.5 border-b border-neutral-200 bg-white flex items-center justify-between overflow-x-auto text-xs font-bold gap-2">
              {[
                { num: 1, label: 'Details' },
                { num: 2, label: 'Members' },
                { num: 3, label: 'Documents' },
                { num: 4, label: 'Permissions' },
                { num: 5, label: 'Duration' },
                { num: 6, label: 'Review' },
              ].map((step) => (
                <div
                  key={step.num}
                  className={`flex items-center gap-2 whitespace-nowrap ${
                    wizardStep === step.num
                      ? 'text-amber-800'
                      : wizardStep > step.num
                      ? 'text-emerald-700'
                      : 'text-neutral-400'
                  }`}
                >
                  <span
                    className={`grid size-5 place-items-center rounded-full text-[10px] font-black ${
                      wizardStep === step.num
                        ? 'bg-amber-400 text-neutral-950'
                        : wizardStep > step.num
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-neutral-100 text-neutral-400'
                    }`}
                  >
                    {wizardStep > step.num ? <Check className="size-3 stroke-[3]" /> : step.num}
                  </span>
                  <span>{step.label}</span>
                  {step.num < 6 && <ChevronRight className="size-3 text-neutral-300 ml-1" />}
                </div>
              ))}
            </div>

            {/* Wizard Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* STEP 1: Project Details */}
              {wizardStep === 1 && (
                <div className="space-y-4 max-w-xl mx-auto">
                  <div>
                    <label className="block text-xs font-bold text-neutral-900 mb-1">
                      Project Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={wizardName}
                      onChange={(e) => setWizardName(e.target.value)}
                      placeholder="e.g. Q4 Security Audit & Migration"
                      className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-900 mb-1">
                      Project Category
                    </label>
                    <select
                      value={wizardCategory}
                      onChange={(e) => setWizardCategory(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-amber-400"
                    >
                      <option value="General">General</option>
                      <option value="College">College</option>
                      <option value="Hospital">Hospital</option>
                      <option value="Business">Business</option>
                      <option value="Financial">Financial</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-900 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={4}
                      value={wizardDesc}
                      onChange={(e) => setWizardDesc(e.target.value)}
                      placeholder="Objectives and scope of this enterprise workspace..."
                      className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs text-neutral-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="pt-2 border-t border-neutral-100">
                    <DurationInput
                      label="Default Document Access Duration"
                      value={wizardDefaultDocumentDuration}
                      onChange={setWizardDefaultDocumentDuration}
                      min={1}
                      max={30}
                      helperText="Project membership duration and document permission duration must remain separate. Creating a project or adding a member must NOT automatically grant access to files."
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Projects are created in <strong>ACTIVE</strong> status under your manager authority.</span>
                  </div>
                </div>
              )}

              {/* STEP 2: Select Existing Members */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-2.5 size-3.5 text-neutral-400" />
                      <input
                        type="text"
                        value={wizardMemberSearch}
                        onChange={(e) => setWizardMemberSearch(e.target.value)}
                        placeholder="Search workshop members..."
                        className="w-full rounded-xl border border-neutral-200 pl-8 pr-3 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={toggleSelectAllFilteredMembers}
                      className="text-xs font-bold text-amber-800 hover:text-amber-900 px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 transition cursor-pointer"
                    >
                      Toggle Select All Filtered ({filteredWizardEligibleMembers.length})
                    </button>
                  </div>

                  {/* Selected Chips */}
                  {wizardSelectedMembers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                      <span className="text-[11px] font-bold text-neutral-500 mr-1">Selected:</span>
                      {wizardSelectedMembers.map((m) => (
                        <span
                          key={m.email}
                          className="inline-flex items-center gap-1 rounded-lg bg-white border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-800 shadow-2xs"
                        >
                          <span>{m.name || m.email}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setWizardSelectedMembers((prev) =>
                                prev.filter((item) => item.email.toLowerCase() !== m.email.toLowerCase())
                              )
                            }
                            className="hover:text-rose-600"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Member Selection List */}
                  <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 max-h-72 overflow-y-auto text-xs">
                    {filteredWizardEligibleMembers.map((m) => {
                      const isSelected = wizardSelectedMembers.some(
                        (sm) => sm.email.toLowerCase() === m.email.toLowerCase()
                      )
                      const currentSelection = wizardSelectedMembers.find(
                        (sm) => sm.email.toLowerCase() === m.email.toLowerCase()
                      )

                      return (
                        <div
                          key={m.id}
                          className={`p-3 flex items-center justify-between hover:bg-neutral-50 transition ${
                            isSelected ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleWizardMember(m)}
                              className="size-4 accent-amber-500 rounded"
                            />
                            <div>
                              <div className="font-bold text-neutral-900">{m.fullName}</div>
                              <div className="text-[11px] text-neutral-500">{m.email}</div>
                            </div>
                          </label>

                          {isSelected && (
                            <select
                              value={currentSelection?.responsibility || 'Contributor'}
                              onChange={(e) => {
                                const newResp = e.target.value
                                setWizardSelectedMembers((prev) =>
                                  prev.map((sm) =>
                                    sm.email.toLowerCase() === m.email.toLowerCase()
                                      ? { ...sm, responsibility: newResp }
                                      : sm
                                  )
                                )
                              }}
                              className="rounded-lg border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-800 focus:outline-none"
                            >
                              <option value="Contributor">Contributor</option>
                              <option value="Reviewer">Reviewer</option>
                              <option value="Lead">Project Lead</option>
                              <option value="Auditor">Auditor</option>
                              <option value="Observer">Observer</option>
                            </select>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: Upload or Select Documents */}
              {wizardStep === 3 && (
                <div className="space-y-6">
                  {/* Option A: Upload Local Documents */}
                  <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileUp className="size-4 text-amber-500" />
                        <h4 className="text-xs font-bold text-neutral-900 uppercase">Option A: Upload Local Documents</h4>
                      </div>
                      <input
                        type="file"
                        multiple
                        id="wizardFileInput"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            const newFiles = Array.from(e.target.files)
                            setWizardUploadedFiles((prev) => [...prev, ...newFiles])
                          }
                        }}
                      />
                      <label
                        htmlFor="wizardFileInput"
                        className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 text-xs font-bold cursor-pointer transition shadow-xs"
                      >
                        Choose Local Files
                      </label>
                    </div>

                    {wizardUploadedFiles.length > 0 && (
                      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 text-xs">
                        {wizardUploadedFiles.map((file, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="size-3.5 text-neutral-400" />
                              <span className="font-semibold text-neutral-800">{file.name}</span>
                              <span className="text-[10px] text-neutral-400">({(file.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setWizardUploadedFiles((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-neutral-400 hover:text-rose-600"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Option B: Select Existing Vault Documents */}
                  <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="size-4 text-amber-500" />
                        <h4 className="text-xs font-bold text-neutral-900 uppercase">Option B: Select Existing Vault Documents</h4>
                      </div>
                      <input
                        type="text"
                        value={wizardExistingDocSearch}
                        onChange={(e) => setWizardExistingDocSearch(e.target.value)}
                        placeholder="Search existing vault docs..."
                        className="rounded-xl border border-neutral-200 px-3 py-1 text-xs text-neutral-900 focus:outline-none"
                      />
                    </div>

                    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 max-h-56 overflow-y-auto text-xs">
                      {documents
                        .filter((d) =>
                          !wizardExistingDocSearch ||
                          d.title.toLowerCase().includes(wizardExistingDocSearch.toLowerCase())
                        )
                        .map((doc) => {
                          const isSelected = wizardSelectedExistingDocIds.includes(doc.id)
                          return (
                            <label
                              key={doc.id}
                              className={`p-2.5 flex items-center justify-between hover:bg-neutral-50 cursor-pointer ${
                                isSelected ? 'bg-amber-50/40' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setWizardSelectedExistingDocIds((prev) =>
                                      isSelected
                                        ? prev.filter((id) => id !== doc.id)
                                        : [...prev, doc.id]
                                    )
                                  }}
                                  className="size-4 accent-amber-500 rounded"
                                />
                                <div>
                                  <div className="font-bold text-neutral-900">{doc.title}</div>
                                  <div className="text-[10px] text-neutral-400">
                                    {doc.originalFilename} • {doc.formattedSize || `${doc.fileSizeBytes} B`}
                                  </div>
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      {documents.length === 0 && (
                        <div className="p-4 text-center text-xs text-neutral-400">
                          No existing documents in vault.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Assign Document Permissions Matrix */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <ShieldCheck className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Per-Document Granular Permissions: </strong>
                      Project membership alone does not grant document access. Explicitly choose presets (Viewer [READ], Reader [READ], Editor [READ+EDIT]) or assign capabilities separately.
                    </span>
                  </div>

                  {wizardAllDocs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-neutral-400 border border-neutral-200 rounded-2xl bg-white">
                      No documents selected. Go back to Step 3 to upload or select files.
                    </div>
                  ) : wizardSelectedMembers.length === 0 ? (
                    <div className="p-8 text-center text-xs text-neutral-400 border border-neutral-200 rounded-2xl bg-white">
                      No members selected. Go back to Step 2 to select team members.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {wizardAllDocs.map((doc) => (
                        <div key={doc.id} className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-100">
                            <div className="flex items-center gap-2">
                              <FileText className="size-4 text-amber-500" />
                              <span className="font-bold text-xs text-neutral-900">{doc.name}</span>
                              {doc.isNewUpload && (
                                <span className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.2 text-[10px] font-bold">
                                  New Upload
                                </span>
                              )}
                            </div>

                            {/* Bulk Apply Preset */}
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-[11px] text-neutral-400">Bulk apply:</span>
                              <button
                                type="button"
                                onClick={() => applyPresetToAllMembersForDoc(doc.id, 'Viewer')}
                                className="px-2 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[10px] font-bold"
                              >
                                All Viewers
                              </button>
                              <button
                                type="button"
                                onClick={() => applyPresetToAllMembersForDoc(doc.id, 'Editor')}
                                className="px-2 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[10px] font-bold"
                              >
                                All Editors
                              </button>
                              <button
                                type="button"
                                onClick={() => applyPresetToAllMembersForDoc(doc.id, 'No access')}
                                className="px-2 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[10px] font-bold"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>

                          {/* Member Perm Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {wizardSelectedMembers.map((m) => {
                              const cell = wizardPermissions[`${doc.id}_${m.email}`]
                              const currentPreset = cell?.preset || 'Viewer'

                              return (
                                <div key={m.email} className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col justify-between gap-2 text-xs">
                                  <div>
                                    <div className="font-bold text-neutral-900">{m.name || m.email}</div>
                                    <div className="text-[10px] text-neutral-400">{m.email}</div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <select
                                      value={currentPreset}
                                      onChange={(e) =>
                                        updateWizardPermissionCell(
                                          doc.id,
                                          m.email,
                                          e.target.value as any
                                        )
                                      }
                                      className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-800 focus:outline-none"
                                    >
                                      <option value="Viewer">Viewer (READ)</option>
                                      <option value="Reader">Reader (READ)</option>
                                      <option value="Editor">Editor (READ+EDIT)</option>
                                      <option value="No access">No Access</option>
                                    </select>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: Access Duration */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <Clock className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Set access expiration for each granted document. Expired permissions are denied immediately by server authorization checks.
                    </span>
                  </div>

                  <div className="space-y-3">
                    {wizardAllDocs.map((doc) => (
                      <div key={doc.id} className="p-4 rounded-2xl bg-white border border-neutral-200 space-y-3">
                        <div className="font-bold text-xs text-neutral-900 flex items-center gap-2">
                          <FileText className="size-4 text-amber-500" />
                          <span>{doc.name}</span>
                        </div>

                        <div className="divide-y divide-neutral-100">
                          {wizardSelectedMembers.map((m) => {
                            const cell = wizardPermissions[`${doc.id}_${m.email}`]
                            if (cell?.preset === 'No access') return null

                            const expiryVal = cell?.expiresAt
                              ? cell.expiresAt.substring(0, 16)
                              : new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 16)

                            return (
                              <div key={m.email} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div>
                                  <span className="font-bold text-neutral-900">{m.name || m.email}</span>
                                  <span className="ml-2 rounded bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[10px] font-bold">
                                    {cell?.permissionLevel || 'READ'}
                                  </span>
                                </div>

                                <div>
                                  <DurationInput
                                    value={cell?.durationDays || wizardDefaultDocumentDuration}
                                    onChange={(newDays) => {
                                      const iso = new Date(Date.now() + newDays * 86400000).toISOString()
                                      setWizardPermissions((prev) => ({
                                        ...prev,
                                        [`${doc.id}_${m.email}`]: {
                                          ...prev[`${doc.id}_${m.email}`],
                                          durationDays: newDays,
                                          expiresAt: iso,
                                        },
                                      }))
                                    }}
                                    min={1}
                                    max={30}
                                    showExpiry={true}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 6: Final Review */}
              {wizardStep === 6 && (
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3 text-xs">
                    <h4 className="font-bold text-neutral-900 uppercase text-[11px]">Project Details Summary</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-neutral-400">Name:</span>{' '}
                        <strong className="text-neutral-900">{wizardName}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-400">Category:</span>{' '}
                        <strong className="text-neutral-900">{wizardCategory}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-neutral-400">Description:</span>{' '}
                        <span className="text-neutral-700">{wizardDesc || 'None'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-neutral-200 space-y-2 text-xs">
                    <h4 className="font-bold text-neutral-900 uppercase text-[11px]">
                      Selected Team Members ({wizardSelectedMembers.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {wizardSelectedMembers.map((m) => (
                        <span key={m.email} className="rounded-lg bg-neutral-100 px-2 py-1 text-xs text-neutral-800 font-medium">
                          {m.name || m.email} ({m.responsibility})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-neutral-200 space-y-2 text-xs">
                    <h4 className="font-bold text-neutral-900 uppercase text-[11px]">
                      Attached Documents ({wizardAllDocs.length})
                    </h4>
                    <div className="divide-y divide-neutral-100">
                      {wizardAllDocs.map((doc) => (
                        <div key={doc.id} className="py-2 flex items-center justify-between">
                          <span className="font-bold text-neutral-800">{doc.name}</span>
                          <span className="text-[10px] text-neutral-400">
                            {doc.isNewUpload ? 'Local Upload' : 'Vault Document'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer Controls */}
            <div className="px-6 py-4 border-t border-neutral-200 bg-white flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (wizardStep === 1) setShowWizard(false)
                  else setWizardStep((s) => s - 1)
                }}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>{wizardStep === 1 ? 'Cancel' : 'Back'}</span>
              </button>

              <div className="flex items-center gap-2">
                {wizardStep < 6 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1 && !wizardName.trim()) {
                        showToast('Project name is required', 'error')
                        return
                      }
                      setWizardStep((s) => s + 1)
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 px-4 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <span>Continue</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submittingWizard}
                    onClick={handleCreateProjectSubmit}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 px-5 py-2 text-xs font-extrabold transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {submittingWizard && <RefreshCw className="size-3.5 animate-spin" />}
                    <span>Confirm & Create Project</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: PROJECT DETAIL (6 TABS) ======================= */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl border border-neutral-200 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-amber-400 text-neutral-950 font-bold">
                  <FolderKanban className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-neutral-900">{selectedProject.name}</h3>
                    <span className="rounded bg-neutral-200 px-1.5 py-0.2 text-[10px] font-bold text-neutral-700">
                      {selectedProject.category || 'General'}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                        (selectedProject.status || 'ACTIVE') === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {selectedProject.status || 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{selectedProject.description || 'No description'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 6 Tabs Sub-Navigation */}
            <div className="px-6 border-b border-neutral-200 flex items-center gap-1 overflow-x-auto text-xs font-bold">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'members', label: 'Members', count: selectedProjectMembers.length },
                { id: 'documents', label: 'Documents', count: selectedProjectDocs.length },
                { id: 'permissions', label: 'Permissions' },
                { id: 'requests', label: 'Access Requests' },
                { id: 'audit', label: 'Audit Logs' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setProjectDetailTab(tab.id as any)}
                  className={`py-3 px-3.5 border-b-2 font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    projectDetailTab === tab.id
                      ? 'border-amber-500 text-neutral-950 bg-amber-50/30'
                      : 'border-transparent text-neutral-400 hover:text-neutral-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="rounded-full bg-neutral-100 px-1.5 py-0.2 text-[10px]">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* TAB A: Overview */}
              {projectDetailTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">Members</span>
                      <div className="text-xl font-black text-neutral-900 mt-1">{selectedProjectMembers.length}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">Documents</span>
                      <div className="text-xl font-black text-neutral-900 mt-1">{selectedProjectDocs.length}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">Created Date</span>
                      <div className="font-bold text-neutral-900 mt-1">
                        {new Date(selectedProject.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">Status</span>
                      <div className="font-bold text-emerald-700 mt-1">{selectedProject.status || 'ACTIVE'}</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <strong className="font-bold block">Managerial Zero-Trust Scope</strong>
                    <p>
                      You can manage members, suspend/reactivate project access, upload project files, and assign individual capabilities without recreating the project.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB B: Members */}
              {projectDetailTab === 'members' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-900 uppercase">Project Team Members</h4>
                    <button
                      onClick={() => setShowAddMemberModal(true)}
                      className="flex items-center gap-1 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                    >
                      <UserPlus className="size-3.5" />
                      <span>Add Member</span>
                    </button>
                  </div>

                  <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 text-xs bg-white overflow-hidden">
                    {selectedProjectMembers.map((m) => (
                      <div key={m.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50 transition">
                        <div>
                          <div className="font-bold text-neutral-900">{m.fullName || m.userEmail}</div>
                          <div className="text-[11px] text-neutral-400">{m.userEmail}</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            Role: {m.responsibility} • Added: {new Date(m.addedAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              (m.status || 'ACTIVE') === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {m.status || 'ACTIVE'}
                          </span>

                          {(m.status || 'ACTIVE') === 'ACTIVE' ? (
                            <button
                              onClick={() => handleSuspendMember(m)}
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-bold transition cursor-pointer"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateMember(m)}
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition cursor-pointer"
                            >
                              Reactivate
                            </button>
                          )}

                          <button
                            onClick={() => handleRemoveMember(m)}
                            className="p-1 text-neutral-400 hover:text-rose-600 rounded transition"
                            title="Remove Member"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {selectedProjectMembers.length === 0 && (
                      <div className="p-6 text-center text-neutral-400">No members in this project.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB C: Documents */}
              {projectDetailTab === 'documents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-900 uppercase">Project Documents</h4>
                    <button
                      onClick={() => setShowDocUploadModal(true)}
                      className="flex items-center gap-1 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                    >
                      <FileUp className="size-3.5" />
                      <span>Upload Document</span>
                    </button>
                  </div>

                  <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 text-xs bg-white overflow-hidden">
                    {selectedProjectDocs.map((doc) => (
                      <div key={doc.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50 transition">
                        <div>
                          <div className="font-bold text-neutral-900">{doc.title}</div>
                          <div className="text-[10px] text-neutral-400">
                            {doc.originalFilename} • {doc.formattedSize || `${doc.fileSizeBytes} B`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePreviewDoc(doc)}
                            className="px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition cursor-pointer"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => {
                              setShareDoc(doc)
                              setShowShareModal(true)
                            }}
                            className="px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition cursor-pointer"
                          >
                            Share
                          </button>
                          <button
                            onClick={() => handleDownloadDoc(doc)}
                            className="px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition cursor-pointer"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                    {selectedProjectDocs.length === 0 && (
                      <div className="p-6 text-center text-neutral-400">No documents attached to this project.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB D: Permissions */}
              {projectDetailTab === 'permissions' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-neutral-900 uppercase">Permissions Matrix</h4>
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600">
                    Managers can directly grant, adjust between Viewer/Reader and Editor, or revoke file-level permissions without recreating the project.
                  </div>

                  <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 text-xs bg-white overflow-hidden">
                    {selectedProjectDocs.map((doc) => (
                      <div key={doc.id} className="p-4 space-y-2">
                        <div className="font-bold text-neutral-900 flex items-center gap-2">
                          <FileText className="size-3.5 text-amber-500" />
                          <span>{doc.title}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                          {selectedProjectMembers.map((m) => (
                            <div key={m.id} className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                              <span className="font-medium text-neutral-800">{m.fullName || m.userEmail}</span>
                              <button
                                onClick={() => {
                                  setShareDoc(doc)
                                  setShowShareModal(true)
                                }}
                                className="text-[11px] font-bold text-amber-800 hover:underline"
                              >
                                Configure
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {selectedProjectDocs.length === 0 && (
                      <div className="p-6 text-center text-neutral-400">No documents in project to configure.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB E: Access Requests */}
              {projectDetailTab === 'requests' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-900 uppercase">Requests for this Project</h4>
                  <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 text-xs bg-white overflow-hidden">
                    {accessRequests
                      .filter((r) =>
                        selectedProjectDocs.some((d) => d.id === r.documentId || d.title === r.documentTitle)
                      )
                      .map((r) => (
                        <div key={r.id} className="p-3.5 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-neutral-900">{r.documentTitle}</div>
                            <div className="text-[11px] text-neutral-500">
                              By {r.requesterEmail} • {r.requestedPermission}
                            </div>
                          </div>
                          {r.status === 'PENDING' && (
                            <button
                              onClick={() => {
                                setSelectedReq(r)
                                setReviewGrantLevel((r.requestedPermission as any) === 'EDIT' ? 'EDIT' : 'READ')
                                setShowReviewModal(true)
                              }}
                              className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold text-xs"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      ))}
                    {accessRequests.filter((r) =>
                      selectedProjectDocs.some((d) => d.id === r.documentId || d.title === r.documentTitle)
                    ).length === 0 && (
                      <div className="p-6 text-center text-neutral-400">No access requests for this project.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB F: Audit Logs */}
              {projectDetailTab === 'audit' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-900 uppercase">Project Audit History</h4>
                  <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 text-xs bg-white overflow-hidden">
                    {auditLogs
                      .filter((l) => l.resourceId === selectedProject.id || selectedProjectDocs.some((d) => d.id === l.resourceId))
                      .map((l) => (
                        <div key={l.id} className="p-3 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-neutral-900">{l.action}</span>
                            <span className="text-[11px] text-neutral-400 ml-2">by {l.actorEmail}</span>
                            <div className="text-[10px] text-neutral-500 mt-0.5">{l.reason || 'N/A'}</div>
                          </div>
                          <span className="text-[10px] text-neutral-400">{new Date(l.timestamp).toLocaleString()}</span>
                        </div>
                      ))}
                    {auditLogs.filter((l) => l.resourceId === selectedProject.id || selectedProjectDocs.some((d) => d.id === l.resourceId)).length === 0 && (
                      <div className="p-6 text-center text-neutral-400">No audit events recorded for this project yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: ADD MEMBER TO EXISTING PROJECT ======================= */}
      {showAddMemberModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-extrabold text-neutral-900">Add Member to Project</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddMemberToProject} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Select Workshop Member *</label>
                <select
                  required
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900 focus:outline-none"
                >
                  <option value="">Choose an eligible member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.email}>
                      {m.fullName} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Project Responsibility</label>
                <select
                  value={addMemberResp}
                  onChange={(e) => setAddMemberResp(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900 focus:outline-none"
                >
                  <option value="Contributor">Contributor</option>
                  <option value="Reviewer">Reviewer</option>
                  <option value="Lead">Project Lead</option>
                  <option value="Auditor">Auditor</option>
                  <option value="Observer">Observer</option>
                </select>
              </div>

              {/* Document Permission Grant Options */}
              {selectedProjectDocs.length > 0 && (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-neutral-900">Document Permissions for New Member</label>
                  <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 max-h-36 overflow-y-auto text-xs">
                    {selectedProjectDocs.map((doc) => (
                      <div key={doc.id} className="p-2 flex items-center justify-between">
                        <span className="font-medium text-neutral-800 line-clamp-1 flex-1">{doc.title}</span>
                        <select
                          value={addMemberDocPerms[doc.id] || 'NONE'}
                          onChange={(e) =>
                            setAddMemberDocPerms((prev) => ({
                              ...prev,
                              [doc.id]: e.target.value as any,
                            }))
                          }
                          className="rounded border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-700"
                        >
                          <option value="NONE">No Access</option>
                          <option value="READ">Viewer (READ)</option>
                          <option value="EDIT">Editor (READ+EDIT)</option>
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-neutral-100">
                    <DurationInput
                      label="Document Access Duration"
                      value={addMemberDuration}
                      onChange={setAddMemberDuration}
                      min={1}
                      max={30}
                      helperText="If only adding a project member without document access, no document permissions will be created implicitly. Project membership and file permissions remain separate records."
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAddMember}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingAddMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: SHARE DOCUMENT ======================= */}
      {showShareModal && shareDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-neutral-900">Secure Document Sharing</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{shareDoc.title}</p>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-neutral-900">
                Select Recipients & Grant Capabilities
              </label>

              <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 max-h-56 overflow-y-auto text-xs">
                {members.map((m) => {
                  const existingAssignment = shareRecipients.find((r) => r.email === m.email)
                  const isChecked = !!existingAssignment

                  return (
                    <div key={m.id} className="p-2.5 flex items-center justify-between hover:bg-neutral-50">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setShareRecipients((prev) => [
                                ...prev,
                                { email: m.email, permissionLevel: 'READ' },
                              ])
                            } else {
                              setShareRecipients((prev) => prev.filter((r) => r.email !== m.email))
                            }
                          }}
                          className="size-4 accent-amber-500 rounded"
                        />
                        <span className="font-semibold text-neutral-900">{m.fullName || m.email}</span>
                      </label>

                      {isChecked && (
                        <select
                          value={existingAssignment?.permissionLevel || 'READ'}
                          onChange={(e) => {
                            const newLevel = e.target.value as any
                            setShareRecipients((prev) =>
                              prev.map((r) => (r.email === m.email ? { ...r, permissionLevel: newLevel } : r))
                            )
                          }}
                          className="rounded border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700"
                        >
                          <option value="READ">READ (Viewer/Reader)</option>
                          <option value="EDIT">EDIT (Editor)</option>
                          <option value="DOWNLOAD">DOWNLOAD</option>
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <DurationInput
                  label="Document Access Duration"
                  value={shareDuration}
                  onChange={setShareDuration}
                  min={1}
                  max={30}
                  helperText="Start the expiry period from the actual successful permission-grant time."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingShare || shareRecipients.length === 0}
                  onClick={async () => {
                    setSubmittingShare(true)
                    try {
                      const projId = shareDoc.projectId || selectedProject?.id
                      if (projId) {
                        const expiryIso = new Date(Date.now() + shareDuration * 86400000).toISOString()
                        await api.shareProjectDocument(
                          projId,
                          shareDoc.id,
                          shareRecipients.map((r) => ({
                            userEmail: r.email,
                            permissionLevel: r.permissionLevel,
                            durationDays: shareDuration,
                            expiresAt: expiryIso,
                          }))
                        )
                      }
                      showToast(`Shared "${shareDoc.title}" with ${shareRecipients.length} user(s)`, 'success')
                      setShowShareModal(false)
                      setShareRecipients([])
                      await loadDashboardData()
                    } catch (err: any) {
                      showToast(err.message || 'Failed to share document', 'error')
                    } finally {
                      setSubmittingShare(false)
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingShare ? 'Sharing...' : 'Confirm Share'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: DOCUMENT PREVIEW ======================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[85vh] bg-white rounded-3xl border border-neutral-200 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <FileText className="size-4.5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-extrabold text-neutral-900">{previewDoc.title}</h3>
                  <p className="text-[10px] text-neutral-400">{previewDoc.originalFilename}</p>
                </div>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingPreview ? (
                <div className="py-12 text-center text-xs text-neutral-400">Loading secure preview...</div>
              ) : previewData?.textContent ? (
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 font-mono text-xs whitespace-pre-wrap text-neutral-800 max-h-96 overflow-y-auto">
                  {previewData.textContent}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-neutral-500 border border-neutral-200 rounded-xl bg-neutral-50 space-y-2">
                  <ShieldCheck className="size-8 text-amber-500 mx-auto" />
                  <div className="font-bold text-neutral-800">Secure Document Preview</div>
                  <p className="text-neutral-500">
                    File: <strong>{previewDoc.originalFilename}</strong> ({previewDoc.contentType})
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    Zero-Trust read-only preview mechanism. Original file download is restricted.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-neutral-200 bg-white flex justify-between items-center text-xs">
              <span className="text-[11px] text-neutral-500">
                Access Level: <strong>{previewData?.userAccessLevel || previewDoc.userAccessLevel || 'MANAGER'}</strong>
              </span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: REVIEW ACCESS REQUEST ======================= */}
      {showReviewModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-neutral-900">Review Access Request</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{selectedReq.documentTitle}</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
                <div>
                  <span className="text-neutral-400">Requester:</span>{' '}
                  <strong className="text-neutral-900">{selectedReq.requesterEmail}</strong>
                </div>
                <div>
                  <span className="text-neutral-400">Requested:</span>{' '}
                  <strong className="text-amber-800">{selectedReq.requestedPermission || 'READ'}</strong>
                </div>
                <div>
                  <span className="text-neutral-400">Reason:</span>{' '}
                  <span className="text-neutral-700">{selectedReq.reason || 'None'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Grant Capability</label>
                <select
                  value={reviewGrantLevel}
                  onChange={(e) => setReviewGrantLevel(e.target.value as any)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-800"
                >
                  <option value="READ">Viewer / Reader (READ Only)</option>
                  <option value="EDIT">Editor (READ + EDIT)</option>
                </select>
              </div>

              <div>
                <DurationInput
                  label="Access Duration (Days)"
                  value={reviewDurationDays}
                  onChange={setReviewDurationDays}
                  min={1}
                  max={30}
                  helperText="Expiry period starts from the actual successful permission-grant time."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Reviewer Notes (Optional)</label>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Approved for sprint audit"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs text-neutral-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={() => handleReviewAccessSubmit(false)}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={() => handleReviewAccessSubmit(true)}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 text-xs font-bold shadow-xs cursor-pointer"
                >
                  Approve & Grant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: REVIEW RENEWAL REQUEST ======================= */}
      {showReviewRenewalModal && selectedRenewal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-neutral-900">Review Permission Renewal</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{selectedRenewal.documentTitle}</p>
              </div>
              <button onClick={() => setShowReviewRenewalModal(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
                <div>
                  <span className="text-neutral-400">Requester:</span>{' '}
                  <strong className="text-neutral-900">{selectedRenewal.requesterEmail}</strong>
                </div>
                <div>
                  <span className="text-neutral-400">Current Expiry:</span>{' '}
                  <strong className="text-neutral-700">
                    {selectedRenewal.currentExpiresAt
                      ? new Date(selectedRenewal.currentExpiresAt).toLocaleDateString()
                      : 'Not configured'}
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-400">Requested Extension:</span>{' '}
                  <strong className="text-amber-800">+{selectedRenewal.requestedExtensionDays} Days</strong>
                </div>
                <div>
                  <span className="text-neutral-400">Reason:</span>{' '}
                  <span className="text-neutral-700">{selectedRenewal.reason || 'None'}</span>
                </div>
              </div>

              <div>
                <DurationInput
                  label="Extension Duration (Days)"
                  value={renewalExtensionDays}
                  onChange={setRenewalExtensionDays}
                  min={1}
                  max={30}
                  helperText="Start the expiry period from the actual successful permission-grant time."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Reviewer Notes (Optional)</label>
                <input
                  type="text"
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
                  placeholder="e.g. Approved extension for project audit"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs text-neutral-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  disabled={submittingRenewalReview}
                  onClick={() => handleReviewRenewalSubmit(false)}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={submittingRenewalReview}
                  onClick={() => handleReviewRenewalSubmit(true)}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 text-xs font-bold shadow-xs cursor-pointer"
                >
                  {submittingRenewalReview ? 'Approving...' : 'Approve & Extend'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: CONFIRM DESTRUCTIVE ACTION ======================= */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">{confirmModal.title}</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingConfirm}
                onClick={async () => {
                  setSubmittingConfirm(true)
                  try {
                    await confirmModal.onConfirm()
                    setConfirmModal(null)
                  } finally {
                    setSubmittingConfirm(false)
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  confirmModal.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-amber-400 hover:bg-amber-500 text-neutral-950'
                }`}
              >
                {submittingConfirm ? 'Processing...' : confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: UPLOAD DOCUMENT ======================= */}
      {showDocUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-extrabold text-neutral-900">Upload Vault Document</h3>
              <button onClick={() => setShowDocUploadModal(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!uploadFile) return
                setUploadingDoc(true)
                try {
                  const formData = new FormData()
                  formData.append('file', uploadFile)
                  formData.append('title', uploadTitle || uploadFile.name)
                  formData.append('category', uploadCategory)
                  if (selectedProject) {
                    formData.append('projectId', selectedProject.id)
                  }
                  await api.uploadDocument(formData)
                  showToast('Document uploaded successfully', 'success')
                  setShowDocUploadModal(false)
                  setUploadFile(null)
                  setUploadTitle('')
                  await loadDashboardData()
                } catch (err: any) {
                  showToast(err.message || 'Failed to upload document', 'error')
                } finally {
                  setUploadingDoc(false)
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-neutral-900 mb-1">Document File *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setUploadFile(e.target.files[0])
                      if (!uploadTitle) setUploadTitle(e.target.files[0].name)
                    }
                  }}
                  className="w-full text-xs text-neutral-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-400 file:text-neutral-950 hover:file:bg-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-900 mb-1">Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Q4 Compliance Report.pdf"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-900 mb-1">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700"
                >
                  <option value="General">General</option>
                  <option value="Financial">Financial</option>
                  <option value="Security">Security</option>
                  <option value="Legal">Legal</option>
                  <option value="Technical">Technical</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDocUploadModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingDoc || !uploadFile}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-950 text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {uploadingDoc ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
