'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderKanban,
  HardDrive,
  Hash,
  Info,
  Lock,
  LockKeyhole,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  User,
  X,
  Upload,
  UserPlus,
} from 'lucide-react'
import { api, DocumentItem, PermissionItem, ProjectItem, UserManagementItem } from '../../../lib/api'

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null)
  const [docPermissions, setDocPermissions] = useState<PermissionItem[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
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

      notify(`Document "${createdDoc.title}" uploaded and stored in private vault successfully.`, 'success')
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

      notify(`Granted ${grantPermissionLevel} access to ${grantUserEmail} successfully.`, 'success')
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

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const data = await api.getDocuments()
      setDocuments(data)
    } catch (err: any) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  // When a document is selected, load its permissions
  useEffect(() => {
    if (!selectedDoc) return

    setLoadingPerms(true)
    api
      .getDocumentPermissions(selectedDoc.id)
      .then((perms) => setDocPermissions(perms))
      .catch(() => setDocPermissions([]))
      .finally(() => setLoadingPerms(false))
  }, [selectedDoc])

  const categories = useMemo(() => {
    const set = new Set<string>()
    documents.forEach((d) => {
      if (d.category) set.add(d.category)
    })
    return ['ALL', ...Array.from(set)]
  }, [documents])

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      const q = query.toLowerCase()
      const matchesQuery =
        !query ||
        d.title.toLowerCase().includes(q) ||
        d.originalFilename.toLowerCase().includes(q) ||
        (d.projectName && d.projectName.toLowerCase().includes(q)) ||
        d.ownerName.toLowerCase().includes(q) ||
        d.ownerEmail.toLowerCase().includes(q)

      const matchesCategory = categoryFilter === 'ALL' || d.category === categoryFilter

      return matchesQuery && matchesCategory
    })
  }, [documents, query, categoryFilter])

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / pageSize))
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredDocs.slice(start, start + pageSize)
  }, [filteredDocs, currentPage])

  const copyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2eaf5] bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#14213d]">System-Wide Document Registry</h2>
            <span className="rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
              Metadata Oversight
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Inspect document metadata, storage checksums, and explicit document permissions across the entire vault.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-[#2463eb]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Policy Notice Box */}
      <div className="rounded-xl border border-purple-200 bg-[#fbf9ff] p-4 text-xs text-[#334155] flex items-start gap-3">
        <ShieldAlert className="size-4 shrink-0 mt-0.5 text-[#7e4fe3]" />
        <div>
          <strong className="text-[#14213d]">Document-Level Confidentiality Policy:</strong>
          <span className="ml-1 text-[#52637f]">
            The Admin Console displays authorized metadata and integrity checksums. File contents and physical download tokens are protected by person-specific authorization. Administrative privileges do not bypass confidentiality without an explicit permission grant.
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e2eaf5] bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 size-4 text-[#8ba0bf]" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search documents by title, filename, project, or owner email..."
            className="w-full rounded-xl border border-[#d8e2ef] bg-[#f8fbff] py-2 pl-9 pr-3 text-xs text-[#14213d] placeholder:text-[#8ba0bf] focus:border-[#2463eb] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="h-9 rounded-xl border border-[#d8e2ef] bg-[#f8fbff] px-3 text-xs font-semibold text-[#334155] focus:border-[#2463eb] focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e2eaf5] bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#FDE68A] bg-[#FFFBEB] text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
            <tr>
              <th className="px-5 py-3.5">Document Name</th>
              <th className="px-5 py-3.5">Project</th>
              <th className="px-5 py-3.5">Owner / Uploader</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Size & Type</th>
              <th className="px-5 py-3.5">Uploaded</th>
              <th className="px-5 py-3.5 text-right">Access Policy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f4fa]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 animate-spin rounded-full border-2 border-[#2463eb] border-t-transparent" />
                    <span>Loading vault document registry...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedDocs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs text-[#8ca0c2]">
                  No documents found matching your search.
                </td>
              </tr>
            ) : (
              paginatedDocs.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className="cursor-pointer hover:bg-[#fafcff] transition"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf4ff] text-[#2463eb]">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#14213d] truncate">{doc.title}</p>
                        <p className="font-mono text-[10px] text-[#71829d] truncate">
                          {doc.originalFilename}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {doc.projectName ? (
                      <span className="font-semibold text-[#334155]">{doc.projectName}</span>
                    ) : (
                      <span className="text-[#94a3b8] italic">Independent</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-[#14213d]">{doc.ownerName}</p>
                    <p className="text-[10px] text-[#71829d]">{doc.ownerEmail}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md border border-[#e2eaf5] bg-[#fafcff] px-2 py-0.5 text-[10px] font-bold text-[#475569]">
                      {doc.category || 'General'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#546782]">
                    <div>{doc.formattedSize}</div>
                    <div className="text-[10px] text-[#8ca0c2] font-mono truncate max-w-[120px]">
                      {doc.contentType?.split('/')[1] || 'binary'}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-[#71829d]">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <Lock className="size-3" />
                      <span>Restricted</span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e5ebf4] bg-[#fafcff] px-5 py-3 text-xs text-[#64748b]">
            <div>
              Showing page <strong className="text-[#14213d]">{currentPage}</strong> of{' '}
              <strong className="text-[#14213d]">{totalPages}</strong> ({filteredDocs.length} total documents)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="grid size-8 place-items-center rounded-lg border border-[#d8e2ef] bg-white text-slate-600 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="grid size-8 place-items-center rounded-lg border border-[#d8e2ef] bg-white text-slate-600 disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DOCUMENT METADATA DETAIL DRAWER */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-lg bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
            <div>
              <div className="flex items-start justify-between border-b border-[#eef4fa] pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#edf4ff] text-[#2463eb]">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#14213d]">{selectedDoc.title}</h3>
                    <p className="font-mono text-xs text-[#71829d]">{selectedDoc.originalFilename}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {/* Checksum Box */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0] flex items-center gap-1.5">
                      <Hash className="size-3 text-[#2463eb]" />
                      SHA-256 Storage Checksum
                    </span>
                    <button
                      onClick={() => copyChecksum(selectedDoc.sha256Checksum)}
                      className="flex items-center gap-1 text-[10px] font-bold text-[#2463eb] hover:underline"
                    >
                      {copiedHash ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy Hash</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-1.5 break-all font-mono text-[11px] text-[#334155] bg-white p-2 rounded-lg border border-[#e2eaf5]">
                    {selectedDoc.sha256Checksum}
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Project
                    </span>
                    <p className="mt-1 font-bold text-[#14213d]">
                      {selectedDoc.projectName || 'Independent'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      Category
                    </span>
                    <p className="mt-1 font-bold text-[#14213d]">{selectedDoc.category || 'General'}</p>
                  </div>

                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      File Size
                    </span>
                    <p className="mt-1 font-bold text-[#14213d]">{selectedDoc.formattedSize}</p>
                  </div>

                  <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                      MIME Content-Type
                    </span>
                    <p className="mt-1 font-mono text-[11px] text-[#14213d] truncate">
                      {selectedDoc.contentType}
                    </p>
                  </div>
                </div>

                {/* Owner Info */}
                <div className="rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7990b0]">
                    Document Owner & Custodian
                  </span>
                  <div className="mt-1 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#14213d]">{selectedDoc.ownerName}</p>
                      <p className="text-[11px] text-[#71829d]">{selectedDoc.ownerEmail}</p>
                    </div>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      Owner
                    </span>
                  </div>
                </div>

                {/* Active Permissions on this Document */}
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
                  </div>
                  {loadingPerms ? (
                    <div className="py-3 text-center text-[11px] text-[#8ca0c2]">Loading permissions...</div>
                  ) : docPermissions.length === 0 ? (
                    <p className="mt-1 text-[11px] text-[#94a3b8] italic">
                      No explicit permissions granted on this document.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {docPermissions.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-lg border border-[#e2eaf5] bg-white p-2 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-[#14213d]">{p.userEmail}</span>
                            <span className="ml-2 font-mono text-[10px] text-[#71829d]">
                              ({p.permissionLevel})
                            </span>
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                              p.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Access Restriction Alert */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <Lock className="size-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <strong className="block font-bold">Confidential Vault Asset</strong>
                    <p className="mt-0.5 text-[11px] text-amber-800">
                      Physical file downloads and content decryption are restricted to explicit permission grantees. Administrative privileges govern metadata and compliance oversight.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-[#eef4fa] pt-4">
              <button
                onClick={() => setSelectedDoc(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50"
              >
                Close Document Metadata
              </button>
            </div>
          </div>
        </div>
      )}
      {/* UPLOAD DOCUMENT MODAL */}
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
                          className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                            uploadPermissionLevel === 'READ'
                              ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb]'
                              : 'border-[#d8e2ef] bg-white text-[#64748b]'
                          }`}
                        >
                          READ
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadPermissionLevel('EDIT')}
                          className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                            uploadPermissionLevel === 'EDIT'
                              ? 'border-purple-600 bg-purple-50 text-purple-700'
                              : 'border-[#d8e2ef] bg-white text-[#64748b]'
                          }`}
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
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      grantPermissionLevel === 'READ'
                        ? 'border-[#2463eb] bg-[#edf4ff] text-[#2463eb]'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }`}
                  >
                    READ Permission
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantPermissionLevel('EDIT')}
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      grantPermissionLevel === 'EDIT'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-[#d8e2ef] bg-[#fafcff] text-[#64748b]'
                    }`}
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
          className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg animate-in slide-in-from-bottom-2 ${
            toast.type === 'error' ? 'bg-[#e53e3e] text-white' : 'bg-[#14213d] text-white'
          }`}
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
}