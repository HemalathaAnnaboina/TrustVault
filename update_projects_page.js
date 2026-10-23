const fs = require('fs');
const filePath = 'D:/AI_Agents/trust1/app/admin/projects/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add missing imports
if (!content.includes('UserPlus')) {
  content = content.replace("  Users,\n", "  Users,\n  UserPlus,\n  Trash2,\n  Check,\n");
}
if (!content.includes('UserManagementItem')) {
  content = content.replace(
    "  ProjectMemberItem,\n} from '../../../lib/api'",
    "  ProjectMemberItem,\n  UserManagementItem,\n} from '../../../lib/api'"
  );
}

// 2. Add state for manage members modal
const stateHookTarget = "  const [loadingDetails, setLoadingDetails] = useState(false)\n";
const stateAdditions = `  const [loadingDetails, setLoadingDetails] = useState(false)

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
`;

content = content.replace(stateHookTarget, stateAdditions);

// 3. Add handler functions for manage members modal
const handlersTarget = "  const filteredProjects = useMemo(() => {\n";
const handlersCode = `  const openManageMembersModal = async (project: ProjectItem) => {
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

      setModalSuccess(\`Successfully added \${addedCount} member(s) as "\${selectedRole}".\`)
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
    if (!confirm(\`Remove \${memberEmail} from project "\${manageMembersProject.name}"?\`)) return

    try {
      await api.removeProjectMember(manageMembersProject.id, memberId)
      const updatedMembers = await api.getProjectMembers(manageMembersProject.id)
      setModalMembers(updatedMembers)
      if (selectedProject?.id === manageMembersProject.id) {
        setMembers(updatedMembers)
      }
      await loadProjects()
      setModalSuccess(\`Removed \${memberEmail} from project.\`)
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
`;

content = content.replace(handlersTarget, handlersCode);

// 4. Update project card footer to include Manage Members button
const oldCardFooter = `                <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-[#64748b]">
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
                  <ChevronRight className="size-4 text-[#8ba0bf] group-hover:translate-x-1 transition" />
                </div>`;

const newCardFooter = `                <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-[#64748b]">
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
                </div>`;

content = content.replace(oldCardFooter, newCardFooter);

// 5. In Team Members tab inside Drawer, add Manage Members button in header
const oldMembersTabStart = `              {/* TAB 2: TEAM MEMBERS */}
              {activeTab === 'members' && (
                <div className="mt-5 space-y-3">`;

const newMembersTabStart = `              {/* TAB 2: TEAM MEMBERS */}
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
                  </div>`;

content = content.replace(oldMembersTabStart, newMembersTabStart);

// 6. Add Manage Members Modal at the bottom before closing div
const modalCode = `      {/* MANAGE PROJECT MEMBERS MODAL */}
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
                          className={\`flex items-center justify-between rounded-lg p-2 text-xs cursor-pointer transition \${
                            isSelected ? 'bg-[#edf4ff] border border-[#2463eb]' : 'hover:bg-white border border-transparent'
                          }\`}
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
}`;

content = content.slice(0, content.lastIndexOf('    </div>\n  )\n}')) + modalCode;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated projects/page.tsx with Manage Members feature');
