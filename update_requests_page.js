const fs = require('fs');
const filePath = 'D:/AI_Agents/trust1/app/admin/requests/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add missing imports
if (!content.includes('Check,')) {
  content = content.replace("  X,\n", "  X,\n  Check,\n  Plus,\n");
}

// 2. Add state for review modal and toast
const stateTarget = "  const [selectedRequest, setSelectedRequest] = useState<AccessRequestItem | null>(null)\n";
const stateAdditions = `  const [selectedRequest, setSelectedRequest] = useState<AccessRequestItem | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Review Modal State
  const [reviewModalReq, setReviewModalReq] = useState<AccessRequestItem | null>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewExpiryDays, setReviewExpiryDays] = useState('0')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
`;

content = content.replace(stateTarget, stateAdditions);

// 3. Add helper methods
const loadReqsTarget = "  const loadRequests = async () => {\n";
const helperMethods = `  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const openReviewModal = (req: AccessRequestItem, action: 'APPROVE' | 'REJECT') => {
    setReviewModalReq(req)
    setReviewAction(action)
    setReviewNote('')
    setReviewExpiryDays('0')
    setReviewError(null)
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewModalReq) return
    setSubmittingReview(true)
    setReviewError(null)

    try {
      const isApproved = reviewAction === 'APPROVE'
      let expiresAt: string | null = null
      if (isApproved) {
        const days = parseInt(reviewExpiryDays, 10)
        if (days > 0) {
          expiresAt = new Date(Date.now() + days * 86400000).toISOString()
        }
      }

      await api.reviewAccessRequest(reviewModalReq.id, {
        approved: isApproved,
        reviewNote: reviewNote.trim() || undefined,
        expiresAt,
      })

      notify(
        isApproved
          ? \`Access request for \${reviewModalReq.requesterEmail} approved. Explicit permission grant created.\`
          : \`Access request for \${reviewModalReq.requesterEmail} rejected.\`,
        'success'
      )

      setReviewModalReq(null)
      if (selectedRequest?.id === reviewModalReq.id) {
        setSelectedRequest(null)
      }
      await loadRequests()
    } catch (err: any) {
      setReviewError(err.message || 'Failed to submit review determination')
    } finally {
      setSubmittingReview(false)
    }
  }

  const loadRequests = async () => {\n`;

content = content.replace(loadReqsTarget, helperMethods);

// 4. In Table Header, add Actions column
const oldTh = `              <th className="px-5 py-3.5 text-right">Current Status</th>
            </tr>`;

const newTh = `              <th className="px-5 py-3.5 text-right">Current Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>`;

content = content.replace(oldTh, newTh);

// 5. In Table Row, add Actions buttons
const oldRowEnd = `                    </span>
                  </td>
                </tr>`;

const newRowEnd = `                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {req.status === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openReviewModal(req, 'APPROVE')}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => openReviewModal(req, 'REJECT')}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-[#94a3b8] italic">Reviewed</span>
                      )}
                    </div>
                  </td>
                </tr>`;

content = content.replace(oldRowEnd, newRowEnd);

// 6. In Request Drawer footer, add Approve/Reject buttons if PENDING
const oldDrawerFooter = `            <div className="mt-6 border-t border-[#eef4fa] pt-4">
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50"
              >
                Close Request Details
              </button>
            </div>`;

const newDrawerFooter = `            <div className="mt-6 border-t border-[#eef4fa] pt-4 space-y-2">
              {selectedRequest.status === 'PENDING' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openReviewModal(selectedRequest, 'APPROVE')}
                    className="h-9 rounded-xl border border-emerald-300 bg-emerald-600 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                  >
                    Approve Request
                  </button>
                  <button
                    type="button"
                    onClick={() => openReviewModal(selectedRequest, 'REJECT')}
                    className="h-9 rounded-xl border border-rose-300 bg-rose-600 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
                  >
                    Reject Request
                  </button>
                </div>
              )}
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-full h-9 rounded-xl border border-[#d8e2ef] bg-white text-xs font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
              >
                Close Request Details
              </button>
            </div>`;

content = content.replace(oldDrawerFooter, newDrawerFooter);

// 7. Add Review Modal & Toast before closing div
const modalAndToast = `      {/* REVIEW ACCESS REQUEST MODAL */}
      {reviewModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#d8e2ef] bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#eef4fa] pb-3.5">
              <div className="flex items-center gap-2">
                <div
                  className={\`grid size-8 place-items-center rounded-lg \${
                    reviewAction === 'APPROVE'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-rose-50 text-rose-600'
                  }\`}
                >
                  {reviewAction === 'APPROVE' ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-[#14213d]">
                  {reviewAction === 'APPROVE' ? 'Approve Access Request' : 'Reject Access Request'}
                </h3>
              </div>
              <button
                onClick={() => setReviewModalReq(null)}
                className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1.5 rounded-xl border border-[#e2eaf5] bg-[#fafcff] p-3 text-xs">
              <p className="text-[#64748b]">
                Document: <strong className="text-[#14213d]">{reviewModalReq.documentTitle}</strong>
              </p>
              <p className="text-[#64748b]">
                Requester: <strong className="text-[#14213d]">{reviewModalReq.requesterName}</strong> ({reviewModalReq.requesterEmail})
              </p>
              <p className="text-[#64748b]">
                Requested Level: <strong className="text-[#2463eb]">{reviewModalReq.requestedPermission}</strong>
              </p>
              <p className="text-[#64748b]">
                Reason: <em>"{reviewModalReq.reason}"</em>
              </p>
            </div>

            {reviewError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <span>{reviewError}</span>
              </div>
            )}

            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4 text-xs">
              {reviewAction === 'APPROVE' && (
                <div>
                  <label className="block font-bold text-[#14213d] mb-1">
                    Grant Expiration Period
                  </label>
                  <select
                    value={reviewExpiryDays}
                    onChange={(e) => setReviewExpiryDays(e.target.value)}
                    className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:outline-none"
                  >
                    <option value="0">Never Expires (Indefinite Grant)</option>
                    <option value="7">Expires in 7 days</option>
                    <option value="14">Expires in 14 days</option>
                    <option value="30">Expires in 30 days</option>
                    <option value="90">Expires in 90 days</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-[#14213d] mb-1">
                  Reviewer Note {reviewAction === 'REJECT' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  required={reviewAction === 'REJECT'}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    reviewAction === 'APPROVE'
                      ? 'Optional determination note or compliance justification...'
                      : 'Please specify the reason for rejection...'
                  }
                  rows={3}
                  className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] p-3 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#eef4fa]">
                <button
                  type="button"
                  onClick={() => setReviewModalReq(null)}
                  className="h-9 rounded-xl border border-[#d8e2ef] px-4 font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className={\`flex h-9 items-center gap-1.5 rounded-xl px-4 font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer \${
                    reviewAction === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }\`}
                >
                  {submittingReview ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : reviewAction === 'APPROVE' ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <XCircle className="size-3.5" />
                  )}
                  <span>
                    {reviewAction === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
                  </span>
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

content = content.slice(0, content.lastIndexOf('    </div>\n  )\n}')) + modalAndToast;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated requests/page.tsx with Approve and Reject features');
