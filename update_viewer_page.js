const fs = require('fs');

const viewerPageContent = `import WorkshopDashboard from '../../../components/dashboard/WorkshopDashboard'

export default function ViewerDashboardPage() {
  return <WorkshopDashboard />
}
`;

fs.writeFileSync('D:/AI_Agents/trust1/app/viewer/dashboard/page.tsx', viewerPageContent, 'utf8');
console.log('Updated app/viewer/dashboard/page.tsx');

fs.mkdirSync('D:/AI_Agents/trust1/app/editor/dashboard', { recursive: true });
fs.writeFileSync('D:/AI_Agents/trust1/app/editor/dashboard/page.tsx', viewerPageContent, 'utf8');
console.log('Created app/editor/dashboard/page.tsx');
