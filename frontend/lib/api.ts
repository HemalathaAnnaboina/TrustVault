const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

export interface UserProfile {
  id: string
  email: string
  fullName: string
  role: 'ROLE_ADMIN' | 'ROLE_OWNER' | 'ROLE_MANAGER' | 'ROLE_VIEWER' | 'ROLE_WORKSHOP_MEMBER' | 'ROLE_EDITOR'
  active: boolean
  createdAt?: string
  passwordLastChangedAt?: string
  lastLoginAt?: string | null
}

export interface UploadDocumentPayload {
  file: File
  title?: string
  category?: string
  projectId?: string
}

export interface DocumentItem {
  id: string
  title: string
  originalFilename: string
  category: string
  contentType: string
  fileSizeBytes: number
  formattedSize: string
  sha256Checksum: string
  ownerId: string
  ownerName: string
  ownerEmail: string
  projectId: string | null
  projectName: string | null
  userAccessLevel: 'OWNER' | 'EDIT' | 'READ' | 'NONE' | 'REVOKED' | 'EXPIRED' | 'SUSPENDED'
  canRead?: boolean
  canEdit?: boolean
  expiresAt: string | null
  isExpiringSoon: boolean
  createdAt: string
  updatedAt: string
}


export interface ManagerStats {
  totalProjects: number
  vaultDocuments: number
  activeTeamMembers: number
  pendingRequests: number
  expiringPermissions: number
  securityEvents: number
}

export interface MemberAllocationPayload {
  userEmail: string
  responsibility?: string
  canView?: boolean
  canEdit?: boolean
}

export interface DocumentPermissionAssignmentPayload {
  documentId?: string
  documentTitle?: string
  userEmail: string
  permissionLevel: 'READ' | 'EDIT' | 'DOWNLOAD'
  expiresAt?: string | null
}

export interface CreateProjectPayload {
  name: string
  description?: string
  groupId?: string | null
  category?: string | null
  status?: string
  members?: MemberAllocationPayload[]
  existingDocumentIds?: string[]
  permissions?: DocumentPermissionAssignmentPayload[]
}

export interface ProjectItem {
  id: string
  name: string
  description: string
  ownerId: string
  ownerName: string
  groupId: string | null
  groupName: string | null
  category: string | null
  status?: string
  documentCount: number
  memberCount: number
  createdAt: string
}

export interface ProjectMemberItem {
  id: string
  userId: string
  userEmail: string
  fullName: string
  responsibility: string
  active: boolean
  addedAt: string
  canView?: boolean
  canEdit?: boolean
  roleLabel?: string
  status?: 'ACTIVE' | 'SUSPENDED' | string
  suspendedAt?: string | null
  accessibleDocumentCount?: number
}

export interface GroupItem {
  id: string
  name: string
  description: string
  department: string
  ownerId: string
  ownerName: string
  memberCount: number
  createdAt: string
  updatedAt: string
  members?: GroupMemberItem[]
}

export interface GroupMemberItem {
  id: string
  userId: string
  email: string
  fullName: string
  addedAt: string
}

export interface EmployeeDirectoryItem {
  id: string
  email: string
  fullName: string
  role: 'ROLE_ADMIN' | 'ROLE_OWNER' | 'ROLE_MANAGER' | 'ROLE_VIEWER' | 'ROLE_WORKSHOP_MEMBER'
  active: boolean
  groups: string[]
  assignedProjectsCount: number
  activePermissionsCount: number
  createdAt: string
}

export interface PermissionItem {
  id: string
  documentId: string
  documentTitle: string
  userId: string
  userEmail: string
  userName: string
  permissionLevel: 'READ' | 'EDIT'
  grantedById: string
  grantedByName: string
  grantedAt: string
  expiresAt: string | null
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  isExpired: boolean
}

export interface BulkAssignment {
  userEmail: string
  permissionLevel: 'READ' | 'EDIT'
  expiresAt?: string | null
}

export interface BulkGrantResultItem {
  documentId: string
  documentTitle: string
  userEmail: string
  permissionLevel: 'READ' | 'EDIT'
  success: boolean
  message: string
  permission?: PermissionItem
}

