const fs = require('fs');

let content = fs.readFileSync('D:/AI_Agents/trust1/app/login/page.tsx', 'utf8');

content = content.replace(
  '<div className="mt-3 grid grid-cols-3 gap-2">',
  '<div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">'
);

const editorButton = `              <button
                type="button"
                onClick={() => quickFill('editor@trustvault.local', 'TrustVault@2025!')}
                className="rounded-xl border border-[#d8e2ef] bg-white p-2.5 text-center text-[11px] font-semibold text-[#14213D] transition hover:border-[#14B8A6] hover:bg-[#EAF0F8]"
              >
                <div className="font-extrabold text-amber-600">EDITOR</div>
                <div className="text-[10px] text-[#71829d]">Alex Rivera</div>
              </button>
            </div>`;

content = content.replace(
`              <button
                type="button"
                onClick={() => quickFill('viewer@trustvault.local', 'TrustVault@2025!')}
                className="rounded-xl border border-[#d8e2ef] bg-white p-2.5 text-center text-[11px] font-semibold text-[#14213D] transition hover:border-[#14B8A6] hover:bg-[#EAF0F8]"
              >
                <div className="font-extrabold text-[#243B64]">VIEWER</div>
                <div className="text-[10px] text-[#71829d]">Sam Williams</div>
              </button>
            </div>`,
`              <button
                type="button"
                onClick={() => quickFill('viewer@trustvault.local', 'TrustVault@2025!')}
                className="rounded-xl border border-[#d8e2ef] bg-white p-2.5 text-center text-[11px] font-semibold text-[#14213D] transition hover:border-[#14B8A6] hover:bg-[#EAF0F8]"
              >
                <div className="font-extrabold text-[#243B64]">VIEWER</div>
                <div className="text-[10px] text-[#71829d]">Sam Williams</div>
              </button>
${editorButton}`
);

fs.writeFileSync('D:/AI_Agents/trust1/app/login/page.tsx', content, 'utf8');
console.log('Successfully updated login page with EDITOR button');
