const fs = require('fs');
const filePath = 'D:/AI_Agents/trust1/app/admin/users/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Eye and EyeOff to imports
if (!content.includes('EyeOff')) {
  content = content.replace("  ChevronRight,\n", "  ChevronRight,\n  Eye,\n  EyeOff,\n");
}

// 2. Add password state
if (!content.includes('const [password, setPassword]')) {
  content = content.replace(
    "  const [email, setEmail] = useState('')\n",
    "  const [email, setEmail] = useState('')\n  const [password, setPassword] = useState('')\n  const [showPassword, setShowPassword] = useState(false)\n"
  );
}

// 3. Update handleCreateUser to validate and submit password, and reset state
const oldHandleCreate = `    const emailTrimmed = email.trim().toLowerCase()
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
    if (!emailRegex.test(emailTrimmed)) {
      setFormError('Please enter a valid company email address (e.g. name@company.com)')
      return
    }

    setSubmitting(true)
    try {
      await api.createUser({
        fullName: fullName.trim(),
        email: emailTrimmed,
        role,
        initialProjectId: initialProjectId || undefined,
      })

      notify(\`User "\${fullName.trim()}" (\${role.replace('ROLE_', '')}) provisioned successfully in PostgreSQL\`, 'success')
      setCreateModalOpen(false)
      setFullName('')
      setEmail('')
      setRole('ROLE_VIEWER')
      setInitialProjectId('')
      await loadData()`;

const newHandleCreate = `    const emailTrimmed = email.trim().toLowerCase()
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
    if (!emailRegex.test(emailTrimmed)) {
      setFormError('Please enter a valid company email address (e.g. name@company.com)')
      return
    }

    if (!password || password.length < 8) {
      setFormError('Password is required and must be at least 8 characters')
      return
    }

    setSubmitting(true)
    try {
      await api.createUser({
        fullName: fullName.trim(),
        email: emailTrimmed,
        role,
        password: password.trim(),
        initialProjectId: initialProjectId || undefined,
      })

      notify(\`User "\${fullName.trim()}" provisioned successfully. They can now log in immediately.\`, 'success')
      setCreateModalOpen(false)
      setFullName('')
      setEmail('')
      setPassword('')
      setShowPassword(false)
      setRole('ROLE_VIEWER')
      setInitialProjectId('')
      await loadData()`;

content = content.replace(oldHandleCreate, newHandleCreate);

// 4. Add Password input right after Corporate Email input
const oldEmailBlock = `              {/* Company Email */}
              <div>
                <label className="block text-xs font-bold text-[#14213d]">
                  Corporate Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-[#71829d]">
                  Email uniqueness is enforced in PostgreSQL. Account will be created in Active status.
                </p>
              </div>`;

const newEmailAndPasswordBlock = `              {/* Company Email */}
              <div>
                <label className="block text-xs font-bold text-[#14213d]">
                  Corporate Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="mt-1 w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-[#71829d]">
                  Email uniqueness is enforced by the database. Account will be created in Active status.
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-[#14213d]">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-[#d8e2ef] bg-[#fafcff] px-3 py-2 pr-10 text-xs text-[#14213d] focus:border-[#2463eb] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[#71829d]">
                  Stored securely using BCrypt. Newly created user can immediately log in with this password.
                </p>
              </div>`;

content = content.replace(oldEmailBlock, newEmailAndPasswordBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated users/page.tsx with password field and validation');