export interface BulkGrantResponse {
  totalProcessed: number
  successful: number
  failed: number
  results: BulkGrantResultItem[]
}


export interface DocumentVersionItem {
  id: string
  documentId: string
  versionNumber: number
  title: string
  contentType: string
  fileSizeBytes: number
  formattedSize: string
  sha256Checksum: string
  changeSummary?: string | null
  createdById: string
  createdByName: string
  createdAt: string
}

export interface DocumentPreviewItem {
  documentId: string
  title: string
  originalFilename: string
  contentType: string
  isTextEditable: boolean
  isPreviewSupported: boolean
  textContent?: string | null
  message?: string | null
  version: number
  userAccessLevel: string
}

export interface AccessRequestItem {
  id: string
  documentId?: string | null
  documentTitle?: string | null
  projectId?: string | null
  projectName?: string | null
  requestedFilename?: string | null
  durationDays?: number
  requesterId: string
  requesterEmail: string
  requesterName: string
  requestedPermission: 'READ' | 'EDIT'
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  reviewedById: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNote: string | null
}

export interface RenewalRequestItem {
  id: string
  permissionId: string
  documentId: string
  documentTitle: string
  requesterId: string
  requesterEmail: string
  requesterName: string
  currentExpiresAt: string | null
  reason: string
  requestedExtensionDays: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  reviewedById: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNote: string | null
}

export interface AuditLogItem {
  id: string
  timestamp: string
  actorId: string | null
  actorEmail: string
  actorRole: string
  action: string
  resourceType: string
  resourceId: string
  result: 'SUCCESS' | 'DENIED' | 'ALLOWED' | string
  reason: string
  ipAddress: string
  userAgent: string
  previousHash: string
  currentHash: string
}

export interface AuditVerificationResult {
  valid: boolean
  totalRecords: number
  verifiedCount: number
  brokenRecordId: string | null
  message: string
}

export interface UserManagementItem {
  id: string
  email: string
  fullName: string
  role: 'ROLE_ADMIN' | 'ROLE_OWNER' | 'ROLE_MANAGER' | 'ROLE_VIEWER' | 'ROLE_WORKSHOP_MEMBER' | string
  active: boolean
  createdAt: string
  projectNames?: string[]
}

export interface StatsItem {
  title: string
  value: string
  change: string
  icon: string
  color: string
}

export interface RoleStats {
  role: string
  stats: StatsItem[]
  summary: Record<string, any>
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('trustvault_token')
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('trustvault_token', token)
  }
}

export function getUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const item = localStorage.getItem('trustvault_user');
  try { return item ? JSON.parse(item) : null; } catch { return null; }
}

