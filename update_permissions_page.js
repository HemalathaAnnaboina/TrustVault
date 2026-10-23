const fs = require('fs');
const filePath = 'D:/AI_Agents/trust1/app/admin/permissions/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add missing imports
if (!content.includes('UserPlus')) {
  content = content.replace("  Users,\n", "  Users,\n  UserPlus,\n  Trash2,\n  Plus,\n  Check,\n  AlertCircle,\n");
}
if (!content.includes('DocumentItem')) {
  content = content.replace(
    "  PermissionItem,\n} from '../../../lib/api'",
    "  PermissionItem,\n  DocumentItem,\n  UserManagementItem,\n} from '../../../lib/api'"
  );
}

// 2. Add state
const stateTarget = "  const [selectedPerm, setSelectedPerm] = useState<PermissionItem | null>(null)\n";
const stateAdditions = `  const [selectedPerm, setSelectedPerm] = useState<PermissionItem | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Document and user lists for granting
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([])
  const [allUsers, setAllUsers] = useState<UserManagementItem[]>([])

  // Grant Modal State
  const [grantModalOpen, setGrantModalOpen] = useState(false)
  const [grantDocId, setGrantDocId] = useState('')
  const [grantUserEmail, setGrantUserEmail] = useState('')
  const [grantLevel, setGrantLevel] = useState<'READ' | 'EDIT'>('READ')
  const [grantExpiryDays, setGrantExpiryDays] = useState('0')
  const [submittingGrant, setSubmittingGrant] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)

  // Update Modal State
  const [updateModalPerm, setUpdateModalPerm] = useState<PermissionItem | null>(null)
  const [updateLevel, setUpdateLevel] = useState<'READ' | 'EDIT'>('READ')
  const [updateExpiryDays, setUpdateExpiryDays] = useState('0')
  const [submittingUpdate, setSubmittingUpdate] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
`;

content = content.replace(stateTarget, stateAdditions);

// 3. Add helper methods
const loadPermsTarget = "  const loadPermissions = async () => {\n";
const helperMethods = `  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadDependencies = async () => {
    try {
      const [docs, users] = await Promise.all([
        api.getDocuments().catch(() => []),
        api.getAdminUsers().catch(() => []),
      ])
      setAllDocs(docs)
      setAllUsers(users)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadDependencies()
  }, [])

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!grantDocId || !grantUserEmail) {
      setGrantError('Please select both a document and a user')
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

      await api.grantPermission(grantDocId, {
        userEmail: grantUserEmail,
        permissionLevel: grantLevel,
        expiresAt,
      })

      notify(\`Granted \${grantLevel} permission to \${grantUserEmail} successfully.\`, 'success')
      setGrantModalOpen(false)
      setGrantDocId('')
      setGrantUserEmail('')
      setGrantLevel('READ')
      setGrantExpiryDays('0')
      await loadPermissions()
    } catch (err: any) {
      setGrantError(err.message || 'Failed to grant permission')
    } finally {
      setSubmittingGrant(false)
    }
  }

  const openUpdateModal = (perm: PermissionItem) => {
    setUpdateModalPerm(perm)
    setUpdateLevel(perm.permissionLevel)
    setUpdateExpiryDays('0')
    setUpdateError(null)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!updateModalPerm) return
    setSubmittingUpdate(true)
    setUpdateError(null)

    try {
      let expiresAt: string | null = null
      const days = parseInt(updateExpiryDays, 10)
      if (days > 0) {
        expiresAt = new Date(Date.now() + days * 86400000).toISOString()
      }

      const updated = await api.updatePermission(updateModalPerm.id, {
        permissionLevel: updateLevel,
        expiresAt,
      })

      notify(\`Updated permission for \${updateModalPerm.userEmail} to \${updateLevel}.\`, 'success')
      setUpdateModalPerm(null)
      if (selectedPerm?.id === updateModalPerm.id) {
        setSelectedPerm(updated)
      }
      await loadPermissions()
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update permission')
    } finally {
      setSubmittingUpdate(false)
    }
  }

  const handleRevoke = async (permissionId: string, email: string, docTitle: string) => {
    if (!confirm(\`Revoke access for \${email} on "\${docTitle}" immediately?\`)) return

    try {
      await api.revokePermission(permissionId)
      notify(\`Revoked access for \${email} successfully.\`, 'success')
      if (selectedPerm?.id === permissionId) {
        setSelectedPerm((prev) => (prev ? { ...prev, status: 'REVOKED' } : null))
      }
      await loadPermissions()
    } catch (err: any) {
      notify(err.message || 'Failed to revoke permission', 'error')
    }
  }

  const loadPermissions = async () => {\n`;

content = content.replace(loadPermsTarget, helperMethods);

// 4. Update Header banner to include "Grant Permission" button
const oldHeaderButton = `        <button
          onClick={loadPermissions}
          disabled={loading}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e2eaf5] bg-white px-3 text-xs font-bold text-[#475569] hover:bg-[#f8fbff] disabled:opacity-60"
        >
          <RefreshCw className={\`size-3.5 \${loading ? 'animate-spin text-[#2463eb]' : ''}\`} />
          <span>Refresh</span>
        </button>
      </div>`;

const newHeaderButton = `        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setGrantModalOpen(true)
              setGrantError(null)
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-3.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Grant Permission</span>
          </button>
          <button
            onClick={loadPermissions}
            disabled={loading}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e2eaf5] bg-white px-3 text-xs font-bold text-[#475569] hover:bg-[#f8fbff] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={\`size-3.5 \${loading ? 'animate-spin text-[#2463eb]' : ''}\`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>`;

content = content.replace(oldHeaderButton, newHeaderButton);

