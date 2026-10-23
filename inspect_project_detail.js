const fs = require('fs');
const lines = fs.readFileSync('D:/AI_Agents/trust1/components/dashboard/ManagerDashboard.tsx', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes("projectDetailTab === 'overview'")) {
    console.log('Found at line', i + 1);
    console.log(lines.slice(i, i + 35).join('\n'));
  }
});
