'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, getUser } from '../lib/api'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const token = getToken()
    const user = getUser()

    if (!token || !user) {
      router.replace('/login')
      return
    }

    if (user.role === 'ROLE_ADMIN') {
      router.replace('/admin')
    } else if (user.role === 'ROLE_OWNER') {
      router.replace('/owner/dashboard')
    } else {
      router.replace('/viewer/dashboard')
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f8fd]">
      <div className="flex items-center gap-3 text-xs font-semibold text-[#8194ad]">
        <div className="size-4 animate-spin rounded-full border-2 border-[#2463eb] border-t-transparent" />
        <span>Redirecting to your authorized TrustVault workspace...</span>
      </div>
    </div>
  )
}
