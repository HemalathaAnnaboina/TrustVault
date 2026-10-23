const fs = require('fs');
let content = fs.readFileSync('D:/AI_Agents/trust1/lib/api.ts', 'utf8');

// 1. Role in UserProfile
content = content.replace(
  "role: 'ROLE_ADMIN' | 'ROLE_OWNER' | 'ROLE_VIEWER'",
  "role: 'ROLE_ADMIN' | 'ROLE_OWNER' | 'ROLE_VIEWER' | 'ROLE_EDITOR'"
);

// 2. Interfaces
if (!content.includes('export interface DocumentPreviewItem')) {
  const extraInterfaces = `
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
`;
  content = content.replace('export interface AccessRequestItem', extraInterfaces + '\nexport interface AccessRequestItem');
}

// 3. AccessRequestItem update
content = content.replace(
`export interface AccessRequestItem {
  id: string
  documentId: string
  documentTitle: string`,
`export interface AccessRequestItem {
  id: string
  documentId?: string | null
  documentTitle?: string | null
  projectId?: string | null
  projectName?: string | null
  requestedFilename?: string | null
  durationDays?: number`
);

// 4. Methods: getDocumentPreview, getDocumentVersions, getMyActivity
if (!content.includes('getDocumentPreview(')) {
  const docMethods = `  async getDocumentPreview(id: string): Promise<DocumentPreviewItem> {
    return request<DocumentPreviewItem>(\`/documents/\${id}/preview\`)
  },

  async getDocumentVersions(id: string): Promise<DocumentVersionItem[]> {
    return request<DocumentVersionItem[]>(\`/documents/\${id}/versions\`)
  },
`;
  content = content.replace('  async getDocument(id: string): Promise<DocumentItem> {', docMethods + '  async getDocument(id: string): Promise<DocumentItem> {');
}

if (!content.includes('getMyActivity()')) {
  const activityMethod = `  async getMyActivity(): Promise<AuditLogItem[]> {
    return request<AuditLogItem[]>('/audit-logs/my-activity')
  },
`;
  content = content.replace('  async getAuditLogs(', activityMethod + '  async getAuditLogs(');
}

// 5. Update createAccessRequest signature & body
const oldCreateAccess = /async createAccessRequest\(data: \{[^}]+\}\): Promise<AccessRequestItem> \{[\s\S]*?return request<AccessRequestItem>\('\/requests', \{[\s\S]*?\}\)\s*\},/;

const newCreateAccess = `async createAccessRequest(data: {
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
  },`;

content = content.replace(oldCreateAccess, newCreateAccess);

fs.writeFileSync('D:/AI_Agents/trust1/lib/api.ts', content, 'utf8');
console.log('Successfully updated D:/AI_Agents/trust1/lib/api.ts');
