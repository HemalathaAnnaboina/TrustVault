'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
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
  ExternalLink,
  Eye,
  EyeOff,
  File,
  FileCheck2,
  FileText,
  Filter,
  FolderKanban,
  FolderPlus,
  Globe,
  HelpCircle,
  History,
  Home as HomeIcon,
  Info,
  Key,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LockKeyhole,
  LogOut,
  Mail,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  UserX,
  X,
} from 'lucide-react'
import {
  api,
  AuditLogItem,
  AuditVerificationResult,
  DocumentItem,
  EmployeeDirectoryItem,
  GroupItem,
  PermissionItem,
  ProjectItem,
  ProjectMemberItem,
  AccessRequestItem,
  RenewalRequestItem,
  RoleStats,
  UserManagementItem,
  UserProfile,
  getToken,
  getUser,
  logout,
} from '../../lib/api'

type Role = 'OWNER' | 'ADMIN' | 'VIEWER'

const navConfig = {
  OWNER: [
    ['Overview', HomeIcon],
    ['Projects', FolderKanban],
    ['Employees & Groups', Users],
    ['Documents', FileText],
    ['Access & Permissions', LockKeyhole],
    ['Access Requests', FileCheck2],
    ['Audit Logs', Activity],
    ['Settings', Settings2],
  ],
  ADMIN: [
    ['Dashboard', LayoutDashboard],
    ['Users', Users],
    ['All Documents', FileText],
    ['Access Requests', FileCheck2],
    ['Audit Logs', Activity],
    ['Settings', Settings2],
  ],
  VIEWER: [
    ['Overview', HomeIcon],
    ['Shared With Me', FileText],
    ['Search', Search],
    ['My Requests', FileCheck2],
    ['Settings', Settings2],
  ],
} as const

interface VaultDashboardProps {
  enforcedRole: Role
}

