'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminDashboardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f8fd]">
      <div className="flex items-center gap-3 text-xs font-semibold text-[#8194ad]">
        <div className="size-4 animate-spin rounded-full border-2 border-[#2463eb] border-t-transparent" />
        <span>Redirecting to Admin Console Overview...</span>
      </div>
    </div>
  )
}
