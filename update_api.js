const fs = require('fs');
let content = fs.readFileSync('D:/AI_Agents/trust1/lib/api.ts', 'utf8');

if (!content.includes('async getSettings()')) {
  const settingsMethods = `  // Settings
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

  // Stats`;

  content = content.replace('  // Stats', settingsMethods);
  fs.writeFileSync('D:/AI_Agents/trust1/lib/api.ts', content, 'utf8');
  console.log('Successfully added settings methods to api.ts');
} else {
  console.log('Settings methods already present');
}
