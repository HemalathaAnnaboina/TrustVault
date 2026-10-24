'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Calendar,
  ChevronRight,
  Clock3,
  FileText,
  FolderKanban,
  Info,
  Lock,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  User,
  Users,
  UserPlus,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import {
  api,
  DocumentItem,
  PermissionItem,
  ProjectItem,
  ProjectMemberItem,
  UserManagementItem,
} from '../../../lib/api'

type ProjectDetailTab = 'overview' | 'members' | 'documents' | 'permissions' | 'activity'

export default function ProjectsMonitoringPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null)
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>('overview')

  // Detailed tab data
  const [members, setMembers] = useState<ProjectMemberItem[]>([])
  const [projectDocs, setProjectDocs] = useState<DocumentItem[]>([])
  const [projectPerms, setProjectPerms] = useState<PermissionItem[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Manage Members Modal State
  const [manageMembersProject, setManageMembersProject] = useState<ProjectItem | null>(null)
  const [modalMembers, setModalMembers] = useState<ProjectMemberItem[]>([])
  const [allUsers, setAllUsers] = useState<UserManagementItem[]>([])
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([])
  const [selectedRole, setSelectedRole] = useState('Contributor')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [submittingMembers, setSubmittingMembers] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalSuccess, setModalSuccess] = useState<string | null>(null)

  const loadProjects = async () => {
    setLoading(true)
    try {
      const data = await api.getProjects()
      setProjects(data)
    } catch (err: any) {
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  // Load project details when a project is selected
  useEffect(() => {
    if (!selectedProject) return

    setLoadingDetails(true)
    Promise.all([
      api.getProjectMembers(selectedProject.id).catch(() => []),
      api.getDocuments().catch(() => []),
      api.getOwnerPermissions().catch(() => []),
    ])
      .then(([m, allDocs, allPerms]) => {
        setMembers(m)
        const docsInProject = allDocs.filter((d) => d.projectId === selectedProject.id)
        setProjectDocs(docsInProject)

        const docIds = new Set(docsInProject.map((d) => d.id))
        setProjectPerms(allPerms.filter((p) => docIds.has(p.documentId)))
      })
      .finally(() => setLoadingDetails(false))
  }, [selectedProject])

  const openManageMembersModal = async (project: ProjectItem) => {
    setManageMembersProject(project)
    setModalError(null)
    setModalSuccess(null)
    setSelectedUserEmails([])
    setSelectedRole('Contributor')
    setUserSearchQuery('')

    try {
      const [membersData, usersData] = await Promise.all([
        api.getProjectMembers(project.id),
        api.getAdminUsers(),
      ])
      setModalMembers(membersData)
      setAllUsers(usersData)
    } catch (err: any) {
      setModalError(err.message || 'Failed to load project members or registered users')
    }
  }

  const handleAddMembers = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manageMembersProject || selectedUserEmails.length === 0) return
    setSubmittingMembers(true)
    setModalError(null)
    setModalSuccess(null)

    try {
      let addedCount = 0
      for (const email of selectedUserEmails) {
        await api.addProjectMember(manageMembersProject.id, email, selectedRole)
        addedCount++
      }

      setModalSuccess(`Successfully added ${addedCount} member(s) as "${selectedRole}".`)
      setSelectedUserEmails([])

      // Refresh members and projects
      const updatedMembers = await api.getProjectMembers(manageMembersProject.id)
      setModalMembers(updatedMembers)
      if (selectedProject?.id === manageMembersProject.id) {
        setMembers(updatedMembers)
      }
      await loadProjects()
    } catch (err: any) {
      setModalError(err.message || 'Failed to add project members')
    } finally {
      setSubmittingMembers(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!manageMembersProject) return
    if (!confirm(`Remove ${memberEmail} from project "${manageMembersProject.name}"?`)) return

    try {
      await api.removeProjectMember(manageMembersProject.id, memberId)
      const updatedMembers = await api.getProjectMembers(manageMembersProject.id)
      setModalMembers(updatedMembers)
      if (selectedProject?.id === manageMembersProject.id) {
        setMembers(updatedMembers)
      }
      await loadProjects()
      setModalSuccess(`Removed ${memberEmail} from project.`)
    } catch (err: any) {
      setModalError(err.message || 'Failed to remove member')
    }
  }

  const availableUsersToAdd = useMemo(() => {
    const existingEmails = new Set(modalMembers.map((m) => m.userEmail.toLowerCase()))
    return allUsers.filter((u) => {
      if (existingEmails.has(u.email.toLowerCase())) return false
      if (!userSearchQuery) return true
      const q = userSearchQuery.toLowerCase()
      return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [allUsers, modalMembers, userSearchQuery])

  const toggleUserSelection = (email: string) => {
    setSelectedUserEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    )
  }

  const filteredProjects = useMemo(() => {
    if (!query.trim()) return projects
    const q = query.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.ownerName && p.ownerName.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    )
  }, [projects, query])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#14213d]">System-Wide Project Workspaces</h2>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
              Monitoring Mode
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Inspect corporate projects across all business units. Project creation is strictly reserved for authorized Managers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadProjects}
            disabled={loading}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e2eaf5] bg-white px-3 text-xs font-bold text-[#475569] hover:bg-[#f8fbff] disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-[#2463eb]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Policy Notice Box */}
      <div className="rounded-xl border border-blue-200 bg-[#f8fbff] p-4 text-xs text-[#334155] flex items-start gap-3">
        <Info className="size-4 shrink-0 mt-0.5 text-[#2463eb]" />
        <div>
          <strong className="text-[#14213d]">Administrative Governance Policy:</strong>
          <span className="ml-1 text-[#52637f]">
            Administrators monitor workspace health and metadata. Project membership does not automatically grant READ or EDIT access to confidential documents. Privileged document downloads require explicit authorization grants.
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="rounded-2xl border border-[#e2eaf5] bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-[#8ba0bf]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects by name, description, assigned manager, or department..."
            className="w-full rounded-xl border border-[#d8e2ef] bg-[#f8fbff] py-2 pl-9 pr-3 text-xs text-[#14213d] placeholder:text-[#8ba0bf] focus:border-[#2463eb] focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl border border-[#e2eaf5] bg-white p-5 animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-[#e2eaf5] bg-white py-12 text-center text-xs text-[#8ca0c2]">
          No project workspaces found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setSelectedProject(p)
                setActiveTab('overview')
              }}
              className="group flex flex-col justify-between rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm transition hover:border-[#2463eb] hover:shadow-md cursor-pointer"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#edf4ff] text-[#2463eb] group-hover:bg-[#2463eb] group-hover:text-white transition">
                    <FolderKanban className="size-5" />
                  </div>
                  <span className="rounded-md border border-[#e2eaf5] bg-[#fafcff] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">
                    {p.category || 'General'}
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold text-[#14213d] group-hover:text-[#2463eb] transition">
                  {p.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-[#64748b]">
                  {p.description || 'No description provided for this project.'}
                </p>
              </div>

              <div className="mt-5 border-t border-[#f0f4fa] pt-3">
                <div className="flex items-center justify-between text-xs text-[#71829d]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8ba0bf]">Manager: </span>
                    <strong className="text-[#334155]">{p.ownerName}</strong>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-[#64748b]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="size-3 text-[#2463eb]" />
                      <strong>{p.memberCount}</strong> members
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="size-3 text-[#7e4fe3]" />
                      <strong>{p.documentCount}</strong> documents
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openManageMembersModal(p)
                    }}
                    className="flex items-center gap-1 rounded-lg border border-[#d8e2ef] bg-[#f8fbff] px-2.5 py-1 text-[10px] font-bold text-[#2463eb] hover:border-[#2463eb] hover:bg-[#edf4ff] transition cursor-pointer"
                  >
                    <UserPlus className="size-3" />
                    <span>Manage Members</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PROJECT DETAIL DRAWER (WITH 5 TABS) */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-2xl bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
            <div>
              {/* Drawer Top */}
              <div className="flex items-start justify-between border-b border-[#eef4fa] pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#edf4ff] text-[#2463eb]">
                    <FolderKanban className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#14213d]">{selectedProject.name}</h3>
                    <p className="text-xs text-[#71829d]">
                      Assigned Manager: <strong className="text-[#14213d]">{selectedProject.ownerName}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* 5 Tabs Navigation */}
              <div className="mt-4 flex flex-wrap gap-1 border-b border-[#eef4fa] pb-2">
                {[
                  { id: 'overview' as ProjectDetailTab, label: 'Overview' },
                  { id: 'members' as ProjectDetailTab, label: `Team Members (${members.length})` },
                  { id: 'documents' as ProjectDetailTab, label: `Documents (${projectDocs.length})` },
                  { id: 'permissions' as ProjectDetailTab, label: `Permissions (${projectPerms.length})` },
                  { id: 'activity' as ProjectDetailTab, label: 'Activity' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      activeTab === tab.id
                        ? 'bg-[#2463eb] text-white shadow-xs'
                        : 'text-[#64748b] hover:bg-[#edf4ff] hover:text-[#2463eb]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="mt-5 space-y-4 text-xs">
                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Project Description
                    </span>
                    <p className="mt-1 text-xs text-[#334155] leading-relaxed">
                      {selectedProject.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                        Project Category
                      </span>
                      <p className="mt-1 font-bold text-[#14213d]">{selectedProject.category || 'General'}</p>
                    </div>

                    <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                        Created Date
                      </span>
                      <p className="mt-1 font-bold text-[#14213d]">
                        {new Date(selectedProject.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                        Enrolled Members
                      </span>
                      <p className="mt-1 font-extrabold text-[#2463eb] text-base">{members.length}</p>
                    </div>

                    <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                        Vault Documents
                      </span>
                      <p className="mt-1 font-extrabold text-[#7e4fe3] text-base">{projectDocs.length}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TEAM MEMBERS */}
              {activeTab === 'members' && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <div>
                      <p className="text-xs font-bold text-[#14213d]">Enrolled Project Team</p>
                      <p className="text-[11px] text-[#71829d]">
                        Project membership does not grant automatic document access.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openManageMembersModal(selectedProject)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#2463eb] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
                    >
                      <UserPlus className="size-3.5" />
                      <span>Manage Members</span>
                    </button>
                  </div>
                  {members.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#8ca0c2]">
                      No team members assigned to this project yet.
                    </div>
                  ) : (
                    members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#14213d]">{m.fullName}</p>
                          <p className="text-[11px] text-[#71829d]">{m.userEmail}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-[#d8e2ef] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#475569]">
                            {m.responsibility || 'Contributor'}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              m.active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {m.active ? 'Active' : 'Deactivated'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: DOCUMENTS */}
              {activeTab === 'documents' && (
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2">
                    <Shield className="size-4 shrink-0 text-amber-600" />
                    <span>
                      Confidential Documents: Administrators monitor metadata. Physical downloads require explicit user-level permission grant.
                    </span>
                  </div>

                  {projectDocs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#8ca0c2]">
                      No documents associated with this project.
                    </div>
                  ) : (
                    projectDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-[#14213d] truncate">{doc.title}</p>
                          <p className="text-[10px] text-[#71829d]">
                            Size: {doc.formattedSize} • Category: {doc.category}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Restricted Content
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: PERMISSIONS */}
              {activeTab === 'permissions' && (
                <div className="mt-5 space-y-3">
                  {projectPerms.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#8ca0c2]">
                      No active document permissions recorded for documents in this project.
                    </div>
                  ) : (
                    projectPerms.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#14213d]">{perm.documentTitle}</p>
                          <p className="text-[11px] text-[#71829d]">
                            User: <strong>{perm.userEmail}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              perm.permissionLevel === 'EDIT'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {perm.permissionLevel}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-700">
                            {perm.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 5: ACTIVITY */}
              {activeTab === 'activity' && (
                <div className="mt-5 text-xs text-[#64748b] space-y-3">
                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <p className="font-bold text-[#14213d]">Project Created</p>
                    <p className="mt-0.5 text-[11px] text-[#71829d]">
                      By {selectedProject.ownerName} on {new Date(selectedProject.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <p className="font-bold text-[#14213d]">Audit Status</p>
                    <p className="mt-0.5 text-[11px] text-[#71829d]">
                      Workspace events cryptographically logged in append-only audit trail.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-[#eef4fa] pt-4">
              <button
                onClick={() => setSelectedProject(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50"
              >
                Close Project Details
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MANAGE PROJECT MEMBERS MODAL */}
      {manageMembersProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col justify-between overflow-hidden">
            <div className="flex items-start justify-between border-b border-[#eef4fa] pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-[#2463eb]">
                    <Users className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#14213d]">
                    Manage Project Members: {manageMembersProject.name}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-[#64748b]">
                  Manager: <strong className="text-[#14213d]">{manageMembersProject.ownerName}</strong> •{' '}
                  <span className="text-amber-700 font-medium">
                    Project membership does not automatically grant document access.
                  </span>
                </p>
              </div>
              <button
                onClick={() => setManageMembersProject(null)}
                className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {modalError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                  <Check className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* Current Members Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#7990b0] mb-2">
                  Current Enrolled Members ({modalMembers.length})
                </h4>
                {modalMembers.length === 0 ? (
                  <p className="text-xs text-[#94a3b8] italic p-3 rounded-xl border border-[#e2eaf5] bg-[#fafcff]">
                    No members enrolled in this project yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {modalMembers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-2.5 text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#14213d]">{m.fullName}</p>
                          <p className="text-[11px] text-[#71829d]">{m.userEmail}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-md border border-[#d8e2ef] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#475569]">
                            {m.responsibility || 'Contributor'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.id, m.userEmail)}
                            className="grid size-7 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Members Section */}
              <form onSubmit={handleAddMembers} className="border-t border-[#eef4fa] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#7990b0]">
                    Select Registered Users to Add
                  </h4>
                  <span className="text-xs font-bold text-[#2463eb]">
                    {selectedUserEmails.length} user(s) selected
                  </span>
                </div>

                {/* Role / Responsibility Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#14213d] mb-1">
                      Assigned Responsibility / Project Role
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs font-semibold text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                    >
                      <option value="Contributor">Contributor</option>
                      <option value="Lead">Lead</option>
                      <option value="Reviewer">Reviewer</option>
                      <option value="Observer">Observer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14213d] mb-1">
                      Filter Registered Users
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 size-3.5 text-[#8ba0bf]" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] py-1.5 pl-8 pr-3 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Users Selection List (Multi-select) */}
                <div className="rounded-xl border border-[#d8e2ef] bg-[#fafcff] p-2 max-h-48 overflow-y-auto space-y-1">
                  {availableUsersToAdd.length === 0 ? (
                    <p className="p-3 text-center text-xs text-[#94a3b8] italic">
                      No additional users available to add.
                    </p>
                  ) : (
                    availableUsersToAdd.map((u) => {
                      const isSelected = selectedUserEmails.includes(u.email)
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleUserSelection(u.email)}
                          className={`flex items-center justify-between rounded-lg p-2 text-xs cursor-pointer transition ${
                            isSelected ? 'bg-[#edf4ff] border border-[#2463eb]' : 'hover:bg-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="size-4 rounded text-[#2463eb] focus:ring-0"
                            />
                            <div>
                              <p className="font-bold text-[#14213d]">{u.fullName}</p>
                              <p className="text-[10px] text-[#71829d]">{u.email}</p>
                            </div>
                          </div>
                          <span className="rounded-md border border-[#e2eaf5] bg-white px-2 py-0.5 text-[10px] font-bold text-[#64748b]">
                            {u.role.replace('ROLE_', '')}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setManageMembersProject(null)}
                    className="h-9 rounded-xl border border-[#d8e2ef] px-4 text-xs font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
                  >
                    Done
                  </button>
                  <button
                    type="submit"
                    disabled={selectedUserEmails.length === 0 || submittingMembers}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-4 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingMembers ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="size-3.5" />
                    )}
                    <span>Add Selected Members ({selectedUserEmails.length})</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}