// 5. Add "Actions" column in Table header
const oldTh = `              <th className="px-5 py-3.5 text-right">Grant Status</th>
            </tr>`;

const newTh = `              <th className="px-5 py-3.5 text-right">Grant Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>`;

content = content.replace(oldTh, newTh);

// 6. In each table row, add the Actions cell
const oldRowEnd = `                    </span>
                  </td>
                </tr>`;

const newRowEnd = `                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {perm.status === 'ACTIVE' && !perm.isExpired && (
                        <>
                          <button
                            type="button"
                            onClick={() => openUpdateModal(perm)}
                            className="rounded-lg border border-[#d8e2ef] bg-white px-2.5 py-1 text-[11px] font-bold text-[#2463eb] hover:bg-[#edf4ff] hover:border-[#2463eb] transition cursor-pointer"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(perm.id, perm.userEmail, perm.documentTitle)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>`;

content = content.replace(oldRowEnd, newRowEnd);

// 7. In Drawer, add action buttons for Update & Revoke
const oldDrawerFooter = `            <div className="mt-6 border-t border-[#eef4fa] pt-4">
              <button
                onClick={() => setSelectedPerm(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50"
              >
                Close Permission Record
              </button>
            </div>`;

const newDrawerFooter = `            <div className="mt-6 border-t border-[#eef4fa] pt-4 space-y-2">
              {selectedPerm.status === 'ACTIVE' && !selectedPerm.isExpired && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openUpdateModal(selectedPerm)}
                    className="h-9 rounded-xl border border-[#2463eb] bg-[#edf4ff] text-xs font-bold text-[#2463eb] hover:bg-[#2463eb] hover:text-white transition cursor-pointer"
                  >
                    Update Access Level
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(selectedPerm.id, selectedPerm.userEmail, selectedPerm.documentTitle)}
                    className="h-9 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    Revoke Grant
                  </button>
                </div>
              )}
              <button
                onClick={() => setSelectedPerm(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
              >
                Close Permission Record
              </button>
            </div>`;

content = content.replace(oldDrawerFooter, newDrawerFooter);

// 8. Add Grant Modal, Update Modal, Toast before closing div
const modalsBlock = `      {/* GRANT PERMISSION MODAL */}
      {grantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-[#2463eb]">
                  <Plus className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#14213d]">Grant Document Permission</h3>
              </div>
              <button
                onClick={() => setGrantModalOpen(false)}
                className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {grantError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <span>{grantError}</span>
              </div>
            )}

            <form onSubmit={handleGrant} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14213d] mb-1">
                  Target Document <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={grantDocId}
                  onChange={(e) => setGrantDocId(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                >
                  <option value="">Select a document...</option>
                  {allDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.formattedSize} - {d.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#14213d] mb-1">
                  Recipient User <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={grantUserEmail}
                  onChange={(e) => setGrantUserEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                >
                  <option value="">Select a registered user...</option>
                  {allUsers.map((u) => (
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
                    onClick={() => setGrantLevel('READ')}
                    className={\`rounded-xl border py-2 text-xs font-bold transition \${
                      grantLevel === 'READ'
                        ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb]'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }\`}
                  >
                    READ Permission
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantLevel('EDIT')}
                    className={\`rounded-xl border py-2 text-xs font-bold transition \${
                      grantLevel === 'EDIT'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }\`}
                  >
                    EDIT Permission
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[#71829d]">
                  READ allows viewing/downloading. EDIT allows updating content but does not permit deletion.
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
                  onClick={() => setGrantModalOpen(false)}
                  className="h-9 rounded-xl border border-[#d8e2ef] px-4 font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!grantDocId || !grantUserEmail || submittingGrant}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-4 font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {submittingGrant ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  <span>Grant Permission</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE PERMISSION MODAL */}
      {updateModalPerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-[#2463eb]">
                  <Edit3 className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#14213d]">Update Permission Grant</h3>
              </div>
              <button
                onClick={() => setUpdateModalPerm(null)}
                className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1 text-xs">
              <p className="text-[#64748b]">
                Document: <strong className="text-[#14213d]">{updateModalPerm.documentTitle}</strong>
              </p>
              <p className="text-[#64748b]">
                Grantee: <strong className="text-[#14213d]">{updateModalPerm.userEmail}</strong>
              </p>
            </div>

            {updateError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <span>{updateError}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14213d] mb-1">Access Level</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpdateLevel('READ')}
                    className={\`rounded-xl border py-2 text-xs font-bold transition \${
                      updateLevel === 'READ'
                        ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb]'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }\`}
                  >
                    READ
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateLevel('EDIT')}
                    className={\`rounded-xl border py-2 text-xs font-bold transition \${
                      updateLevel === 'EDIT'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }\`}
                  >
                    EDIT
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#14213d] mb-1">Update Expiry</label>
                <select
                  value={updateExpiryDays}
                  onChange={(e) => setUpdateExpiryDays(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                >
                  <option value="0">Never Expires (Indefinite)</option>
                  <option value="7">Extend by 7 days</option>
                  <option value="14">Extend by 14 days</option>
                  <option value="30">Extend by 30 days</option>
                  <option value="90">Extend by 90 days</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#eef4fa]">
                <button
                  type="button"
                  onClick={() => setUpdateModalPerm(null)}
                  className="h-9 rounded-xl border border-[#d8e2ef] px-4 font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUpdate}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2463eb] px-4 font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {submittingUpdate ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Edit3 className="size-3.5" />
                  )}
                  <span>Save Changes</span>
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

content = content.slice(0, content.lastIndexOf('    </div>\n  )\n}')) + modalsBlock;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated permissions/page.tsx with Grant, Update, and Revoke features');
