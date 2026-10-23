const fs = require('fs');
const filePath = 'D:/AI_Agents/trust1/app/admin/documents/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add missing imports
if (!content.includes('Upload')) {
  content = content.replace("  Search,\n", "  Search,\n  Upload,\n  Plus,\n  UserPlus,\n  Clock,\n");
}
if (!content.includes('ProjectItem')) {
  content = content.replace(
    "  PermissionItem,\n} from '../../../lib/api'",
    "  PermissionItem,\n  ProjectItem,\n  UserManagementItem,\n} from '../../../lib/api'"
  );
}

// 2. Add state
const stateTarget = "  const [copiedHash, setCopiedHash] = useState(false)\n";
const stateAdditions = `  const [copiedHash, setCopiedHash] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Project and User lists for assignment
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [users, setUsers] = useState<UserManagementItem[]>([])

  // Upload Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('General')
  const [uploadProjectId, setUploadProjectId] = useState('')
  const [uploadRecipientEmail, setUploadRecipientEmail] = useState('')
  const [uploadPermissionLevel, setUploadPermissionLevel] = useState<'READ' | 'EDIT'>('READ')
  const [uploadExpiryDays, setUploadExpiryDays] = useState('0')
  const [submittingUpload, setSubmittingUpload] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Assign to Existing Document Modal State
  const [grantModalDoc, setGrantModalDoc] = useState<DocumentItem | null>(null)
  const [grantUserEmail, setGrantUserEmail] = useState('')
  const [grantPermissionLevel, setGrantPermissionLevel] = useState<'READ' | 'EDIT'>('READ')
  const [grantExpiryDays, setGrantExpiryDays] = useState('0')
  const [submittingGrant, setSubmittingGrant] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
`;

content = content.replace(stateTarget, stateAdditions);

// 3. Add notify helper and load projects/users
const loadDocsTarget = "  const loadDocuments = async () => {\n";
const loadDocsReplacement = `  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadDependencies = async () => {
    try {
      const [projList, userList] = await Promise.all([
        api.getProjects().catch(() => []),
        api.getAdminUsers().catch(() => []),
      ])
      setProjects(projList)
      setUsers(userList)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadDependencies()
  }, [])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setUploadError('Please select a file to upload')
      return
    }
    setSubmittingUpload(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (uploadTitle.trim()) {
        formData.append('title', uploadTitle.trim())
      }
      if (uploadCategory) {
        formData.append('category', uploadCategory)
      }
      if (uploadProjectId) {
        formData.append('projectId', uploadProjectId)
      }

      const createdDoc = await api.uploadDocument(formData)

      // If a recipient was selected, assign explicit permission grant
      if (uploadRecipientEmail) {
        let expiresAt: string | null = null
        const days = parseInt(uploadExpiryDays, 10)
        if (days > 0) {
          expiresAt = new Date(Date.now() + days * 86400000).toISOString()
        }

        await api.grantPermission(createdDoc.id, {
          userEmail: uploadRecipientEmail,
          permissionLevel: uploadPermissionLevel,
          expiresAt,
        })
      }

      notify(\`Document "\${createdDoc.title}" uploaded and stored in private vault successfully.\`, 'success')
      setUploadModalOpen(false)
      setSelectedFile(null)
      setUploadTitle('')
      setUploadCategory('General')
      setUploadProjectId('')
      setUploadRecipientEmail('')
      setUploadPermissionLevel('READ')
      setUploadExpiryDays('0')
      await loadDocuments()
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document')
    } finally {
      setSubmittingUpload(false)
    }
  }

  const handleGrantExistingDocPermission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!grantModalDoc || !grantUserEmail) {
      setGrantError('Please select a recipient')
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

      await api.grantPermission(grantModalDoc.id, {
        userEmail: grantUserEmail,
        permissionLevel: grantPermissionLevel,
        expiresAt,
      })

      notify(\`Granted \${grantPermissionLevel} access to \${grantUserEmail} successfully.\`, 'success')
      setGrantModalDoc(null)
      setGrantUserEmail('')
      setGrantPermissionLevel('READ')
      setGrantExpiryDays('0')

      // Refresh permissions in drawer
      if (selectedDoc && selectedDoc.id === grantModalDoc.id) {
        const perms = await api.getDocumentPermissions(selectedDoc.id)
        setDocPermissions(perms)
      }
      await loadDocuments()
    } catch (err: any) {
      setGrantError(err.message || 'Failed to grant permission')
    } finally {
      setSubmittingGrant(false)
    }
  }

  const loadDocuments = async () => {\n`;

