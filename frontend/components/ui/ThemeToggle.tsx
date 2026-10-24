'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('tv_theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialDark = stored === 'dark' || (!stored && prefersDark)
    setIsDark(initialDark)
    if (initialDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    const handleThemeEvent = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    window.addEventListener('tv_theme_changed', handleThemeEvent)
    return () => window.removeEventListener('tv_theme_changed', handleThemeEvent)
  }, [])

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('tv_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('tv_theme', 'light')
    }
    window.dispatchEvent(new Event('tv_theme_changed'))
  }

  if (!mounted) {
    return (
      <div className={`size-9 rounded-xl border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-60 ${className}`} />
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Blue Theme'}
      aria-label="Toggle color theme"
      className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
        isDark
          ? 'border-[#24355E] bg-[#131E3D] hover:bg-[#1A264A] text-[#F3F4F6]'
          : 'border-[#E2E8F0] bg-white hover:bg-neutral-50 text-[#111827]'
      } ${className}`}
    >
      {isDark ? (
        <>
          <Sun className="size-4 text-amber-400 group-hover:rotate-45 transition-transform" />
          <span className="text-xs font-bold tracking-tight text-white">Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="size-4 text-emerald-600 group-hover:-rotate-12 transition-transform" />
          <span className="text-xs font-bold tracking-tight text-[#111827]">Dark Mode</span>
        </>
      )}
    </button>
  )
}