export default function VaultDashboard({ enforcedRole }: VaultDashboardProps) {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [activeNav, setActiveNav] = useState('Overview')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [loading, setLoading] = useState(false)

  // Real backend data states
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([])
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([])
  const [renewals, setRenewals] = useState<RenewalRequestItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [adminUsers, setAdminUsers] = useState<UserManagementItem[]>([])
  const [statsData, setStatsData] = useState<RoleStats | null>(null)
  const [integrityStatus, setIntegrityStatus] = useState<AuditVerificationResult | null>(null)
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false)

  // Sub-navigation & filter states
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [projectFilter, setProjectFilter] = useState('All')
  const [empGroupTab, setEmpGroupTab] = useState<'employees' | 'groups'>('employees')
  const [requestTab, setRequestTab] = useState<'access' | 'renewals'>('access')
  const [auditActionFilter, setAuditActionFilter] = useState('All')
  const [auditResultFilter, setAuditResultFilter] = useState('All')
  const [auditSearch, setAuditSearch] = useState('')

  // Modals & Drawers
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [showUpdatePermModal, setShowUpdatePermModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [showReviewAccessModal, setShowReviewAccessModal] = useState(false)
  const [showReviewRenewalModal, setShowReviewRenewalModal] = useState(false)
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false)
  const [showProjectDetailModal, setShowProjectDetailModal] = useState(false)
  const [showRequestAccessModal, setShowRequestAccessModal] = useState(false)
  const [showRequestRenewalModal, setShowRequestRenewalModal] = useState(false)

  // Selected entities for actions
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null)
  const [projectMembers, setProjectMembers] = useState<ProjectMemberItem[]>([])
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null)
  const [selectedPerm, setSelectedPerm] = useState<PermissionItem | null>(null)
  const [selectedAccessReq, setSelectedAccessReq] = useState<AccessRequestItem | null>(null)
  const [selectedRenewalReq, setSelectedRenewalReq] = useState<RenewalRequestItem | null>(null)
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogItem | null>(null)
  const [projectDetailTab, setProjectDetailTab] = useState<'overview' | 'members' | 'files' | 'permissions' | 'activity'>('overview')

  // Form states - Create Project
  const [newProjName, setNewProjName] = useState('')
  const [newProjDesc, setNewProjDesc] = useState('')
  const [newProjCategory, setNewProjCategory] = useState('Core Operations')
  const [newProjGroupId, setNewProjGroupId] = useState('')
  const [newProjSelectedMembers, setNewProjSelectedMembers] = useState<{ email: string; responsibility: string }[]>([])
  const [projCreateStep, setProjCreateStep] = useState<'details' | 'members' | 'review'>('details')

  // Form states - Add Project Member
  const [addMemberEmail, setAddMemberEmail] = useState('')
  const [addMemberResp, setAddMemberResp] = useState('Project Contributor')

  // Form states - Upload Document
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('Contracts')
  const [uploadProjectId, setUploadProjectId] = useState('')
  const [uploadRecipientEmail, setUploadRecipientEmail] = useState('')
  const [uploadRecipientPerm, setUploadRecipientPerm] = useState<'READ' | 'EDIT'>('READ')
  const [uploadRecipientExpiry, setUploadRecipientExpiry] = useState('30')

  // Form states - Grant Permission
  const [grantDocId, setGrantDocId] = useState('')
  const [grantUserEmail, setGrantUserEmail] = useState('')
  const [grantPermLevel, setGrantPermLevel] = useState<'READ' | 'EDIT'>('READ')
  const [grantExpiryDays, setGrantExpiryDays] = useState('30')

  // Form states - Update Permission
  const [updatePermLevel, setUpdatePermLevel] = useState<'READ' | 'EDIT'>('READ')
  const [updatePermExpiry, setUpdatePermExpiry] = useState('')

  // Form states - Review Request
  const [reviewNote, setReviewNote] = useState('')
  const [reviewExpiryDays, setReviewExpiryDays] = useState('30')

  // Form states - Invite Employee
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFullName, setInviteFullName] = useState('')
  const [invitePassword, setInvitePassword] = useState('Welcome@TrustVault2025!')
  const [inviteRole, setInviteRole] = useState<'ROLE_VIEWER' | 'ROLE_OWNER'>('ROLE_VIEWER')

  // Form states - Create Group
  const [groupName, setGroupName] = useState('')
  const [groupDept, setGroupDept] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [groupMemberEmails, setGroupMemberEmails] = useState('')

  // Form states - Settings: Password Change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Form states - Settings: Theme & Notifications
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light')
  const [notifyAccessRequests, setNotifyAccessRequests] = useState(true)
  const [notifyExpiryWarnings, setNotifyExpiryWarnings] = useState(true)
  const [notifySecurityAlerts, setNotifySecurityAlerts] = useState(true)

  // Viewer request forms
  const [reqAccessDocId, setReqAccessDocId] = useState('')
  const [reqAccessLevel, setReqAccessLevel] = useState<'READ' | 'EDIT'>('READ')
  const [reqAccessReason, setReqAccessReason] = useState('')
  const [reqRenewalPermId, setReqRenewalPermId] = useState('')
  const [reqRenewalReason, setReqRenewalReason] = useState('')
  const [reqRenewalDays, setReqRenewalDays] = useState('30')

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4500)
  }

  // Load user profile & verify authorization
  useEffect(() => {
    const token = getToken()
    const user = getUser()
    if (!token || !user) {
      router.replace('/login')
      return
    }

    if (enforcedRole === 'ADMIN' && user.role !== 'ROLE_ADMIN') {
      router.replace(user.role === 'ROLE_OWNER' ? '/owner/dashboard' : '/viewer/dashboard')
      return
    }
    if (enforcedRole === 'OWNER' && user.role !== 'ROLE_OWNER') {
      router.replace(user.role === 'ROLE_ADMIN' ? '/admin/dashboard' : '/viewer/dashboard')
      return
    }
    if (enforcedRole === 'VIEWER' && user.role !== 'ROLE_VIEWER') {
      router.replace(user.role === 'ROLE_ADMIN' ? '/admin/dashboard' : '/owner/dashboard')
      return
    }

    setCurrentUser(user)

    // Load saved settings
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('tv_theme') as any
      if (savedTheme) setThemeMode(savedTheme)
      const savedNotify1 = localStorage.getItem('tv_notify_access')
      if (savedNotify1 !== null) setNotifyAccessRequests(savedNotify1 === 'true')
      const savedNotify2 = localStorage.getItem('tv_notify_expiry')
      if (savedNotify2 !== null) setNotifyExpiryWarnings(savedNotify2 === 'true')
      const savedNotify3 = localStorage.getItem('tv_notify_sec')
      if (savedNotify3 !== null) setNotifySecurityAlerts(savedNotify3 === 'true')
    }

    loadAllData()
  }, [enforcedRole, router])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const promises: Promise<any>[] = [
        api.getDocuments().then(setDocuments).catch(() => {}),
        api.getStats().then(setStatsData).catch(() => {}),
      ]

      if (enforcedRole === 'OWNER') {
        promises.push(api.getProjects().then(setProjects).catch(() => {}))
        promises.push(api.getEmployees().then(setEmployees).catch(() => {}))
        promises.push(api.getGroups().then(setGroups).catch(() => {}))
        promises.push(api.getOwnerPermissions().then(setPermissions).catch(() => {}))
        promises.push(api.getOwnerAccessRequests().then(setAccessRequests).catch(() => {}))
        promises.push(api.getOwnerRenewals().then(setRenewals).catch(() => {}))
        promises.push(api.getAuditLogs({ size: 100 }).then(setAuditLogs).catch(() => {}))
      } else if (enforcedRole === 'ADMIN') {
        promises.push(api.getAdminUsers().then(setAdminUsers).catch(() => {}))
        promises.push(api.getOwnerAccessRequests().then(setAccessRequests).catch(() => {}))
        promises.push(api.getAuditLogs({ size: 100 }).then(setAuditLogs).catch(() => {}))
      } else if (enforcedRole === 'VIEWER') {
        promises.push(api.getMyPermissions().then(setPermissions).catch(() => {}))
        promises.push(api.getMyAccessRequests().then(setAccessRequests).catch(() => {}))
        promises.push(api.getMyRenewals().then(setRenewals).catch(() => {}))
      }

      await Promise.all(promises)
    } catch (err: any) {
      console.error('Data load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Refresh single project members
  const loadProjectMembers = async (projectId: string) => {
    try {
      const members = await api.getProjectMembers(projectId)
      setProjectMembers(members)
    } catch (err) {
      console.error('Failed to load project members', err)
    }
  }

  // Theme changer
  const handleThemeChange = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('tv_theme', mode)
      if (mode === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
    showToast(`Theme updated to ${mode}`, 'success')
  }

  // Verify hash chain
  const handleVerifyIntegrity = async () => {
    setVerifyingIntegrity(true)
    try {
      const res = await api.verifyAuditIntegrity()
      setIntegrityStatus(res)
      if (res.valid) {
        showToast(`Hash chain verified! ${res.verifiedCount} records intact.`, 'success')
      } else {
        showToast(`Integrity warning: Record ${res.brokenRecordId} failed validation.`, 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Verification failed', 'error')
    } finally {
      setVerifyingIntegrity(false)
    }
  }

  // Download document via single-use token
  const handleDownloadDocument = async (doc: DocumentItem) => {
    try {
      showToast('Generating secure single-use download token...', 'info')
      const tokenRes = await api.getDownloadToken(doc.id)
      const downloadUrl = api.getDownloadUrl(tokenRes.token)

      // Trigger download
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = doc.originalFilename || doc.title
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      showToast(`Download started for "${doc.title}". Token invalidated upon use.`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Download failed or access expired', 'error')
    }
  }

  // Project Creation Submit
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjName.trim()) {
      showToast('Project name is required', 'error')
      return
    }

    setLoading(true)
    try {
      const project = await api.createProject({
        name: newProjName.trim(),
        description: newProjDesc.trim(),
        category: newProjCategory,
        groupId: newProjGroupId || undefined,
      })

      // Add selected members if any
      for (const m of newProjSelectedMembers) {
        try {
          await api.addProjectMember(project.id, m.email, m.responsibility)
        } catch (memberErr) {
          console.warn(`Failed to add ${m.email} to project`, memberErr)
        }
      }

      showToast(`Project "${project.name}" created successfully with ${newProjSelectedMembers.length} team members.`, 'success')
      setShowCreateProjectModal(false)
      setNewProjName('')
      setNewProjDesc('')
      setNewProjSelectedMembers([])
      setProjCreateStep('details')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to create project', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Add Member to Selected Project
  const handleAddProjectMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject || !addMemberEmail.trim()) return

    setLoading(true)
    try {
      await api.addProjectMember(selectedProject.id, addMemberEmail.trim(), addMemberResp)
      showToast(`Added ${addMemberEmail} as ${addMemberResp}`, 'success')
      setAddMemberEmail('')
      loadProjectMembers(selectedProject.id)
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to add project member', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Remove Project Member
  const handleRemoveProjectMember = async (memberId: string, email: string) => {
    if (!selectedProject) return
    if (!confirm(`Remove ${email} from this project?`)) return

    setLoading(true)
    try {
      await api.removeProjectMember(selectedProject.id, memberId)
      showToast(`Removed ${email} from project`, 'success')
      loadProjectMembers(selectedProject.id)
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Delete Project
  const handleDeleteProject = async (projectId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete project "${name}"? Associated documents will be unlinked.`)) return

    setLoading(true)
    try {
      await api.deleteProject(projectId)
      showToast(`Project "${name}" deleted`, 'success')
      if (selectedProject?.id === projectId) {
        setShowProjectDetailModal(false)
        setSelectedProject(null)
      }
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete project', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Upload Document Submit
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) {
      showToast('Please select a file to upload', 'error')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      if (uploadTitle.trim()) formData.append('title', uploadTitle.trim())
      if (uploadCategory.trim()) formData.append('category', uploadCategory.trim())
      if (uploadProjectId.trim()) formData.append('projectId', uploadProjectId.trim())

      const newDoc = await api.uploadDocument(formData)

      // Initial permission assignment if configured
      if (uploadRecipientEmail.trim()) {
        const expiresAt = uploadRecipientExpiry === 'never'
          ? null
          : new Date(Date.now() + parseInt(uploadRecipientExpiry, 10) * 86400000).toISOString()
        try {
          await api.grantPermission(newDoc.id, {
            userEmail: uploadRecipientEmail.trim(),
            permissionLevel: uploadRecipientPerm,
            expiresAt,
          })
        } catch (permErr: any) {
          console.warn('Initial recipient assignment note:', permErr)
        }
      }

      showToast(`Document "${newDoc.title}" uploaded and stored securely.`, 'success')
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadRecipientEmail('')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Delete Document
  const handleDeleteDocument = async (docId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete document "${title}"?`)) return

    setLoading(true)
    try {
      await api.deleteDocument(docId)
      showToast(`Document "${title}" deleted`, 'success')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete document', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Grant / Assign Permission Submit
  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!grantDocId || !grantUserEmail.trim()) {
      showToast('Document and Employee email are required', 'error')
      return
    }

    setLoading(true)
    try {
      const expiresAt = grantExpiryDays === 'never'
        ? null
        : new Date(Date.now() + parseInt(grantExpiryDays, 10) * 86400000).toISOString()

      await api.grantPermission(grantDocId, {
        userEmail: grantUserEmail.trim(),
        permissionLevel: grantPermLevel,
        expiresAt,
      })

      showToast(`Granted ${grantPermLevel} permission to ${grantUserEmail}`, 'success')
      setShowGrantModal(false)
      setGrantUserEmail('')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to grant permission', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Update Permission Submit
  const handleUpdatePermission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPerm) return

    setLoading(true)
    try {
      const expiresAt = updatePermExpiry ? new Date(updatePermExpiry).toISOString() : null
      await api.updatePermission(selectedPerm.id, {
        permissionLevel: updatePermLevel,
        expiresAt,
      })

      showToast('Permission level and expiry updated successfully', 'success')
      setShowUpdatePermModal(false)
      setSelectedPerm(null)
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to update permission', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Revoke Permission
  const handleRevokePermission = async (permId: string, email: string, docTitle: string) => {
    if (!confirm(`Revoke access for ${email} on "${docTitle}"? Access and download tokens will be blocked immediately.`)) return

    setLoading(true)
    try {
      await api.revokePermission(permId)
      showToast(`Access revoked for ${email}`, 'success')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke permission', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Review Access Request
  const handleReviewAccess = async (approved: boolean) => {
    if (!selectedAccessReq) return

    setLoading(true)
    try {
      const expiresAt = approved && reviewExpiryDays !== 'never'
        ? new Date(Date.now() + parseInt(reviewExpiryDays, 10) * 86400000).toISOString()
        : null

      await api.reviewAccessRequest(selectedAccessReq.id, {
        approved,
        reviewNote: reviewNote.trim() || undefined,
        expiresAt,
      })

      showToast(`Request ${approved ? 'approved' : 'rejected'} for ${selectedAccessReq.requesterEmail}`, 'success')
      setShowReviewAccessModal(false)
      setSelectedAccessReq(null)
      setReviewNote('')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to review request', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Review Renewal Request
  const handleReviewRenewal = async (approved: boolean) => {
    if (!selectedRenewalReq) return

    setLoading(true)
    try {
      await api.reviewRenewal(selectedRenewalReq.id, {
        approved,
        reviewNote: reviewNote.trim() || undefined,
        extensionDays: approved ? selectedRenewalReq.requestedExtensionDays : undefined,
      })

      showToast(`Renewal request ${approved ? 'approved' : 'rejected'}`, 'success')
      setShowReviewRenewalModal(false)
      setSelectedRenewalReq(null)
      setReviewNote('')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to review renewal', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Invite Employee Submit
  const handleInviteEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteFullName.trim()) {
      showToast('Email and Full Name are required', 'error')
      return
    }

    setLoading(true)
    try {
      await api.inviteEmployee({
        email: inviteEmail.trim(),
        fullName: inviteFullName.trim(),
        password: invitePassword.trim(),
        role: inviteRole,
      })

      showToast(`Employee ${inviteFullName} invited successfully.`, 'success')
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteFullName('')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to invite employee', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Create Group Submit
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) {
      showToast('Group name is required', 'error')
      return
    }

    setLoading(true)
    try {
      const memberEmails = groupMemberEmails
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      await api.createGroup({
        name: groupName.trim(),
        department: groupDept.trim(),
        description: groupDesc.trim(),
        memberEmails,
      })

      showToast(`Group "${groupName}" created successfully.`, 'success')
      setShowCreateGroupModal(false)
      setGroupName('')
      setGroupDept('')
      setGroupDesc('')
      setGroupMemberEmails('')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to create group', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Change Password Submit
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      showToast('Current password is required', 'error')
      return
    }
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error')
      return
    }

    setChangingPassword(true)
    try {
      const res = await api.changePassword(currentPassword, newPassword)
      showToast(res.message || 'Password changed successfully', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      showToast(err.message || 'Failed to change password', 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  // Viewer: Request Access Submit
  const handleViewerRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqAccessDocId || !reqAccessReason.trim()) {
      showToast('Document and business reason are required', 'error')
      return
    }

    setLoading(true)
    try {
      await api.createAccessRequest({
        documentId: reqAccessDocId,
        requestedPermission: reqAccessLevel,
        reason: reqAccessReason.trim(),
      })
      showToast('Access request submitted for Manager review', 'success')
      setShowRequestAccessModal(false)
      setReqAccessReason('')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to submit request', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Viewer: Request Renewal Submit
  const handleViewerRequestRenewal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqRenewalPermId || !reqRenewalReason.trim()) {
      showToast('Permission and renewal reason are required', 'error')
      return
    }

    setLoading(true)
    try {
      await api.createRenewal({
        permissionId: reqRenewalPermId,
        reason: reqRenewalReason.trim(),
        requestedExtensionDays: parseInt(reqRenewalDays, 10) || 30,
      })
      showToast('Renewal request submitted for Manager review', 'success')
      setShowRequestRenewalModal(false)
      setReqRenewalReason('')
      loadAllData()
    } catch (err: any) {
      showToast(err.message || 'Failed to submit renewal', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchQuery =
        !query ||
        doc.title.toLowerCase().includes(query.toLowerCase()) ||
        doc.originalFilename.toLowerCase().includes(query.toLowerCase())
      const matchCategory = categoryFilter === 'All' || doc.category === categoryFilter
      const matchProject = projectFilter === 'All' || doc.projectId === projectFilter
      return matchQuery && matchCategory && matchProject
    })
  }, [documents, query, categoryFilter, projectFilter])

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchAction = auditActionFilter === 'All' || log.action === auditActionFilter
      const matchResult = auditResultFilter === 'All' || log.result === auditResultFilter
      const matchSearch =
        !auditSearch ||
        log.actorEmail.toLowerCase().includes(auditSearch.toLowerCase()) ||
        (log.reason && log.reason.toLowerCase().includes(auditSearch.toLowerCase())) ||
        (log.resourceId && log.resourceId.toLowerCase().includes(auditSearch.toLowerCase()))
      return matchAction && matchResult && matchSearch
    })
  }, [auditLogs, auditActionFilter, auditResultFilter, auditSearch])

  // Navigation Items
  const currentNavItems = navConfig[enforcedRole] || navConfig.OWNER

  return (
    <div className="flex min-h-screen bg-[#EAF0F8] text-[#14213D]">
      {/* Toast Alert */}
      {toast && (
        <div
          role="alert"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
            toast.type === 'success'
              ? 'border-teal-200 bg-teal-50 text-teal-900 shadow-teal-900/10'
              : toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-900 shadow-red-900/10'
              : 'border-blue-200 bg-[#EAF0F8] text-[#14213D] shadow-blue-900/10'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="size-4 text-teal-600 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="size-4 text-red-600 shrink-0" />}
          {toast.type === 'info' && <Info className="size-4 text-[#243B64] shrink-0" />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-[#d8e2ef] bg-[#14213D] text-white shadow-xl transition-all">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-[#243B64] px-6">
          <div className="grid size-9 place-items-center rounded-xl bg-[#14B8A6] text-white shadow-md shadow-teal-950/40">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight text-white">TrustVault</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-300">
              {enforcedRole === 'OWNER' ? 'Manager Portal' : enforcedRole === 'ADMIN' ? 'Admin Portal' : 'Employee Portal'}
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="border-b border-[#243B64] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#243B64]/60 p-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-[#14213D] text-[#14B8A6] font-bold text-xs">
              {currentUser?.fullName?.charAt(0) || 'M'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-white">
                {currentUser?.fullName || 'Manager'}
              </div>
              <div className="truncate text-[11px] text-[#8ca0c2]">
                {currentUser?.email || 'manager@company.com'}
              </div>
            </div>
            <span className="rounded-md bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-teal-300">
              {enforcedRole === 'OWNER' ? 'Manager' : enforcedRole === 'ADMIN' ? 'Admin' : 'Viewer'}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {currentNavItems.map(([name, Icon]) => {
            const isActive = activeNav === name
            return (
              <button
                key={name}
                onClick={() => {
                  setActiveNav(name)
                  setQuery('')
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-[#14B8A6] text-white shadow-md shadow-teal-950/30'
                    : 'text-[#9ab1d1] hover:bg-[#243B64] hover:text-white'
                }`}
              >
                <Icon className={`size-4 shrink-0 ${isActive ? 'text-white' : 'text-[#8ca0c2]'}`} />
                <span>{name}</span>
              </button>
            )
          })}
        </nav>

        {/* Quick Integrity Pill & Logout */}
        <div className="border-t border-[#243B64] p-4 space-y-2">
          <button
            onClick={handleVerifyIntegrity}
            disabled={verifyingIntegrity}
            className="flex w-full items-center justify-between rounded-xl border border-teal-500/30 bg-[#243B64]/50 px-3 py-2 text-[11px] font-medium text-teal-200 transition hover:bg-[#243B64]"
          >
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-teal-400 animate-pulse" />
              <span>SHA-256 Ledger</span>
            </div>
            <RefreshCw className={`size-3 text-teal-400 ${verifyingIntegrity ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 hover:text-red-200"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#d8e2ef] bg-white/90 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-tight text-[#14213D]">{activeNav}</h1>
            <span className="rounded-full bg-[#EAF0F8] px-2.5 py-0.5 text-[11px] font-bold text-[#243B64]">
              TrustVault Enterprise
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick action buttons depending on active section */}
            {enforcedRole === 'OWNER' && (
              <>
                <button
                  onClick={() => {
                    setProjCreateStep('details')
                    setNewProjSelectedMembers([])
                    setShowCreateProjectModal(true)
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-[#243B64] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#14213D]"
                >
                  <FolderPlus className="size-3.5 text-teal-300" />
                  <span>New Project</span>
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#243B64]"
                >
                  <Upload className="size-3.5 text-[#14B8A6]" />
                  <span>Upload Document</span>
                </button>
              </>
            )}

            {enforcedRole === 'VIEWER' && (
              <>
                <button
                  onClick={() => setShowRequestAccessModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#243B64]"
                >
                  <Plus className="size-3.5 text-teal-300" />
                  <span>Request Access</span>
                </button>
                <button
                  onClick={() => setShowRequestRenewalModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#243B64] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#14213D]"
                >
                  <Clock3 className="size-3.5 text-teal-300" />
                  <span>Request Renewal</span>
                </button>
              </>
            )}

            <button
              onClick={loadAllData}
              title="Refresh Data"
              className="grid size-9 place-items-center rounded-xl border border-[#d8e2ef] bg-[#fafcff] text-[#52637f] transition hover:bg-[#EAF0F8] hover:text-[#14213D]"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* View Switcher Container */}
        <main className="flex-1 p-8">
          {/* ============================================================ */}
          {/* 1. OVERVIEW DESTINATION                                       */}
          {/* ============================================================ */}
          {activeNav === 'Overview' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Security Health / Ledger Status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-sky-50 p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="grid size-12 place-items-center rounded-2xl bg-[#14B8A6] text-white shadow-md shadow-teal-900/20">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#14213D]">
                      TrustVault Defense Architecture Active
                    </h3>
                    <p className="mt-0.5 text-xs text-[#52637f]">
                      Zero-Trust document permissions, server-side expiry, single-use download tokens & immutable audit logging.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleVerifyIntegrity}
                    disabled={verifyingIntegrity}
                    className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#14213D] shadow-sm border border-[#d8e2ef] transition hover:bg-[#EAF0F8]"
                  >
                    <RefreshCw className={`size-3.5 text-[#14B8A6] ${verifyingIntegrity ? 'animate-spin' : ''}`} />
                    <span>Verify Cryptographic Integrity</span>
                  </button>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#71829d]">TOTAL PROJECTS</span>
                    <div className="grid size-9 place-items-center rounded-xl bg-[#EAF0F8] text-[#243B64]">
                      <FolderKanban className="size-4 text-[#243B64]" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-black text-[#14213D]">
                    {statsData?.summary?.totalProjects ?? projects.length}
                  </div>
                  <div className="mt-1 text-xs text-[#52637f]">
                    Active team collaboration workspaces
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#71829d]">VAULT DOCUMENTS</span>
                    <div className="grid size-9 place-items-center rounded-xl bg-[#EAF0F8] text-[#14B8A6]">
                      <FileText className="size-4 text-[#14B8A6]" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-black text-[#14213D]">
                    {statsData?.summary?.totalDocuments ?? documents.length}
                  </div>
                  <div className="mt-1 text-xs text-[#52637f]">
                    Encrypted files with SHA-256 verification
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#71829d]">ACTIVE TEAM MEMBERS</span>
                    <div className="grid size-9 place-items-center rounded-xl bg-[#EAF0F8] text-[#243B64]">
                      <Users className="size-4 text-[#243B64]" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-black text-[#14213D]">
                    {statsData?.summary?.activeTeamMembers ?? employees.length}
                  </div>
                  <div className="mt-1 text-xs text-[#52637f]">
                    Provisioned verified enterprise accounts
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#71829d]">PENDING REQUESTS</span>
                    <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
                      <Clock3 className="size-4" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-black text-[#14213D]">
                    {accessRequests.filter((r) => r.status === 'PENDING').length +
                      renewals.filter((r) => r.status === 'PENDING').length}
                  </div>
                  <div className="mt-1 text-xs text-amber-600 font-semibold">
                    Awaiting Manager authorization review
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#71829d]">EXPIRING PERMISSIONS</span>
                    <div className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
                      <LockKeyhole className="size-4" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-black text-[#14213D]">
                    {statsData?.summary?.expiringPermissions ??
                      permissions.filter(
                        (p) =>
                          p.isExpired ||
                          (p.expiresAt &&
                            new Date(p.expiresAt).getTime() - Date.now() < 30 * 86400000)
                      ).length}
                  </div>
                  <div className="mt-1 text-xs text-[#52637f]">
                    Expiring within 30 days or pending renewal
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#71829d]">SECURITY EVENTS</span>
                    <div className="grid size-9 place-items-center rounded-xl bg-purple-50 text-purple-600">
                      <Activity className="size-4" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-black text-[#14213D]">
                    {statsData?.summary?.securityEventsCount ?? auditLogs.length}
                  </div>
                  <div className="mt-1 text-xs text-[#52637f]">
                    Total immutable cryptographic logs recorded
                  </div>
                </div>
              </div>

              {/* Two Column Layout: Quick Actions & Recent Activity Feed */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Quick Shortcuts */}
                <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm lg:col-span-1">
                  <h3 className="text-sm font-extrabold text-[#14213D]">Manager Quick Actions</h3>
                  <p className="mt-0.5 text-xs text-[#52637f]">
                    Frequently performed administrative actions
                  </p>

                  <div className="mt-4 space-y-2.5">
                    <button
                      onClick={() => {
                        setProjCreateStep('details')
                        setShowCreateProjectModal(true)
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-[#d8e2ef] p-3 text-xs font-bold text-[#14213D] transition hover:border-[#14B8A6] hover:bg-[#EAF0F8]"
                    >
                      <div className="flex items-center gap-2.5">
                        <FolderPlus className="size-4 text-[#243B64]" />
                        <span>Create New Project</span>
                      </div>
                      <ChevronRight className="size-4 text-[#8ca0c2]" />
                    </button>

                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#d8e2ef] p-3 text-xs font-bold text-[#14213D] transition hover:border-[#14B8A6] hover:bg-[#EAF0F8]"
                    >
                      <div className="flex items-center gap-2.5">
                        <Upload className="size-4 text-[#14B8A6]" />
                        <span>Upload Document</span>
                      </div>
                      <ChevronRight className="size-4 text-[#8ca0c2]" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveNav('Access Requests')
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-[#d8e2ef] p-3 text-xs font-bold text-[#14213D] transition hover:border-[#14B8A6] hover:bg-[#EAF0F8]"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileCheck2 className="size-4 text-amber-500" />
                        <span>Review Access Requests ({accessRequests.filter((r) => r.status === 'PENDING').length})</span>
                      </div>
                      <ChevronRight className="size-4 text-[#8ca0c2]" />
                    </button>

                    <button
                      onClick={() => setShowGrantModal(true)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#d8e2ef] p-3 text-xs font-bold text-[#14213D] transition hover:border-[#14B8A6] hover:bg-[#EAF0F8]"
                    >
                      <div className="flex items-center gap-2.5">
                        <LockKeyhole className="size-4 text-purple-600" />
                        <span>Assign Document Permissions</span>
                      </div>
                      <ChevronRight className="size-4 text-[#8ca0c2]" />
                    </button>

                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#d8e2ef] p-3 text-xs font-bold text-[#14213D] transition hover:border-[#14B8A6] hover:bg-[#EAF0F8]"
                    >
                      <div className="flex items-center gap-2.5">
                        <UserPlus className="size-4 text-teal-600" />
                        <span>Invite Employee</span>
                      </div>
                      <ChevronRight className="size-4 text-[#8ca0c2]" />
                    </button>
                  </div>
                </div>

                {/* Recent Security Activity Feed */}
                <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#14213D]">Recent Security Events</h3>
                      <p className="mt-0.5 text-xs text-[#52637f]">
                        Real-time immutable ledger audit stream
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveNav('Audit Logs')}
                      className="text-xs font-bold text-[#14B8A6] hover:underline"
                    >
                      View All Logs →
                    </button>
                  </div>

                  <div className="mt-4 divide-y divide-[#eef4fa] overflow-hidden">
                    {auditLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              log.result === 'SUCCESS'
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {log.result}
                          </span>
                          <div>
                            <div className="font-bold text-[#14213D]">{log.action}</div>
                            <div className="text-[11px] text-[#52637f]">{log.reason || log.resourceType}</div>
                            <div className="mt-0.5 text-[10px] text-[#8ca0c2]">
                              Actor: {log.actorEmail} • IP: {log.ipAddress || '127.0.0.1'}
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-[#8ca0c2] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <div className="py-8 text-center text-xs text-[#8ca0c2]">
                        No recent security events recorded.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. PROJECTS DESTINATION                                       */}
          {/* ============================================================ */}
          {activeNav === 'Projects' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header with Search and Create */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-2.5 size-4 text-[#8ca0c2]" />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full rounded-xl border border-[#d8e2ef] bg-white py-2 pl-9 pr-3 text-xs text-[#14213D] placeholder:text-[#8ca0c2] focus:border-[#243B64] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setProjCreateStep('details')
                      setShowCreateProjectModal(true)
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#243B64]"
                  >
                    <Plus className="size-4 text-[#14B8A6]" />
                    <span>Create Project</span>
                  </button>
                </div>
              </div>

              {/* Security Boundary Notice */}
              <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-xs text-[#243B64]">
                <ShieldCheck className="size-4 shrink-0 text-[#14B8A6] mt-0.5" />
                <div>
                  <span className="font-bold">Project Security Boundary: </span>
                  Project responsibilities (Contributor, Reviewer, Lead, Observer) manage team collaboration.
                  <strong> Project membership does NOT grant document access.</strong> Specific READ or EDIT permissions must be assigned per document.
                </div>
              </div>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {projects
                  .filter(
                    (p) =>
                      !query ||
                      p.name.toLowerCase().includes(query.toLowerCase()) ||
                      (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
                  )
                  .map((p) => (
                    <div
                      key={p.id}
                      className="group flex flex-col justify-between rounded-2xl border border-[#d8e2ef] bg-white p-5 shadow-sm transition-all hover:border-[#14B8A6] hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-md bg-[#EAF0F8] px-2 py-0.5 text-[10px] font-bold text-[#243B64]">
                            {p.category || 'General'}
                          </span>
                          <span className="text-[10px] text-[#8ca0c2]">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h3 className="mt-3 text-sm font-extrabold text-[#14213D] group-hover:text-[#243B64]">
                          {p.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-[#52637f]">
                          {p.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="mt-5 border-t border-[#f0f4f9] pt-4">
                        <div className="flex items-center justify-between text-xs text-[#71829d]">
                          <div className="flex items-center gap-1.5">
                            <Users className="size-3.5 text-[#8ca0c2]" />
                            <span>{p.memberCount} members</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FileText className="size-3.5 text-[#8ca0c2]" />
                            <span>{p.documentCount} files</span>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedProject(p)
                              setProjectDetailTab('overview')
                              loadProjectMembers(p.id)
                              setShowProjectDetailModal(true)
                            }}
                            className="flex-1 rounded-xl bg-[#EAF0F8] py-2 text-center text-xs font-bold text-[#243B64] transition hover:bg-[#243B64] hover:text-white"
                          >
                            View Workspace
                          </button>
                          <button
                            onClick={() => handleDeleteProject(p.id, p.name)}
                            title="Delete Project"
                            className="grid size-8 place-items-center rounded-xl border border-red-200 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {projects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#c6d5e8] bg-white/50 p-12 text-center">
                  <FolderKanban className="mx-auto size-10 text-[#8ca0c2]" />
                  <h3 className="mt-3 text-sm font-bold text-[#14213D]">No Projects Created Yet</h3>
                  <p className="mt-1 text-xs text-[#52637f]">
                    Create a project to organize documents and assign team responsibilities.
                  </p>
                  <button
                    onClick={() => setShowCreateProjectModal(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm"
                  >
                    <Plus className="size-3.5" />
                    <span>Create First Project</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. EMPLOYEES & GROUPS DESTINATION                             */}
          {/* ============================================================ */}
          {activeNav === 'Employees & Groups' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Sub tabs: Employees vs Groups */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#d8e2ef] pb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEmpGroupTab('employees')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                      empGroupTab === 'employees'
                        ? 'bg-[#14213D] text-white shadow-sm'
                        : 'bg-white text-[#52637f] border border-[#d8e2ef] hover:bg-[#EAF0F8]'
                    }`}
                  >
                    <Users className="size-3.5" />
                    <span>Employee Directory ({employees.length})</span>
                  </button>
                  <button
                    onClick={() => setEmpGroupTab('groups')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                      empGroupTab === 'groups'
                        ? 'bg-[#14213D] text-white shadow-sm'
                        : 'bg-white text-[#52637f] border border-[#d8e2ef] hover:bg-[#EAF0F8]'
                    }`}
                  >
                    <Building2 className="size-3.5" />
                    <span>Teams & Groups ({groups.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {empGroupTab === 'employees' ? (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-[#14B8A6] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700"
                    >
                      <UserPlus className="size-4" />
                      <span>Invite Employee</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowCreateGroupModal(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#243B64]"
                    >
                      <Plus className="size-4 text-[#14B8A6]" />
                      <span>Create Group</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Group / Project Access Disclaimer */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-xs text-[#243B64] flex items-start gap-2.5">
                <Info className="size-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Enterprise Role Principle: </strong>
                  Group and team affiliations are organizational descriptors. Inactive employees are strictly prevented from authentication and protected API access. Document access requires individual permission grants.
                </div>
              </div>

              {/* Employees Tab Table */}
              {empGroupTab === 'employees' && (
                <div className="rounded-2xl border border-[#d8e2ef] bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-[#d8e2ef] p-4 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-2.5 size-4 text-[#8ca0c2]" />
                      <input
                        type="text"
                        placeholder="Search employees by name or email..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] py-1.5 pl-9 pr-3 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                      />
                    </div>
                    <span className="text-xs text-[#71829d]">
                      Showing {employees.length} enterprise accounts
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#eef4fa] bg-[#fafcff] text-[11px] font-bold uppercase text-[#71829d]">
                        <tr>
                          <th className="px-5 py-3">Employee</th>
                          <th className="px-5 py-3">Corporate Role</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Groups</th>
                          <th className="px-5 py-3">Assigned Projects</th>
                          <th className="px-5 py-3">Document Permissions</th>
                          <th className="px-5 py-3">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f2f6fb]">
                        {employees
                          .filter(
                            (e) =>
                              !query ||
                              e.fullName.toLowerCase().includes(query.toLowerCase()) ||
                              e.email.toLowerCase().includes(query.toLowerCase())
                          )
                          .map((emp) => (
                            <tr key={emp.id} className="hover:bg-[#fafcff] transition">
                              <td className="px-5 py-3.5">
                                <div className="font-bold text-[#14213D]">{emp.fullName}</div>
                                <div className="text-[11px] text-[#71829d]">{emp.email}</div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="rounded-md bg-[#EAF0F8] px-2 py-0.5 text-[10px] font-bold text-[#243B64]">
                                  {emp.role === 'ROLE_OWNER'
                                    ? 'Manager'
                                    : emp.role === 'ROLE_ADMIN'
                                    ? 'Admin'
                                    : 'Viewer'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                    emp.active
                                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                                  }`}
                                >
                                  <span
                                    className={`size-1.5 rounded-full ${
                                      emp.active ? 'bg-teal-500' : 'bg-red-500'
                                    }`}
                                  />
                                  {emp.active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-[#52637f]">
                                {emp.groups && emp.groups.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {emp.groups.map((g, idx) => (
                                      <span
                                        key={idx}
                                        className="rounded bg-[#EAF0F8] px-1.5 py-0.5 text-[10px] text-[#243B64]"
                                      >
                                        {g}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[#8ca0c2] italic">None</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-[#52637f] font-semibold">
                                {emp.assignedProjectsCount} projects
                              </td>
                              <td className="px-5 py-3.5 text-[#52637f] font-semibold">
                                {emp.activePermissionsCount} grants
                              </td>
                              <td className="px-5 py-3.5 text-[#8ca0c2]">
                                {new Date(emp.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Groups Tab Cards */}
              {empGroupTab === 'groups' && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {groups.map((grp) => (
                    <div
                      key={grp.id}
                      className="rounded-2xl border border-[#d8e2ef] bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <span className="rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-[10px] font-bold">
                          {grp.department || 'Department'}
                        </span>
                        <span className="text-[10px] text-[#8ca0c2]">
                          {grp.memberCount} members
                        </span>
                      </div>

                      <h3 className="mt-3 text-sm font-extrabold text-[#14213D]">{grp.name}</h3>
                      <p className="mt-1 text-xs text-[#52637f] line-clamp-2">
                        {grp.description || 'No description provided.'}
                      </p>

                      <div className="mt-4 border-t border-[#f0f4f9] pt-3 flex items-center justify-between text-xs">
                        <span className="text-[#8ca0c2] text-[11px]">
                          Created by {grp.ownerName}
                        </span>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete group "${grp.name}"?`)) {
                              await api.deleteGroup(grp.id)
                              showToast(`Group "${grp.name}" deleted`, 'success')
                              loadAllData()
                            }
                          }}
                          className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                        >
                          Delete Group
                        </button>
                      </div>
                    </div>
                  ))}

                  {groups.length === 0 && (
                    <div className="col-span-3 rounded-2xl border border-dashed border-[#c6d5e8] bg-white/50 p-8 text-center text-xs text-[#71829d]">
                      No teams or groups created yet. Click "Create Group" to establish department teams.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* 4. DOCUMENTS DESTINATION                                      */}
          {/* ============================================================ */}
          {activeNav === 'Documents' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="relative min-w-[200px] flex-1 max-w-xs">
                    <Search className="absolute left-3 top-2.5 size-4 text-[#8ca0c2]" />
                    <input
                      type="text"
                      placeholder="Search documents by title or filename..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full rounded-xl border border-[#d8e2ef] bg-white py-2 pl-9 pr-3 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                    />
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="rounded-xl border border-[#d8e2ef] bg-white px-3 py-2 text-xs font-semibold text-[#14213D] focus:outline-none"
                  >
                    <option value="All">All Categories</option>
                    <option value="Contracts">Contracts</option>
                    <option value="Financials">Financials</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Legal">Legal</option>
                    <option value="Reports">Reports</option>
                  </select>

                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="rounded-xl border border-[#d8e2ef] bg-white px-3 py-2 text-xs font-semibold text-[#14213D] focus:outline-none"
                  >
                    <option value="All">All Projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#243B64]"
                  >
                    <Upload className="size-4 text-[#14B8A6]" />
                    <span>Upload Document</span>
                  </button>
                </div>
              </div>

              {/* Documents Table */}
              <div className="rounded-2xl border border-[#d8e2ef] bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#eef4fa] bg-[#fafcff] text-[11px] font-bold uppercase text-[#71829d]">
                      <tr>
                        <th className="px-5 py-3">Document Title</th>
                        <th className="px-5 py-3">Project Association</th>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3">Size / Format</th>
                        <th className="px-5 py-3">SHA-256 Checksum</th>
                        <th className="px-5 py-3">Access Level</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f2f6fb]">
                      {filteredDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-[#fafcff] transition">
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-[#14213D]">{doc.title}</div>
                            <div className="text-[11px] text-[#8ca0c2]">{doc.originalFilename}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            {doc.projectName ? (
                              <span className="rounded-md bg-[#EAF0F8] px-2 py-0.5 text-[10px] font-bold text-[#243B64]">
                                {doc.projectName}
                              </span>
                            ) : (
                              <span className="text-[#8ca0c2] italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              {doc.category || 'General'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[#52637f]">
                            <div>{doc.formattedSize}</div>
                            <div className="text-[10px] text-[#8ca0c2]">{doc.contentType}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#71829d]">
                              <span>{doc.sha256Checksum?.slice(0, 10)}...</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(doc.sha256Checksum)
                                  showToast('Checksum copied to clipboard', 'info')
                                }}
                                title="Copy full SHA-256 hash"
                                className="text-slate-400 hover:text-slate-700"
                              >
                                <Copy className="size-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="rounded-md bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 text-[10px] font-bold">
                              {doc.userAccessLevel}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleDownloadDocument(doc)}
                                title="Secure Download"
                                className="grid size-8 place-items-center rounded-xl border border-teal-200 bg-teal-50/50 text-[#14B8A6] transition hover:bg-teal-500 hover:text-white"
                              >
                                <Download className="size-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setGrantDocId(doc.id)
                                  setShowGrantModal(true)
                                }}
                                title="Manage Permissions"
                                className="grid size-8 place-items-center rounded-xl border border-[#d8e2ef] bg-[#fafcff] text-[#243B64] transition hover:bg-[#243B64] hover:text-white"
                              >
                                <LockKeyhole className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id, doc.title)}
                                title="Delete Document"
                                className="grid size-8 place-items-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-500 hover:text-white"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredDocuments.length === 0 && (
                  <div className="p-12 text-center text-xs text-[#8ca0c2]">
                    No documents matching your search criteria.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 5. ACCESS & PERMISSIONS DESTINATION                           */}
          {/* ============================================================ */}
          {activeNav === 'Access & Permissions' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-2.5 size-4 text-[#8ca0c2]" />
                    <input
                      type="text"
                      placeholder="Filter permissions by document or user..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full rounded-xl border border-[#d8e2ef] bg-white py-2 pl-9 pr-3 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowGrantModal(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#243B64]"
                  >
                    <Plus className="size-4 text-[#14B8A6]" />
                    <span>Assign Access</span>
                  </button>
                </div>
              </div>

              {/* Permissions List */}
              <div className="rounded-2xl border border-[#d8e2ef] bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#eef4fa] bg-[#fafcff] text-[11px] font-bold uppercase text-[#71829d]">
                      <tr>
                        <th className="px-5 py-3">Document</th>
                        <th className="px-5 py-3">Authorized Employee</th>
                        <th className="px-5 py-3">Permission Level</th>
                        <th className="px-5 py-3">Granted By</th>
                        <th className="px-5 py-3">Expiry Status</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f2f6fb]">
                      {permissions
                        .filter(
                          (p) =>
                            !query ||
                            p.documentTitle.toLowerCase().includes(query.toLowerCase()) ||
                            p.userEmail.toLowerCase().includes(query.toLowerCase())
                        )
                        .map((perm) => (
                          <tr key={perm.id} className="hover:bg-[#fafcff] transition">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-[#14213D]">{perm.documentTitle}</div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-[#14213D]">{perm.userName}</div>
                              <div className="text-[11px] text-[#8ca0c2]">{perm.userEmail}</div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  perm.permissionLevel === 'EDIT'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {perm.permissionLevel}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-[#52637f]">
                              {perm.grantedByName || 'Manager'}
                            </td>
                            <td className="px-5 py-3.5">
                              {perm.expiresAt ? (
                                <div>
                                  <div
                                    className={`font-semibold ${
                                      perm.isExpired ? 'text-red-600' : 'text-[#14213D]'
                                    }`}
                                  >
                                    {new Date(perm.expiresAt).toLocaleDateString()}
                                  </div>
                                  <div className="text-[10px] text-[#8ca0c2]">
                                    {perm.isExpired ? 'Expired' : 'Valid'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[#8ca0c2] font-medium">Never expires</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  perm.status === 'ACTIVE'
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                              >
                                {perm.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedPerm(perm)
                                    setUpdatePermLevel(perm.permissionLevel)
                                    setUpdatePermExpiry(
                                      perm.expiresAt ? perm.expiresAt.slice(0, 16) : ''
                                    )
                                    setShowUpdatePermModal(true)
                                  }}
                                  className="text-xs font-bold text-[#243B64] hover:underline"
                                >
                                  Modify
                                </button>
                                <button
                                  onClick={() =>
                                    handleRevokePermission(perm.id, perm.userEmail, perm.documentTitle)
                                  }
                                  className="text-xs font-bold text-red-600 hover:underline"
                                >
                                  Revoke
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {permissions.length === 0 && (
                  <div className="p-12 text-center text-xs text-[#8ca0c2]">
                    No explicit document permissions granted yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 6. ACCESS REQUESTS (INCLUDE DOWNLOAD REQUESTS)                */}
          {/* ============================================================ */}
          {activeNav === 'Access Requests' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Tab Selector: Access Requests vs Renewals / Download Approvals */}
              <div className="flex items-center gap-3 border-b border-[#d8e2ef] pb-4">
                <button
                  onClick={() => setRequestTab('access')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    requestTab === 'access'
                      ? 'bg-[#14213D] text-white shadow-sm'
                      : 'bg-white text-[#52637f] border border-[#d8e2ef] hover:bg-[#EAF0F8]'
                  }`}
                >
                  <FileCheck2 className="size-3.5" />
                  <span>
                    Document Access Requests (
                    {accessRequests.filter((r) => r.status === 'PENDING').length} pending)
                  </span>
                </button>
                <button
                  onClick={() => setRequestTab('renewals')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    requestTab === 'renewals'
                      ? 'bg-[#14213D] text-white shadow-sm'
                      : 'bg-white text-[#52637f] border border-[#d8e2ef] hover:bg-[#EAF0F8]'
                  }`}
                >
                  <Clock3 className="size-3.5" />
                  <span>
                    Renewal & Download Approvals (
                    {renewals.filter((r) => r.status === 'PENDING').length} pending)
                  </span>
                </button>
              </div>

              {/* Panel 1: Document Access Requests */}
              {requestTab === 'access' && (
                <div className="rounded-2xl border border-[#d8e2ef] bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#eef4fa] bg-[#fafcff] text-[11px] font-bold uppercase text-[#71829d]">
                        <tr>
                          <th className="px-5 py-3">Requester</th>
                          <th className="px-5 py-3">Document</th>
                          <th className="px-5 py-3">Permission Requested</th>
                          <th className="px-5 py-3">Business Justification</th>
                          <th className="px-5 py-3">Submitted</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Review Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f2f6fb]">
                        {accessRequests.map((req) => (
                          <tr key={req.id} className="hover:bg-[#fafcff] transition">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-[#14213D]">{req.requesterName}</div>
                              <div className="text-[11px] text-[#8ca0c2]">{req.requesterEmail}</div>
                            </td>
                            <td className="px-5 py-3.5 font-bold text-[#14213D]">
                              {req.documentTitle}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-bold">
                                {req.requestedPermission}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 max-w-xs text-[#52637f]">
                              {req.reason}
                            </td>
                            <td className="px-5 py-3.5 text-[#8ca0c2]">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  req.status === 'PENDING'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : req.status === 'APPROVED'
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                              >
                                {req.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {req.status === 'PENDING' ? (
                                <button
                                  onClick={() => {
                                    setSelectedAccessReq(req)
                                    setReviewNote('')
                                    setShowReviewAccessModal(true)
                                  }}
                                  className="rounded-xl bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                                >
                                  Review
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#8ca0c2] italic">
                                  {req.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {accessRequests.length === 0 && (
                    <div className="p-12 text-center text-xs text-[#8ca0c2]">
                      No document access requests found.
                    </div>
                  )}
                </div>
              )}

              {/* Panel 2: Renewal & Download Approvals */}
              {requestTab === 'renewals' && (
                <div className="rounded-2xl border border-[#d8e2ef] bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#eef4fa] bg-[#fafcff] text-[11px] font-bold uppercase text-[#71829d]">
                        <tr>
                          <th className="px-5 py-3">Requester</th>
                          <th className="px-5 py-3">Document</th>
                          <th className="px-5 py-3">Current Expiry</th>
                          <th className="px-5 py-3">Requested Extension</th>
                          <th className="px-5 py-3">Reason</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Review Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f2f6fb]">
                        {renewals.map((ren) => (
                          <tr key={ren.id} className="hover:bg-[#fafcff] transition">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-[#14213D]">{ren.requesterName}</div>
                              <div className="text-[11px] text-[#8ca0c2]">{ren.requesterEmail}</div>
                            </td>
                            <td className="px-5 py-3.5 font-bold text-[#14213D]">
                              {ren.documentTitle}
                            </td>
                            <td className="px-5 py-3.5 text-[#52637f]">
                              {ren.currentExpiresAt
                                ? new Date(ren.currentExpiresAt).toLocaleDateString()
                                : 'None'}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-[#243B64]">
                              +{ren.requestedExtensionDays} days
                            </td>
                            <td className="px-5 py-3.5 max-w-xs text-[#52637f]">{ren.reason}</td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  ren.status === 'PENDING'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : ren.status === 'APPROVED'
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                              >
                                {ren.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {ren.status === 'PENDING' ? (
                                <button
                                  onClick={() => {
                                    setSelectedRenewalReq(ren)
                                    setReviewNote('')
                                    setShowReviewRenewalModal(true)
                                  }}
                                  className="rounded-xl bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                                >
                                  Review
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#8ca0c2] italic">
                                  {ren.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {renewals.length === 0 && (
                    <div className="p-12 text-center text-xs text-[#8ca0c2]">
                      No renewal or download approval requests found.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* 7. AUDIT LOGS DESTINATION                                     */}
          {/* ============================================================ */}
          {activeNav === 'Audit Logs' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header filter controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="relative min-w-[200px] flex-1 max-w-xs">
                    <Search className="absolute left-3 top-2.5 size-4 text-[#8ca0c2]" />
                    <input
                      type="text"
                      placeholder="Search actor, reason, or resource..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="w-full rounded-xl border border-[#d8e2ef] bg-white py-2 pl-9 pr-3 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                    />
                  </div>

                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="rounded-xl border border-[#d8e2ef] bg-white px-3 py-2 text-xs font-semibold text-[#14213D] focus:outline-none"
                  >
                    <option value="All">All Actions</option>
                    <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                    <option value="DOCUMENT_UPLOAD">DOCUMENT_UPLOAD</option>
                    <option value="DOCUMENT_DOWNLOAD">DOCUMENT_DOWNLOAD</option>
                    <option value="PERMISSION_GRANTED">PERMISSION_GRANTED</option>
                    <option value="PERMISSION_REVOKED">PERMISSION_REVOKED</option>
                    <option value="ACCESS_REQUEST_APPROVED">ACCESS_REQUEST_APPROVED</option>
                    <option value="UNAUTHORIZED_ACCESS_ATTEMPT">UNAUTHORIZED_ACCESS_ATTEMPT</option>
                    <option value="PROJECT_CREATED">PROJECT_CREATED</option>
                  </select>

                  <select
                    value={auditResultFilter}
                    onChange={(e) => setAuditResultFilter(e.target.value)}
                    className="rounded-xl border border-[#d8e2ef] bg-white px-3 py-2 text-xs font-semibold text-[#14213D] focus:outline-none"
                  >
                    <option value="All">All Outcomes</option>
                    <option value="SUCCESS">ALLOWED (SUCCESS)</option>
                    <option value="DENIED">DENIED</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleVerifyIntegrity}
                    disabled={verifyingIntegrity}
                    className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#14213D] border border-[#d8e2ef] shadow-sm transition hover:bg-[#EAF0F8]"
                  >
                    <ShieldCheck className="size-4 text-[#14B8A6]" />
                    <span>{verifyingIntegrity ? 'Verifying...' : 'Verify Cryptographic Hashes'}</span>
                  </button>
                </div>
              </div>

              {/* Cryptographic verification banner if triggered */}
              {integrityStatus && (
                <div
                  className={`rounded-2xl border p-4 text-xs flex items-center justify-between ${
                    integrityStatus.valid
                      ? 'border-teal-200 bg-teal-50 text-teal-900'
                      : 'border-red-200 bg-red-50 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="size-5 shrink-0 text-teal-600" />
                    <div>
                      <div className="font-bold">Cryptographic Ledger Integrity: VALID</div>
                      <div className="text-[11px] opacity-80">{integrityStatus.message}</div>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold">
                    {integrityStatus.verifiedCount} / {integrityStatus.totalRecords} Records Verified
                  </span>
                </div>
              )}

              {/* Audit Logs Table */}
              <div className="rounded-2xl border border-[#d8e2ef] bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#eef4fa] bg-[#fafcff] text-[11px] font-bold uppercase text-[#71829d]">
                      <tr>
                        <th className="px-5 py-3">Timestamp (UTC)</th>
                        <th className="px-5 py-3">Actor</th>
                        <th className="px-5 py-3">Action</th>
                        <th className="px-5 py-3">Outcome</th>
                        <th className="px-5 py-3">Resource</th>
                        <th className="px-5 py-3">Reason / Details</th>
                        <th className="px-5 py-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f2f6fb]">
                      {filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#fafcff] transition">
                          <td className="px-5 py-3.5 whitespace-nowrap text-[#71829d]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-[#14213D]">{log.actorEmail}</div>
                            <div className="text-[10px] text-[#8ca0c2]">{log.actorRole}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="rounded-md bg-[#EAF0F8] px-2 py-0.5 text-[10px] font-bold text-[#243B64]">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                log.result === 'SUCCESS'
                                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {log.result === 'SUCCESS' ? 'ALLOWED' : 'DENIED'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[#52637f]">
                            <div>{log.resourceType}</div>
                            {log.resourceId && (
                              <div className="text-[10px] font-mono text-[#8ca0c2]">
                                {log.resourceId.slice(0, 8)}...
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 max-w-xs text-[#52637f] truncate">
                            {log.reason}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedAuditLog(log)
                                setShowAuditDetailModal(true)
                              }}
                              className="text-xs font-bold text-[#14B8A6] hover:underline"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredAuditLogs.length === 0 && (
                  <div className="p-12 text-center text-xs text-[#8ca0c2]">
                    No audit records match the selected filters.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 8. SETTINGS DESTINATION                                       */}
          {/* ============================================================ */}
          {activeNav === 'Settings' && (
            <div className="max-w-4xl space-y-8 animate-in fade-in duration-300">
              {/* Profile Card */}
              <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#14213D]">Manager Profile</h3>
                <p className="mt-0.5 text-xs text-[#52637f]">
                  Your authenticated corporate credentials and role
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#eef4fa] bg-[#fafcff] p-3.5">
                    <span className="text-[11px] font-bold text-[#8ca0c2]">FULL NAME</span>
                    <div className="mt-1 text-xs font-bold text-[#14213D]">
                      {currentUser?.fullName}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#eef4fa] bg-[#fafcff] p-3.5">
                    <span className="text-[11px] font-bold text-[#8ca0c2]">CORPORATE EMAIL</span>
                    <div className="mt-1 text-xs font-bold text-[#14213D]">{currentUser?.email}</div>
                  </div>
                  <div className="rounded-xl border border-[#eef4fa] bg-[#fafcff] p-3.5">
                    <span className="text-[11px] font-bold text-[#8ca0c2]">ASSIGNED ROLE</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700 border border-teal-200">
                        {enforcedRole === 'OWNER'
                          ? 'Manager'
                          : enforcedRole === 'ADMIN'
                          ? 'Administrator'
                          : 'Viewer'}
                      </span>
                      <span className="text-[11px] font-mono text-[#8ca0c2]">
                        ({currentUser?.role})
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#eef4fa] bg-[#fafcff] p-3.5">
                    <span className="text-[11px] font-bold text-[#8ca0c2]">SECURITY STATUS</span>
                    <div className="mt-1 text-xs font-bold text-teal-600 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-teal-500" />
                      Active & Enforced
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme Settings */}
              <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#14213D]">Interface Theme</h3>
                <p className="mt-0.5 text-xs text-[#52637f]">
                  Customize visual appearance with light-first enterprise design
                </p>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                      themeMode === 'light'
                        ? 'border-[#14B8A6] bg-teal-50 text-teal-900 shadow-sm'
                        : 'border-[#d8e2ef] bg-white text-[#52637f] hover:bg-[#EAF0F8]'
                    }`}
                  >
                    <Sun className="size-4 text-amber-500" />
                    <span>Light (Default)</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                      themeMode === 'dark'
                        ? 'border-[#14B8A6] bg-[#14213D] text-white shadow-sm'
                        : 'border-[#d8e2ef] bg-white text-[#52637f] hover:bg-[#EAF0F8]'
                    }`}
                  >
                    <Moon className="size-4 text-slate-400" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange('system')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                      themeMode === 'system'
                        ? 'border-[#14B8A6] bg-teal-50 text-teal-900 shadow-sm'
                        : 'border-[#d8e2ef] bg-white text-[#52637f] hover:bg-[#EAF0F8]'
                    }`}
                  >
                    <Settings className="size-4 text-[#243B64]" />
                    <span>System Sync</span>
                  </button>
                </div>
              </div>

              {/* Password & Security Change */}
              <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#14213D]">Change Password</h3>
                <p className="mt-0.5 text-xs text-[#52637f]">
                  Enforce strong BCrypt password protection for your account
                </p>

                <form onSubmit={handleChangePassword} className="mt-4 space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">Current Password</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="flex items-center gap-2 rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#243B64] disabled:opacity-50"
                  >
                    <Key className="size-3.5 text-[#14B8A6]" />
                    <span>{changingPassword ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </form>
              </div>

              {/* Functional Notification Preferences */}
              <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#14213D]">Notification Preferences</h3>
                <p className="mt-0.5 text-xs text-[#52637f]">
                  Configure your security alerts and permission lifecycle alerts
                </p>

                <div className="mt-4 space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-xl border border-[#eef4fa] hover:bg-[#fafcff] cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-[#14213D]">Access Request Alerts</div>
                      <div className="text-[11px] text-[#71829d]">
                        Receive notifications when an employee requests document or download access
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyAccessRequests}
                      onChange={(e) => {
                        setNotifyAccessRequests(e.target.checked)
                        localStorage.setItem('tv_notify_access', String(e.target.checked))
                        showToast('Notification preference saved', 'info')
                      }}
                      className="size-4 accent-[#14B8A6]"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-[#eef4fa] hover:bg-[#fafcff] cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-[#14213D]">Permission Expiry Reminders</div>
                      <div className="text-[11px] text-[#71829d]">
                        Alert 7 days before temporary document grants expire
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyExpiryWarnings}
                      onChange={(e) => {
                        setNotifyExpiryWarnings(e.target.checked)
                        localStorage.setItem('tv_notify_expiry', String(e.target.checked))
                        showToast('Notification preference saved', 'info')
                      }}
                      className="size-4 accent-[#14B8A6]"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-[#eef4fa] hover:bg-[#fafcff] cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-[#14213D]">Security Anomaly Alerts</div>
                      <div className="text-[11px] text-[#71829d]">
                        Immediate notification on unauthorized document access or failed downloads
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifySecurityAlerts}
                      onChange={(e) => {
                        setNotifySecurityAlerts(e.target.checked)
                        localStorage.setItem('tv_notify_sec', String(e.target.checked))
                        showToast('Notification preference saved', 'info')
                      }}
                      className="size-4 accent-[#14B8A6]"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* VIEWER DASHBOARD CONTENT WHEN IN VIEWER MODE */}
          {enforcedRole === 'VIEWER' && activeNav === 'Shared With Me' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-sm">
                <h3 className="text-sm font-extrabold text-[#14213D]">
                  Documents Shared With You
                </h3>
                <p className="mt-0.5 text-xs text-[#52637f]">
                  Files authorized for your account with active permissions
                </p>

                <div className="mt-4 divide-y divide-[#eef4fa]">
                  {permissions.map((p) => (
                    <div key={p.id} className="py-3.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#14213D]">{p.documentTitle}</div>
                        <div className="text-[11px] text-[#71829d]">
                          Granted by {p.grantedByName} • Level: {p.permissionLevel}
                        </div>
                        <div className="text-[10px] text-[#8ca0c2]">
                          Expires: {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : 'Permanent'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const tokenRes = await api.getDownloadToken(p.documentId)
                              const downloadUrl = api.getDownloadUrl(tokenRes.token)
                              const a = document.createElement('a')
                              a.href = downloadUrl
                              a.download = p.documentTitle
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              showToast('Download started via secure single-use token', 'success')
                            } catch (err: any) {
                              showToast(err.message || 'Download failed or permission expired', 'error')
                            }
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                        >
                          <Download className="size-3.5 text-[#14B8A6]" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {permissions.length === 0 && (
                    <div className="py-8 text-center text-xs text-[#8ca0c2]">
                      No documents currently shared with your account. Submit an access request above.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: CREATE PROJECT (WITH MEMBER ASSIGNMENT & REVIEW)     */}
      {/* ============================================================ */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="size-5 text-[#14B8A6]" />
                <h3 className="text-sm font-extrabold text-[#14213D]">Create New Project</h3>
              </div>
              <button
                onClick={() => setShowCreateProjectModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Stepper Header */}
            <div className="mt-4 flex items-center justify-between border-b border-[#eef4fa] pb-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setProjCreateStep('details')}
                className={`flex-1 text-center py-1 border-b-2 ${
                  projCreateStep === 'details'
                    ? 'border-[#14B8A6] text-[#14B8A6]'
                    : 'border-transparent text-[#8ca0c2]'
                }`}
              >
                1. Project Details
              </button>
              <button
                type="button"
                onClick={() => setProjCreateStep('members')}
                className={`flex-1 text-center py-1 border-b-2 ${
                  projCreateStep === 'members'
                    ? 'border-[#14B8A6] text-[#14B8A6]'
                    : 'border-transparent text-[#8ca0c2]'
                }`}
              >
                2. Team Assignment
              </button>
              <button
                type="button"
                onClick={() => setProjCreateStep('review')}
                className={`flex-1 text-center py-1 border-b-2 ${
                  projCreateStep === 'review'
                    ? 'border-[#14B8A6] text-[#14B8A6]'
                    : 'border-transparent text-[#8ca0c2]'
                }`}
              >
                3. Final Review
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
              {projCreateStep === 'details' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newProjName}
                      onChange={(e) => setNewProjName(e.target.value)}
                      placeholder="e.g. Q4 Security Audit & Migration"
                      className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">Category</label>
                    <select
                      value={newProjCategory}
                      onChange={(e) => setNewProjCategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                    >
                      <option value="Core Operations">Core Operations</option>
                      <option value="Financial">Financial</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Legal & Compliance">Legal & Compliance</option>
                      <option value="Executive Confidential">Executive Confidential</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14213D]">Description</label>
                    <textarea
                      rows={3}
                      value={newProjDesc}
                      onChange={(e) => setNewProjDesc(e.target.value)}
                      placeholder="Objectives and scope of this enterprise workspace..."
                      className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:border-[#243B64] focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newProjName.trim()) {
                          showToast('Project name is required', 'error')
                          return
                        }
                        setProjCreateStep('members')
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm"
                    >
                      <span>Next: Team Members</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {projCreateStep === 'members' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs text-[#243B64]">
                    <strong>Notice:</strong> Assign project responsibilities to existing employees. Project membership does NOT grant document access.
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#14213D]">
                      Select Employee to Add
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        id="empSelect"
                        className="flex-1 rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.email}>
                            {emp.fullName} ({emp.email})
                          </option>
                        ))}
                      </select>
                      <select
                        id="respSelect"
                        className="rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs font-semibold text-[#14213D] focus:outline-none"
                      >
                        <option value="Project Contributor">Project Contributor</option>
                        <option value="Project Reviewer">Project Reviewer</option>
                        <option value="Project Lead">Project Lead</option>
                        <option value="Project Viewer">Project Viewer</option>
                        <option value="Project Observer">Project Observer</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const empSel = document.getElementById('empSelect') as HTMLSelectElement
                          const respSel = document.getElementById('respSelect') as HTMLSelectElement
                          if (empSel && respSel) {
                            const email = empSel.value
                            const responsibility = respSel.value
                            if (!newProjSelectedMembers.find((m) => m.email === email)) {
                              setNewProjSelectedMembers([
                                ...newProjSelectedMembers,
                                { email, responsibility },
                              ])
                            }
                          }
                        }}
                        className="rounded-xl bg-[#243B64] px-3 py-2 text-xs font-bold text-white hover:bg-[#14213D]"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* List of currently selected members */}
                  <div className="mt-3 divide-y divide-[#eef4fa] rounded-xl border border-[#d8e2ef] bg-[#fafcff] p-2 max-h-40 overflow-y-auto">
                    {newProjSelectedMembers.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 px-2 text-xs">
                        <div>
                          <span className="font-bold text-[#14213D]">{m.email}</span>
                          <span className="ml-2 rounded bg-[#EAF0F8] px-1.5 py-0.5 text-[10px] text-[#243B64]">
                            {m.responsibility}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setNewProjSelectedMembers(
                              newProjSelectedMembers.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    {newProjSelectedMembers.length === 0 && (
                      <div className="py-4 text-center text-xs text-[#8ca0c2]">
                        No members selected yet. You can also assign members after creation.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setProjCreateStep('details')}
                      className="rounded-xl border border-[#d8e2ef] px-4 py-2 text-xs font-bold text-[#52637f]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjCreateStep('review')}
                      className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm"
                    >
                      <span>Next: Review</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {projCreateStep === 'review' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="rounded-xl border border-[#eef4fa] bg-[#fafcff] p-4 text-xs space-y-2">
                    <div>
                      <span className="font-bold text-[#8ca0c2]">PROJECT NAME:</span>
                      <div className="font-extrabold text-[#14213D] text-sm">{newProjName}</div>
                    </div>
                    <div>
                      <span className="font-bold text-[#8ca0c2]">CATEGORY:</span>
                      <div className="text-[#243B64] font-semibold">{newProjCategory}</div>
                    </div>
                    {newProjDesc && (
                      <div>
                        <span className="font-bold text-[#8ca0c2]">DESCRIPTION:</span>
                        <div className="text-[#52637f]">{newProjDesc}</div>
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-[#8ca0c2]">INITIAL TEAM ASSIGNMENT:</span>
                      <div className="text-[#14213D] font-semibold">
                        {newProjSelectedMembers.length} member(s) assigned
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900 font-medium">
                    ✓ Permissions Check: Separate document-level READ/EDIT permissions will be required for any files stored in this workspace.
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setProjCreateStep('members')}
                      className="rounded-xl border border-[#d8e2ef] px-4 py-2 text-xs font-bold text-[#52637f]"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center gap-2 rounded-xl bg-[#14213D] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#243B64]"
                    >
                      <Check className="size-4 text-[#14B8A6]" />
                      <span>{loading ? 'Creating Project...' : 'Confirm & Create Project'}</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: PROJECT DETAIL VIEW                                 */}
      {/* ============================================================ */}
      {showProjectDetailModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <div>
                <span className="rounded bg-[#EAF0F8] px-2 py-0.5 text-[10px] font-bold text-[#243B64]">
                  {selectedProject.category || 'Project Workspace'}
                </span>
                <h3 className="text-base font-extrabold text-[#14213D] mt-1">
                  {selectedProject.name}
                </h3>
              </div>
              <button
                onClick={() => setShowProjectDetailModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 5 Project Tabs */}
            <div className="flex items-center gap-2 border-b border-[#eef4fa] pt-3 text-xs font-bold">
              {(['overview', 'members', 'files', 'permissions', 'activity'] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setProjectDetailTab(tab)}
                    className={`capitalize py-2 px-3 border-b-2 transition ${
                      projectDetailTab === tab
                        ? 'border-[#14B8A6] text-[#14213D]'
                        : 'border-transparent text-[#8ca0c2] hover:text-[#52637f]'
                    }`}
                  >
                    {tab}
                  </button>
                )
              )}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {projectDetailTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="rounded-xl border border-[#eef4fa] bg-[#fafcff] p-4 space-y-3">
                    <div>
                      <span className="font-bold text-[#8ca0c2]">DESCRIPTION</span>
                      <p className="mt-1 text-[#52637f]">
                        {selectedProject.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div>
                        <span className="font-bold text-[#8ca0c2]">DOCUMENTS</span>
                        <div className="text-sm font-black text-[#14213D]">
                          {selectedProject.documentCount}
                        </div>
                      </div>
                      <div>
                        <span className="font-bold text-[#8ca0c2]">TEAM MEMBERS</span>
                        <div className="text-sm font-black text-[#14213D]">
                          {projectMembers.length || selectedProject.memberCount}
                        </div>
                      </div>
                      <div>
                        <span className="font-bold text-[#8ca0c2]">CREATED</span>
                        <div className="text-sm font-bold text-[#14213D]">
                          {new Date(selectedProject.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-[#243B64]">
                    <strong>Defense Enforcement: </strong>
                    Employees assigned to this project have defined collaboration responsibilities. They cannot access documents inside this project until you explicitly assign READ or EDIT permission grants.
                  </div>
                </div>
              )}

              {projectDetailTab === 'members' && (
                <div className="space-y-4">
                  {/* Add Member Form */}
                  <form onSubmit={handleAddProjectMember} className="flex items-center gap-2">
                    <input
                      type="email"
                      required
                      placeholder="Add member by email..."
                      value={addMemberEmail}
                      onChange={(e) => setAddMemberEmail(e.target.value)}
                      className="flex-1 rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                    />
                    <select
                      value={addMemberResp}
                      onChange={(e) => setAddMemberResp(e.target.value)}
                      className="rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs font-semibold text-[#14213D] focus:outline-none"
                    >
                      <option value="Project Contributor">Contributor</option>
                      <option value="Project Reviewer">Reviewer</option>
                      <option value="Project Lead">Project Lead</option>
                      <option value="Project Viewer">Project Viewer</option>
                      <option value="Project Observer">Observer</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                    >
                      Add Member
                    </button>
                  </form>

                  {/* Member List */}
                  <div className="divide-y divide-[#f2f6fb] rounded-xl border border-[#d8e2ef] bg-white overflow-hidden text-xs">
                    {projectMembers.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3">
                        <div>
                          <div className="font-bold text-[#14213D]">{m.fullName || m.userEmail}</div>
                          <div className="text-[11px] text-[#8ca0c2]">{m.userEmail}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-md bg-[#EAF0F8] px-2 py-0.5 text-[10px] font-bold text-[#243B64]">
                            {m.responsibility}
                          </span>
                          <button
                            onClick={() => handleRemoveProjectMember(m.id, m.userEmail)}
                            className="text-red-500 hover:text-red-700 font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {projectMembers.length === 0 && (
                      <div className="p-6 text-center text-[#8ca0c2]">
                        No members assigned yet. Use the form above to add project contributors.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {projectDetailTab === 'files' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#14213D]">
                      Project Documents (
                      {documents.filter((d) => d.projectId === selectedProject.id).length})
                    </span>
                    <button
                      onClick={() => {
                        setUploadProjectId(selectedProject.id)
                        setShowUploadModal(true)
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                    >
                      <Upload className="size-3 text-[#14B8A6]" />
                      <span>Upload to Project</span>
                    </button>
                  </div>

                  <div className="divide-y divide-[#f2f6fb] rounded-xl border border-[#d8e2ef] bg-white overflow-hidden">
                    {documents
                      .filter((d) => d.projectId === selectedProject.id)
                      .map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3">
                          <div>
                            <div className="font-bold text-[#14213D]">{doc.title}</div>
                            <div className="text-[11px] text-[#8ca0c2]">
                              {doc.formattedSize} • {doc.category}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownloadDocument(doc)}
                            className="rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 hover:bg-teal-100"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    {documents.filter((d) => d.projectId === selectedProject.id).length === 0 && (
                      <div className="p-6 text-center text-[#8ca0c2]">
                        No documents associated with this project yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {projectDetailTab === 'permissions' && (
                <div className="space-y-3 text-xs">
                  <div className="font-bold text-[#14213D]">Document Permissions in this Project</div>
                  <div className="divide-y divide-[#f2f6fb] rounded-xl border border-[#d8e2ef] bg-white overflow-hidden">
                    {permissions
                      .filter((p) => {
                        const doc = documents.find((d) => d.id === p.documentId)
                        return doc?.projectId === selectedProject.id
                      })
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3">
                          <div>
                            <div className="font-bold text-[#14213D]">{p.documentTitle}</div>
                            <div className="text-[11px] text-[#8ca0c2]">
                              Granted to: {p.userEmail} ({p.permissionLevel})
                            </div>
                          </div>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              p.status === 'ACTIVE'
                                ? 'bg-teal-50 text-teal-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {projectDetailTab === 'activity' && (
                <div className="space-y-3 text-xs">
                  <div className="font-bold text-[#14213D]">Project Audit Events</div>
                  <div className="divide-y divide-[#f2f6fb] rounded-xl border border-[#d8e2ef] bg-white overflow-hidden">
                    {auditLogs
                      .filter((l) => l.resourceId === selectedProject.id)
                      .map((l) => (
                        <div key={l.id} className="p-3 text-[11px]">
                          <div className="font-bold text-[#14213D]">{l.action}</div>
                          <div className="text-[#52637f]">{l.reason}</div>
                          <div className="text-[#8ca0c2] text-[10px]">
                            {new Date(l.timestamp).toLocaleString()} • {l.actorEmail}
                          </div>
                        </div>
                      ))}
                    {auditLogs.filter((l) => l.resourceId === selectedProject.id).length === 0 && (
                      <div className="p-6 text-center text-[#8ca0c2]">
                        No specific audit logs for this project ID.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: UPLOAD DOCUMENT                                     */}
      {/* ============================================================ */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="size-5 text-[#14B8A6]" />
                <h3 className="text-sm font-extrabold text-[#14213D]">Upload Secure Document</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#14213D]">Select File *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setUploadFile(f)
                      if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ''))
                    }
                  }}
                  className="mt-1 w-full text-xs text-[#52637f] file:mr-3 file:rounded-xl file:border-0 file:bg-[#EAF0F8] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#243B64] hover:file:bg-[#243B64] hover:file:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">Document Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Master Services Agreement 2025"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#14213D]">Category</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                  >
                    <option value="Contracts">Contracts</option>
                    <option value="Financials">Financials</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Legal">Legal</option>
                    <option value="Reports">Reports</option>
                    <option value="HR">HR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14213D]">Project Workspace</label>
                  <select
                    value={uploadProjectId}
                    onChange={(e) => setUploadProjectId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                  >
                    <option value="">None (Unassigned)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Initial Permission Grant */}
              <div className="rounded-xl border border-[#eef4fa] bg-[#fafcff] p-3 space-y-2">
                <span className="text-[11px] font-bold text-[#243B64]">
                  Optional Initial Recipient Access
                </span>
                <input
                  type="email"
                  placeholder="Employee email (e.g. viewer@trustvault.local)"
                  value={uploadRecipientEmail}
                  onChange={(e) => setUploadRecipientEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#d8e2ef] bg-white px-2.5 py-1.5 text-xs text-[#14213D] focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={uploadRecipientPerm}
                    onChange={(e) => setUploadRecipientPerm(e.target.value as any)}
                    className="rounded-lg border border-[#d8e2ef] bg-white px-2 py-1 text-xs text-[#14213D]"
                  >
                    <option value="READ">READ (View/Download)</option>
                    <option value="EDIT">EDIT (Modify)</option>
                  </select>
                  <select
                    value={uploadRecipientExpiry}
                    onChange={(e) => setUploadRecipientExpiry(e.target.value)}
                    className="rounded-lg border border-[#d8e2ef] bg-white px-2 py-1 text-xs text-[#14213D]"
                  >
                    <option value="7">Expires in 7 days</option>
                    <option value="30">Expires in 30 days</option>
                    <option value="90">Expires in 90 days</option>
                    <option value="never">Permanent (No expiry)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-xl border border-[#d8e2ef] px-4 py-2 text-xs font-bold text-[#52637f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  <Upload className="size-3.5 text-[#14B8A6]" />
                  <span>{loading ? 'Uploading...' : 'Upload & Encrypt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: ASSIGN / GRANT PERMISSION                            */}
      {/* ============================================================ */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <div className="flex items-center gap-2">
                <LockKeyhole className="size-5 text-[#14B8A6]" />
                <h3 className="text-sm font-extrabold text-[#14213D]">Assign Document Permission</h3>
              </div>
              <button
                onClick={() => setShowGrantModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleGrantPermission} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#14213D]">Document *</label>
                <select
                  required
                  value={grantDocId}
                  onChange={(e) => setGrantDocId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                >
                  <option value="">Select Document...</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.formattedSize})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">Employee Email *</label>
                <input
                  type="email"
                  required
                  value={grantUserEmail}
                  onChange={(e) => setGrantUserEmail(e.target.value)}
                  placeholder="e.g. viewer@trustvault.local"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#14213D]">Permission Level</label>
                  <select
                    value={grantPermLevel}
                    onChange={(e) => setGrantPermLevel(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                  >
                    <option value="READ">READ (View/Download)</option>
                    <option value="EDIT">EDIT (Modify Document)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14213D]">Expiry Duration</label>
                  <select
                    value={grantExpiryDays}
                    onChange={(e) => setGrantExpiryDays(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                  >
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="never">Permanent (No expiry)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="rounded-xl border border-[#d8e2ef] px-4 py-2 text-xs font-bold text-[#52637f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  {loading ? 'Granting...' : 'Grant Permission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: UPDATE PERMISSION                                    */}
      {/* ============================================================ */}
      {showUpdatePermModal && selectedPerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <h3 className="text-sm font-extrabold text-[#14213D]">Modify Permission Grant</h3>
              <button
                onClick={() => setShowUpdatePermModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePermission} className="mt-4 space-y-4">
              <div className="rounded-xl bg-[#fafcff] border border-[#eef4fa] p-3 text-xs space-y-1">
                <div>
                  <span className="font-bold text-[#8ca0c2]">DOCUMENT:</span>{' '}
                  <span className="font-bold text-[#14213D]">{selectedPerm.documentTitle}</span>
                </div>
                <div>
                  <span className="font-bold text-[#8ca0c2]">EMPLOYEE:</span>{' '}
                  <span className="font-bold text-[#14213D]">{selectedPerm.userEmail}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">Permission Level</label>
                <select
                  value={updatePermLevel}
                  onChange={(e) => setUpdatePermLevel(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                >
                  <option value="READ">READ (View/Download)</option>
                  <option value="EDIT">EDIT (Modify Document)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  Expiration Timestamp (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={updatePermExpiry}
                  onChange={(e) => setUpdatePermExpiry(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
                <span className="text-[10px] text-[#8ca0c2]">
                  Leave blank for permanent access until manually revoked.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpdatePermModal(false)}
                  className="rounded-xl border border-[#d8e2ef] px-4 py-2 text-xs font-bold text-[#52637f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 6: REVIEW ACCESS REQUEST                                */}
      {/* ============================================================ */}
      {showReviewAccessModal && selectedAccessReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <h3 className="text-sm font-extrabold text-[#14213D]">Review Access Request</h3>
              <button
                onClick={() => setShowReviewAccessModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl bg-[#fafcff] border border-[#eef4fa] p-3 space-y-1.5">
                <div>
                  <span className="font-bold text-[#8ca0c2]">REQUESTER:</span>{' '}
                  <span className="font-bold text-[#14213D]">
                    {selectedAccessReq.requesterName} ({selectedAccessReq.requesterEmail})
                  </span>
                </div>
                <div>
                  <span className="font-bold text-[#8ca0c2]">DOCUMENT:</span>{' '}
                  <span className="font-bold text-[#14213D]">{selectedAccessReq.documentTitle}</span>
                </div>
                <div>
                  <span className="font-bold text-[#8ca0c2]">REQUESTED LEVEL:</span>{' '}
                  <span className="rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 font-bold">
                    {selectedAccessReq.requestedPermission}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-[#8ca0c2]">BUSINESS REASON:</span>
                  <p className="mt-0.5 text-[#52637f] italic">{selectedAccessReq.reason}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  If Approved: Grant Expiration
                </label>
                <select
                  value={reviewExpiryDays}
                  onChange={(e) => setReviewExpiryDays(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                >
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="never">Permanent (No expiry)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  Review Note (Optional)
                </label>
                <input
                  type="text"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Approved for sprint audit"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleReviewAccess(false)}
                  disabled={loading}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  Reject Request
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAccess(true)}
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  Approve & Grant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 7: REVIEW RENEWAL REQUEST                               */}
      {/* ============================================================ */}
      {showReviewRenewalModal && selectedRenewalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <h3 className="text-sm font-extrabold text-[#14213D]">Review Renewal & Extension</h3>
              <button
                onClick={() => setShowReviewRenewalModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl bg-[#fafcff] border border-[#eef4fa] p-3 space-y-1.5">
                <div>
                  <span className="font-bold text-[#8ca0c2]">REQUESTER:</span>{' '}
                  <span className="font-bold text-[#14213D]">
                    {selectedRenewalReq.requesterName} ({selectedRenewalReq.requesterEmail})
                  </span>
                </div>
                <div>
                  <span className="font-bold text-[#8ca0c2]">DOCUMENT:</span>{' '}
                  <span className="font-bold text-[#14213D]">{selectedRenewalReq.documentTitle}</span>
                </div>
                <div>
                  <span className="font-bold text-[#8ca0c2]">REQUESTED EXTENSION:</span>{' '}
                  <span className="font-bold text-[#243B64]">
                    +{selectedRenewalReq.requestedExtensionDays} Days
                  </span>
                </div>
                <div>
                  <span className="font-bold text-[#8ca0c2]">REASON:</span>
                  <p className="mt-0.5 text-[#52637f] italic">{selectedRenewalReq.reason}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">Review Note</label>
                <input
                  type="text"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Optional review note..."
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleReviewRenewal(false)}
                  disabled={loading}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  Reject Renewal
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewRenewal(true)}
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  Approve Extension
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 8: INVITE EMPLOYEE                                      */}
      {/* ============================================================ */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-[#14B8A6]" />
                <h3 className="text-sm font-extrabold text-[#14213D]">Invite Enterprise Employee</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleInviteEmployee} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#14213D]">Full Name *</label>
                <input
                  type="text"
                  required
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="e.g. Jordan Miller"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">Company Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  Temporary Provisioning Password
                </label>
                <input
                  type="text"
                  required
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">Role Assignment</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                >
                  <option value="ROLE_VIEWER">Viewer (Standard Employee)</option>
                  <option value="ROLE_OWNER">Manager</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-xl border border-[#d8e2ef] px-4 py-2 text-xs font-bold text-[#52637f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  {loading ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 9: CREATE GROUP                                         */}
      {/* ============================================================ */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <h3 className="text-sm font-extrabold text-[#14213D]">Create Team / Department Group</h3>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#14213D]">Group Name *</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Core Engineering"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">Department</label>
                <input
                  type="text"
                  value={groupDept}
                  onChange={(e) => setGroupDept(e.target.value)}
                  placeholder="e.g. Technology & Product"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">Description</label>
                <textarea
                  rows={2}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Organizational group mission and scope..."
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  Initial Member Emails (comma-separated)
                </label>
                <input
                  type="text"
                  value={groupMemberEmails}
                  onChange={(e) => setGroupMemberEmails(e.target.value)}
                  placeholder="viewer@trustvault.local, alex@trustvault.local"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="rounded-xl border border-[#d8e2ef] px-4 py-2 text-xs font-bold text-[#52637f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 10: AUDIT LOG DETAILS (INSPECT CRYPTOGRAPHIC HASHES)   */}
      {/* ============================================================ */}
      {showAuditDetailModal && selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="size-5 text-[#14B8A6]" />
                <h3 className="text-sm font-extrabold text-[#14213D]">Audit Record Details</h3>
              </div>
              <button
                onClick={() => setShowAuditDetailModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl bg-[#fafcff] border border-[#eef4fa] p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-bold text-[#8ca0c2]">ACTION</span>
                    <div className="font-extrabold text-[#14213D]">{selectedAuditLog.action}</div>
                  </div>
                  <div>
                    <span className="font-bold text-[#8ca0c2]">OUTCOME</span>
                    <div
                      className={`font-bold ${
                        selectedAuditLog.result === 'SUCCESS' ? 'text-teal-600' : 'text-red-600'
                      }`}
                    >
                      {selectedAuditLog.result === 'SUCCESS' ? 'ALLOWED' : 'DENIED'}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-[#8ca0c2]">ACTOR</span>
                  <div className="text-[#14213D]">
                    {selectedAuditLog.actorEmail} ({selectedAuditLog.actorRole})
                  </div>
                </div>

                <div>
                  <span className="font-bold text-[#8ca0c2]">TIMESTAMP (UTC)</span>
                  <div className="text-[#14213D]">{selectedAuditLog.timestamp}</div>
                </div>

                <div>
                  <span className="font-bold text-[#8ca0c2]">IP ADDRESS & AGENT</span>
                  <div className="text-[#52637f]">
                    {selectedAuditLog.ipAddress || '127.0.0.1'} • {selectedAuditLog.userAgent}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-[#8ca0c2]">REASON / CONTEXT</span>
                  <div className="text-[#14213D]">{selectedAuditLog.reason}</div>
                </div>
              </div>

              {/* Cryptographic Hashes */}
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 space-y-2">
                <span className="text-[11px] font-bold text-teal-900">
                  Cryptographic SHA-256 Ledger Link
                </span>
                <div>
                  <span className="text-[10px] font-bold text-[#71829d]">PREVIOUS RECORD HASH</span>
                  <div className="font-mono text-[10px] text-[#243B64] break-all">
                    {selectedAuditLog.previousHash}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#71829d]">CURRENT RECORD HASH</span>
                  <div className="font-mono text-[10px] text-[#14B8A6] font-bold break-all">
                    {selectedAuditLog.currentHash}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowAuditDetailModal(false)}
                  className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 11: VIEWER REQUEST ACCESS                              */}
      {/* ============================================================ */}
      {showRequestAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <h3 className="text-sm font-extrabold text-[#14213D]">Request Document Access</h3>
              <button
                onClick={() => setShowRequestAccessModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleViewerRequestAccess} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#14213D]">Select Document *</label>
                <select
                  required
                  value={reqAccessDocId}
                  onChange={(e) => setReqAccessDocId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                >
                  <option value="">Choose document...</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.formattedSize})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  Requested Permission Level
                </label>
                <select
                  value={reqAccessLevel}
                  onChange={(e) => setReqAccessLevel(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                >
                  <option value="READ">READ (View and Download)</option>
                  <option value="EDIT">EDIT (Modify Document)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  Business Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reqAccessReason}
                  onChange={(e) => setReqAccessReason(e.target.value)}
                  placeholder="Explain why you require access to this document..."
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestAccessModal(false)}
                  className="rounded-xl border border-[#d8e2ef] px-4 py-2 text-xs font-bold text-[#52637f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 12: VIEWER REQUEST RENEWAL                             */}
      {/* ============================================================ */}
      {showRequestRenewalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3">
              <h3 className="text-sm font-extrabold text-[#14213D]">Request Permission Extension</h3>
              <button
                onClick={() => setShowRequestRenewalModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleViewerRequestRenewal} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  Select Expiring Permission *
                </label>
                <select
                  required
                  value={reqRenewalPermId}
                  onChange={(e) => setReqRenewalPermId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                >
                  <option value="">Choose expiring permission...</option>
                  {permissions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.documentTitle} (Expires: {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : 'Permanent'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  Extension Duration
                </label>
                <select
                  value={reqRenewalDays}
                  onChange={(e) => setReqRenewalDays(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                >
                  <option value="14">+14 Days</option>
                  <option value="30">+30 Days</option>
                  <option value="60">+60 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D]">
                  Renewal Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reqRenewalReason}
                  onChange={(e) => setReqRenewalReason(e.target.value)}
                  placeholder="Explain why you require extended access..."
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestRenewalModal(false)}
                  className="rounded-xl border border-[#d8e2ef] px-4 py-2 text-xs font-bold text-[#52637f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#14213D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#243B64]"
                >
                  {loading ? 'Submitting...' : 'Submit Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