content = content.replace(loadDocsTarget, loadDocsReplacement);

// 4. Update Header Banner to add "Upload Document" button next to "Refresh"
const oldHeaderRight = `        <button
          onClick={loadDocuments}
          disabled={loading}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e2eaf5] bg-white px-3 text-xs font-bold text-[#475569] hover:bg-[#f8fbff] disabled:opacity-60"
        >
          <RefreshCw className={\`size-3.5 \${loading ? 'animate-spin text-[#2463eb]' : ''}\`} />
          <span>Refresh</span>
        </button>
      </div>`;

const newHeaderRight = `        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setUploadModalOpen(true)
              setUploadError(null)
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-3.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
          >
            <Upload className="size-3.5" />
            <span>Upload Document</span>
          </button>
          <button
            onClick={loadDocuments}
            disabled={loading}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e2eaf5] bg-white px-3 text-xs font-bold text-[#475569] hover:bg-[#f8fbff] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={\`size-3.5 \${loading ? 'animate-spin text-[#2463eb]' : ''}\`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>`;

content = content.replace(oldHeaderRight, newHeaderRight);

// 5. In drawer, add "Grant Permission" button in the "Active Document-Level Grants" section
const oldPermHeader = `                {/* Active Permissions on this Document */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Active Document-Level Grants ({docPermissions.length})
                  </span>`;

const newPermHeader = `                {/* Active Permissions on this Document */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Active Document-Level Grants ({docPermissions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setGrantModalDoc(selectedDoc)
                        setGrantError(null)
                        setGrantUserEmail('')
                        setGrantPermissionLevel('READ')
                        setGrantExpiryDays('0')
                      }}
                      className="flex items-center gap-1 rounded-lg border border-[#2463eb] bg-[#edf4ff] px-2 py-1 text-[10px] font-bold text-[#2463eb] hover:bg-[#2463eb] hover:text-white transition cursor-pointer"
                    >
                      <UserPlus className="size-3" />
                      <span>Grant Access</span>
                    </button>
                  </div>`;

content = content.replace(oldPermHeader, newPermHeader);