export function logout() {
  removeToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('trustvault_token')
    localStorage.removeItem('trustvault_user')
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`
    try {
      const errJson = await res.json()
      if (errJson && errJson.message) {
        errorMsg = errJson.message
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg)
  }

  if (res.status === 204) {
    return {} as T
  }

  return res.json()
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const data = await request<{
      token: string
      id: string
      email: string
      fullName: string
      role: 'ROLE_ADMIN' | 'ROLE_OWNER' | 'ROLE_MANAGER' | 'ROLE_VIEWER' | 'ROLE_WORKSHOP_MEMBER'
      active: boolean
    }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setToken(data.token)
    if (typeof window !== 'undefined') {
      localStorage.setItem('trustvault_user', JSON.stringify(data))
    }
    return data
  },

  async getMe(): Promise<UserProfile> {
    const data = await request<UserProfile>('/auth/me')
    if (typeof window !== 'undefined' && data) {
      const existing = getUser() || {}
      localStorage.setItem('trustvault_user', JSON.stringify({ ...existing, ...data }))
    }
    return data
  },

  async updateProfile(fullName: string): Promise<UserProfile> {
    const data = await request<UserProfile>('/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName }),
    })
    if (typeof window !== 'undefined' && data) {
      const existing = getUser() || {}
      localStorage.setItem('trustvault_user', JSON.stringify({ ...existing, ...data }))
    }
    return data
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldPassword: currentPassword,
        currentPassword: currentPassword,
        newPassword: newPassword,
      }),
    })
  },

  // Documents
  async getDocuments(query?: string, projectId?: string): Promise<DocumentItem[]> {
    const params = new URLSearchParams()
    if (query && query.trim()) params.append('query', query.trim())
    if (projectId && projectId.trim()) params.append('projectId', projectId.trim())
    const q = params.toString() ? '?' + params.toString() : ''
    return request<DocumentItem[]>('/documents' + q)
  },

  async getDocumentPreview(id: string): Promise<DocumentPreviewItem> {
    return request<DocumentPreviewItem>(`/documents/${id}/preview`)
  },

  async getDocumentVersions(id: string): Promise<DocumentVersionItem[]> {
    return request<DocumentVersionItem[]>(`/documents/${id}/versions`)
  },
  async getDocument(id: string): Promise<DocumentItem> {
    return request<DocumentItem>(`/documents/${id}`)
  },

  async uploadDocument(data: FormData | UploadDocumentPayload): Promise<DocumentItem> {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    let formData: FormData
    if (data instanceof FormData) {
      formData = data
    } else {
      formData = new FormData()
      formData.append('file', data.file)
      if (data.title && data.title.trim()) {
        formData.append('title', data.title.trim())
      }
      if (data.category && data.category.trim()) {
        formData.append('category', data.category.trim())
      }
      if (data.projectId && data.projectId.trim()) {
        formData.append('projectId', data.projectId.trim())
      }
    }
    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `Upload failed with status ${res.status}`)
    }
    return res.json()
  },

  async updateDocument(id: string, data: { title: string; category?: string }): Promise<DocumentItem> {
    return request<DocumentItem>(`/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  async updateDocumentMetadata(id: string, data: { title: string; category?: string }): Promise<DocumentItem> {
    return this.updateDocument(id, data)
  },

  async deleteDocument(id: string): Promise<void> {
    return request<void>(`/documents/${id}`, {
      method: 'DELETE',
    })
  },

  async getDownloadToken(id: string): Promise<{ token: string; downloadUrl: string; expiresAt: string }> {
    return request<{ token: string; downloadUrl: string; expiresAt: string }>(`/documents/${id}/download-token`, {
      method: 'POST',
    })
  },

  getDownloadUrl(token: string): string {
    return `${API_BASE}/documents/download/${token}`
  },

  async getDocumentDownload(id: string, filename?: string): Promise<void> {
    const tokenRes = await this.getDownloadToken(id)
    const downloadUrl = this.getDownloadUrl(tokenRes.token)
    if (typeof window !== 'undefined') {
      const a = document.createElement('a')
      a.href = downloadUrl
      if (filename) a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  },

  // Permissions
  async getDocumentPermissions(documentId: string): Promise<PermissionItem[]> {
    return request<PermissionItem[]>(`/documents/${documentId}/permissions`)
  },

  async getMyPermissions(): Promise<PermissionItem[]> {
    return request<PermissionItem[]>('/permissions/my')
  },

  async getOwnerPermissions(): Promise<PermissionItem[]> {
    return request<PermissionItem[]>('/permissions/owner')
  },

  async grantPermission(documentId: string, data: { userEmail: string; permissionLevel: 'READ' | 'EDIT'; expiresAt?: string | null }): Promise<PermissionItem> {
    return request<PermissionItem>(`/documents/${documentId}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  async grantDocumentPermission(documentId: string, data: { userEmail: string; permissionLevel: 'READ' | 'EDIT'; expiresAt?: string | null }): Promise<PermissionItem> {
    return this.grantPermission(documentId, data)
  },

  async updatePermission(permissionId: string, data: { permissionLevel: 'READ' | 'EDIT'; expiresAt?: string | null }): Promise<PermissionItem> {
    return request<PermissionItem>(`/permissions/${permissionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  async revokePermission(permissionId: string): Promise<void> {
    return request<void>(`/permissions/${permissionId}`, {
      method: 'DELETE',
    })
  },

  async bulkGrantPermissions(data: { documentIds: string[]; assignments: BulkAssignment[] }): Promise<BulkGrantResponse> {
    return request<BulkGrantResponse>('/permissions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  // Projects
  async getProjects(): Promise<ProjectItem[]> {
    return request<ProjectItem[]>('/projects')
  },

  async getProject(id: string): Promise<ProjectItem> {
    return request<ProjectItem>(`/projects/${id}`)
  },

  async createProject(data: CreateProjectPayload): Promise<ProjectItem> {
    return request<ProjectItem>('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  async getManagerStats(): Promise<ManagerStats> {
    return request<ManagerStats>('/projects/stats/manager')
  },

  async suspendProjectMember(projectId: string, memberId: string, reason?: string): Promise<void> {
    return request<void>(`/projects/${projectId}/members/${memberId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'Suspended by project manager' }),
    })
  },

  async reactivateProjectMember(projectId: string, memberId: string): Promise<void> {
    return request<void>(`/projects/${projectId}/members/${memberId}/reactivate`, {
      method: 'POST',
    })
  },

  async updateMemberPermissions(
    projectId: string,
    memberId: string,
    data: { canView?: boolean; canEdit?: boolean; responsibility?: string; status?: string }
  ): Promise<ProjectMemberItem> {
    return request<ProjectMemberItem>(`/projects/${projectId}/members/${memberId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  async shareProjectDocument(
    projectId: string,
    documentId: string,
    assignments: { userEmail: string; permissionLevel: 'READ' | 'EDIT' | 'DOWNLOAD'; expiresAt?: string | null }[]
  ): Promise<void> {
    return request<void>(`/projects/${projectId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, assignments }),
    })
  },

  async deleteProject(id: string): Promise<void> {
    return request<void>(`/projects/${id}`, {
      method: 'DELETE',
    })
  },

  async getProjectMembers(projectId: string): Promise<ProjectMemberItem[]> {
    return request<ProjectMemberItem[]>(`/projects/${projectId}/members`)
  },

  async addProjectMember(projectId: string, userEmail: string, responsibility?: string): Promise<ProjectMemberItem> {
    return request<ProjectMemberItem>(`/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, responsibility: responsibility || 'Contributor' }),
    })
  },

  async removeProjectMember(projectId: string, memberId: string): Promise<void> {
    return request<void>(`/projects/${projectId}/members/${memberId}`, {
      method: 'DELETE',
    })
  },

  // Employees & Directory
  async getEmployees(): Promise<EmployeeDirectoryItem[]> {
    return request<EmployeeDirectoryItem[]>('/users')
  },

  async inviteEmployee(data: { email: string; password?: string; fullName: string; role?: 'ROLE_VIEWER' | 'ROLE_OWNER' | 'ROLE_MANAGER' | 'ROLE_ADMIN' | 'ROLE_WORKSHOP_MEMBER' }): Promise<UserProfile> {
    return request<UserProfile>('/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  // Groups
  async getGroups(): Promise<GroupItem[]> {
    return request<GroupItem[]>('/groups')
  },

  async getGroup(id: string): Promise<GroupItem> {
    return request<GroupItem>(`/groups/${id}`)
  },

  async createGroup(data: { name: string; description?: string; department?: string; memberEmails?: string[] }): Promise<GroupItem> {
    return request<GroupItem>('/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  async updateGroup(id: string, data: { name: string; description?: string; department?: string }): Promise<GroupItem> {
    return request<GroupItem>(`/groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  async deleteGroup(id: string): Promise<void> {
    return request<void>(`/groups/${id}`, {
      method: 'DELETE',
    })
  },

  async addGroupMembers(groupId: string, data: { memberEmails?: string[]; memberUserIds?: string[] }): Promise<GroupItem> {
    return request<GroupItem>(`/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  async removeGroupMember(groupId: string, userId: string): Promise<GroupItem> {
    return request<GroupItem>(`/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    })
  },

  // Access Requests
  async createAccessRequest(data: {
    documentId?: string | null
    projectId?: string | null
    requestedFilename?: string | null
    requestedPermission: 'READ' | 'EDIT'
    durationDays?: number
    reason: string
  }): Promise<AccessRequestItem> {
    const payload: any = {
      requestedPermission: data.requestedPermission,
      reason: data.reason,
      durationDays: data.durationDays || 7,
    }
    if (data.documentId && data.documentId.trim()) payload.documentId = data.documentId.trim()
    if (data.projectId && data.projectId.trim()) payload.projectId = data.projectId.trim()
    if (data.requestedFilename && data.requestedFilename.trim()) payload.requestedFilename = data.requestedFilename.trim()

    return request<AccessRequestItem>('/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },

  async getAccessRequests(): Promise<AccessRequestItem[]> {
    return request<AccessRequestItem[]>('/requests/owner')
  },

  async getOwnerAccessRequests(): Promise<AccessRequestItem[]> {
    return request<AccessRequestItem[]>('/requests/owner')
  },

  async getMyAccessRequests(): Promise<AccessRequestItem[]> {
    return request<AccessRequestItem[]>('/requests/my')
  },

  async reviewAccessRequest(id: string, data: { approved: boolean; reviewNote?: string; reviewerNotes?: string; expiresAt?: string | null; grantedPermission?: 'READ' | 'EDIT' | 'DOWNLOAD'; durationDays?: number }): Promise<AccessRequestItem> {
    return request<AccessRequestItem>(`/requests/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  // Renewal Requests
  async createRenewal(data: { permissionId?: string; documentId?: string; projectId?: string; reason: string; requestedExtensionDays?: number; durationDays?: number }): Promise<RenewalRequestItem> {
    const payload = {
      ...data,
      requestedExtensionDays: data.requestedExtensionDays || data.durationDays || 7,
    }
    return request<RenewalRequestItem>('/renewals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },

  async createRenewalRequest(data: { permissionId?: string; documentId?: string; projectId?: string; reason: string; requestedExtensionDays?: number; durationDays?: number }): Promise<RenewalRequestItem> {
    return this.createRenewal(data)
  },

  async getOwnerRenewals(): Promise<RenewalRequestItem[]> {
    return request<RenewalRequestItem[]>('/renewals/owner')
  },

  async getOwnerRenewalRequests(): Promise<RenewalRequestItem[]> {
    return this.getOwnerRenewals()
  },

  async getMyRenewals(): Promise<RenewalRequestItem[]> {
    return request<RenewalRequestItem[]>('/renewals/my')
  },

  async getMyRenewalRequests(): Promise<RenewalRequestItem[]> {
    return this.getMyRenewals()
  },

  async reviewRenewal(id: string, data: { approved: boolean; reviewNote?: string; extensionDays?: number }): Promise<RenewalRequestItem> {
    return request<RenewalRequestItem>(`/renewals/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  // Audit Logs
  async getMyActivity(): Promise<AuditLogItem[]> {
    return request<AuditLogItem[]>('/audit-logs/my-activity')
  },
  async getAuditLogs(params?: { page?: number; size?: number; action?: string; result?: string; search?: string }): Promise<AuditLogItem[]> {
    const searchParams = new URLSearchParams()
    if (params?.page !== undefined) searchParams.set('page', params.page.toString())
    if (params?.size !== undefined) searchParams.set('size', params.size.toString())
    if (params?.action) searchParams.set('action', params.action)
    if (params?.result) searchParams.set('result', params.result)
    if (params?.search) searchParams.set('search', params.search)
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return request<AuditLogItem[]>(`/audit-logs${qs}`)
  },

  async verifyAuditIntegrity(): Promise<AuditVerificationResult> {
    return request<AuditVerificationResult>('/audit-logs/verify-integrity')
  },

  // Admin Users
  async getAdminUsers(): Promise<UserManagementItem[]> {
    return request<UserManagementItem[]>('/admin/users')
  },

  async createUser(data: { fullName: string; email: string; role: 'ROLE_ADMIN' | 'ROLE_OWNER' | 'ROLE_MANAGER' | 'ROLE_VIEWER' | 'ROLE_WORKSHOP_MEMBER'; password?: string; initialProjectId?: string }): Promise<UserManagementItem> {
    return request<UserManagementItem>('/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  async toggleUserStatus(id: string, active: boolean): Promise<UserManagementItem> {
    return request<UserManagementItem>(`/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
  },

  // Settings
  async getSettings(): Promise<Record<string, any>> {
    return request<Record<string, any>>('/admin/settings')
  },

  async updateSettings(updates: Record<string, any>): Promise<Record<string, any>> {
    return request<Record<string, any>>('/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  },

  // Stats
  async getStats(): Promise<RoleStats> {
    return request<RoleStats>('/stats')
  },
}