// 6. Add Upload Modal, Grant Modal, and Toast at bottom before closing div
const modalsCode = `      {/* UPLOAD DOCUMENT MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-[#2463eb]">
                  <Upload className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#14213d]">Upload Document to Private Vault</h3>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {uploadError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="mt-4 space-y-4 text-xs">
              {/* File Input */}
              <div>
                <label className="block font-bold text-[#14213d] mb-1">
                  Select File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setSelectedFile(file)
                    if (file && !uploadTitle) {
                      setUploadTitle(file.name)
                    }
                  }}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] p-2 text-xs text-[#14213d] file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf4ff] file:px-3 file:py-1 file:text-xs file:font-bold file:text-[#2463eb] hover:file:bg-blue-100"
                />
                <p className="mt-1 text-[10px] text-[#71829d]">
                  Stored privately with SHA-256 integrity hash. Disallowed executables are rejected server-side.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block font-bold text-[#14213d] mb-1">Document Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Leave blank to use original filename"
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Category & Project */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#14213d] mb-1">Category</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Confidential">Confidential</option>
                    <option value="Financial">Financial</option>
                    <option value="Legal">Legal</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#14213d] mb-1">Assign to Project</label>
                  <select
                    value={uploadProjectId}
                    onChange={(e) => setUploadProjectId(e.target.value)}
                    className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                  >
                    <option value="">No Project (Independent)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recipient Assignment Section */}
              <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5 space-y-3">
                <div className="flex items-center gap-1.5">
                  <UserPlus className="size-3.5 text-[#2463eb]" />
                  <span className="font-bold text-[#14213d]">Recipient Permission Grant (Optional)</span>
                </div>

                <div>
                  <label className="block font-semibold text-[#64748b] mb-1">Registered Recipient</label>
                  <select
                    value={uploadRecipientEmail}
                    onChange={(e) => setUploadRecipientEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#d8e2ef] bg-white px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                  >
                    <option value="">No initial recipient (Only uploader/owner)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.fullName} ({u.email}) - {u.role.replace('ROLE_', '')}
                      </option>
                    ))}
                  </select>
                </div>

                {uploadRecipientEmail && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-semibold text-[#64748b] mb-1">Permission Level</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setUploadPermissionLevel('READ')}
                          className={\`rounded-lg border py-1.5 text-xs font-bold transition \${
                            uploadPermissionLevel === 'READ'
                              ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb]'
                              : 'border-[#d8e2ef] bg-white text-[#64748b]'
                          }\`}
                        >
                          READ
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadPermissionLevel('EDIT')}
                          className={\`rounded-lg border py-1.5 text-xs font-bold transition \${
                            uploadPermissionLevel === 'EDIT'
                              ? 'border-purple-600 bg-purple-50 text-purple-700'
                              : 'border-[#d8e2ef] bg-white text-[#64748b]'
                          }\`}
                        >
                          EDIT
                        </button>
                      </div>
                      <p className="mt-1 text-[9px] text-[#71829d]">
                        READ cannot edit. EDIT does not allow deletion or sharing.
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#64748b] mb-1">Permission Expiry</label>
                      <select
                        value={uploadExpiryDays}
                        onChange={(e) => setUploadExpiryDays(e.target.value)}
                        className="w-full rounded-xl border border-[#d8e2ef] bg-white px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                      >
                        <option value="0">Never Expires</option>
                        <option value="7">Expires in 7 days</option>
                        <option value="14">Expires in 14 days</option>
                        <option value="30">Expires in 30 days</option>
                        <option value="90">Expires in 90 days</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#eef4fa]">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="h-9 rounded-xl border border-[#d8e2ef] px-4 font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || submittingUpload}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-4 font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {submittingUpload ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  <span>Upload & Store</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRANT PERMISSION TO EXISTING DOCUMENT MODAL */}
      {grantModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-[#2463eb]">
                  <UserPlus className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#14213d]">Grant Document Permission</h3>
              </div>
              <button
                onClick={() => setGrantModalDoc(null)}
                className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-[#64748b]">
              Document: <strong className="text-[#14213d]">{grantModalDoc.title}</strong>
            </p>

            {grantError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <span>{grantError}</span>
              </div>
            )}

            <form onSubmit={handleGrantExistingDocPermission} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14213d] mb-1">
                  Select Recipient <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={grantUserEmail}
                  onChange={(e) => setGrantUserEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                >
                  <option value="">Select a registered user...</option>
                  {users.map((u) => (
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
                    onClick={() => setGrantPermissionLevel('READ')}
                    className={\`rounded-xl border py-2 text-xs font-bold transition \${
                      grantPermissionLevel === 'READ'
                        ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb]'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }\`}
                  >
                    READ Permission
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantPermissionLevel('EDIT')}
                    className={\`rounded-xl border py-2 text-xs font-bold transition \${
                      grantPermissionLevel === 'EDIT'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }\`}
                  >
                    EDIT Permission
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[#71829d]">
                  READ grants viewing and downloading. EDIT allows editing content but prohibits deletion.
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
                  onClick={() => setGrantModalDoc(null)}
                  className="h-9 rounded-xl border border-[#d8e2ef] px-4 font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!grantUserEmail || submittingGrant}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-4 font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {submittingGrant ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="size-3.5" />
                  )}
                  <span>Grant Permission</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={\`fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg animate-in slide-in-from-bottom-2 \${
            toast.type === 'error' ? 'bg-[#e53e3e] text-white' : 'bg-[#14213d] text-white'
          }\`}
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
}`;

content = content.slice(0, content.lastIndexOf('    </div>\n  )\n}')) + modalsCode;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated documents/page.tsx with Upload and Permission Assignment features');
