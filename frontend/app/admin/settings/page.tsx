"use client"

import React, { useEffect, useState } from 'react'
import {
  User,
  LockKeyhole,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  Save,
  Clock,
  Calendar,
  Mail,
  ShieldAlert,
  Moon,
  Sun,
  ChevronRight,
  Shield,
  KeyRound
} from 'lucide-react'
import { api, getUser, logout, UserProfile } from '../../../lib/api'

type TabKey = 'profile' | 'password' | 'security' | 'preferences'

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Profile Form state
  const [fullName, setFullName] = useState<string>('')
  const [savingProfile, setSavingProfile] = useState<boolean>(false)
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null)

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false)
  const [showNewPass, setShowNewPass] = useState<boolean>(false)
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false)
  const [savingPassword, setSavingPassword] = useState<boolean>(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  // Account Security state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false)

  // Preferences state
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light')
  const [emailAlerts, setEmailAlerts] = useState<boolean>(true)
  const [accessReqAlerts, setAccessReqAlerts] = useState<boolean>(true)
  const [compactDensity, setCompactDensity] = useState<boolean>(false)
  const [prefSavedMsg, setPrefSavedMsg] = useState<string | null>(null)

  // Load authenticated admin profile
  const fetchProfile = async () => {
    setLoadingProfile(true)
    setProfileError(null)
    try {
      const data = await api.getMe()
      setCurrentUser(data)
      setFullName(data.fullName || '')
    } catch (err: any) {
      const local = getUser()
      if (local) {
        setCurrentUser(local)
        setFullName(local.fullName || '')
      } else {
        setProfileError(err?.message || 'Failed to load administrator profile')
      }
    } finally {
      setLoadingProfile(false)
    }
  }

  useEffect(() => {
    fetchProfile()

    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('tv_theme')
      const isDark = storedTheme === 'dark' || document.documentElement.classList.contains('dark')
      setThemeMode(isDark ? 'dark' : 'light')

      const storedPrefs = localStorage.getItem('tv_admin_prefs')
      if (storedPrefs) {
        try {
          const parsed = JSON.parse(storedPrefs)
          if (parsed.emailAlerts !== undefined) setEmailAlerts(parsed.emailAlerts)
          if (parsed.accessReqAlerts !== undefined) setAccessReqAlerts(parsed.accessReqAlerts)
          if (parsed.compactDensity !== undefined) setCompactDensity(parsed.compactDensity)
        } catch {
          // ignore
        }
      }
    }
  }, [])

  // Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSuccessMsg(null)
    setProfileError(null)

    const trimmed = fullName.trim()
    if (!trimmed || trimmed.length < 2) {
      setProfileError('Full name must be at least 2 characters.')
      return
    }

    setSavingProfile(true)
    try {
      const updated = await api.updateProfile(trimmed)
      setCurrentUser(updated)
      setFullName(updated.fullName)
      setProfileSuccessMsg('Profile details successfully updated.')
      setTimeout(() => setProfileSuccessMsg(null), 4000)
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!currentPassword) {
      setPasswordError('Current password is required.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setSavingPassword(true)
    try {
      const res = await api.changePassword(currentPassword, newPassword)
      setPasswordSuccess(res.message || 'Password changed successfully. Your credentials have been securely updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      fetchProfile()
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to change password. Please verify your current password.')
    } finally {
      setSavingPassword(false)
    }
  }

  // Handle Theme Preference
  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setThemeMode(newTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem('tv_theme', newTheme)
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      window.dispatchEvent(new Event('tv_theme_changed'))
    }
  }

  // Save Preferences
  const handleSavePreferences = () => {
    if (typeof window !== 'undefined') {
      const prefs = {
        emailAlerts,
        accessReqAlerts,
        compactDensity,
      }
      localStorage.setItem('tv_admin_prefs', JSON.stringify(prefs))
      setPrefSavedMsg('Preferences saved successfully.')
      setTimeout(() => setPrefSavedMsg(null), 3000)
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return 'AD'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const formatDate = (iso?: string | null) => {
    if (!iso) return 'Not available'
    try {
      return new Date(iso).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner - Clean White with Yellow Accents */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="size-2 rounded-full bg-[#FACC15]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#92400E] dark:text-amber-400">
              Security &amp; Account Settings
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937] dark:text-white">
            Admin Profile &amp; Preferences
          </h1>
          <p className="mt-1 text-xs text-[#4B5563] dark:text-[#94A3B8]">
            Manage your personal administrator identity, credential security, active session, and preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProfile}
            disabled={loadingProfile}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0F172A] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] hover:text-[#92400E] text-[#1F2937] dark:text-[#CBD5E1] transition-all shadow-xs cursor-pointer"
            title="Refresh profile data from backend"
          >
            <RefreshCw className={`size-3.5 ${loadingProfile ? 'animate-spin text-amber-500' : 'text-[#6B7280]'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {profileError && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/20 text-red-700 dark:text-red-400 flex items-start gap-3 text-xs font-medium">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="flex-1 font-medium">{profileError}</div>
        </div>
      )}

      {/* Tabs Navigation - White & Yellow UI */}
      <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1528] p-2 shadow-xs">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto" aria-label="Settings Tabs">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#FACC15] text-[#1F2937] shadow-xs ring-1 ring-yellow-400/40'
                : 'text-[#4B5563] dark:text-[#94A3B8] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] hover:text-[#92400E]'
            }`}
          >
            <User className="size-4" />
            <span>My Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'password'
                ? 'bg-[#FACC15] text-[#1F2937] shadow-xs ring-1 ring-yellow-400/40'
                : 'text-[#4B5563] dark:text-[#94A3B8] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] hover:text-[#92400E]'
            }`}
          >
            <LockKeyhole className="size-4" />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'security'
                ? 'bg-[#FACC15] text-[#1F2937] shadow-xs ring-1 ring-yellow-400/40'
                : 'text-[#4B5563] dark:text-[#94A3B8] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] hover:text-[#92400E]'
            }`}
          >
            <ShieldCheck className="size-4" />
            <span>Account Security</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'preferences'
                ? 'bg-[#FACC15] text-[#1F2937] shadow-xs ring-1 ring-yellow-400/40'
                : 'text-[#4B5563] dark:text-[#94A3B8] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] hover:text-[#92400E]'
            }`}
          >
            <Sliders className="size-4" />
            <span>Preferences</span>
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div>
        {/* ===================== TAB 1: MY PROFILE ===================== */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Identity Summary Card */}
            <div className="lg:col-span-1 bg-white dark:bg-[#0B1528] rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] p-6 shadow-xs flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="size-24 rounded-full bg-[#FACC15] text-[#1F2937] font-black text-2xl flex items-center justify-center shadow-md ring-4 ring-[#FEF08A] dark:ring-yellow-950/40 border-2 border-yellow-400">
                  {getInitials(currentUser?.fullName)}
                </div>
                <div
                  className="absolute bottom-0 right-0 size-6 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0B1528]"
                  title="Account Active"
                />
              </div>

              <h2 className="text-lg font-bold text-[#1F2937] dark:text-white">
                {currentUser?.fullName || 'Sarah Admin'}
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-0.5 break-all">
                {currentUser?.email || 'admin@trustvault.local'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <span className="px-2.5 py-1 text-xs font-extrabold rounded-lg bg-[#FFFBEB] dark:bg-[#1E293B] text-[#92400E] dark:text-amber-400 border border-[#FDE68A] dark:border-[#334155]">
                  Administrator
                </span>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500"></span>
                  {currentUser?.active ? 'Active' : 'Deactivated'}
                </span>
              </div>

              <div className="w-full mt-6 pt-6 border-t border-[#F3F4F6] dark:border-[#1E293B] text-left space-y-3 text-xs text-[#4B5563] dark:text-[#94A3B8]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-[#B45309]" />
                    <span>Member Since</span>
                  </span>
                  <span className="font-semibold text-[#1F2937] dark:text-[#CBD5E1]">
                    {formatDate(currentUser?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-[#B45309]" />
                    <span>Security Updated</span>
                  </span>
                  <span className="font-semibold text-[#1F2937] dark:text-[#CBD5E1]">
                    {formatDate(currentUser?.passwordLastChangedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Edit Form */}
            <div className="lg:col-span-2 bg-white dark:bg-[#0B1528] rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#F3F4F6] dark:border-[#1E293B] pb-4 mb-6">
                <h3 className="text-base font-bold text-[#1F2937] dark:text-white flex items-center gap-2">
                  <span>Personal Profile Details</span>
                </h3>
                <p className="text-xs text-[#4B5563] dark:text-[#94A3B8] mt-1">
                  Update your display name. Changes are persisted to the database and logged in the immutable audit trail.
                </p>
              </div>

              {profileSuccessMsg && (
                <div className="mb-5 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <label htmlFor="fullName" className="block text-xs font-bold text-[#1F2937] dark:text-[#E2E8F0] mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Sarah Admin"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] dark:border-[#334155] bg-white dark:bg-[#070D1E] text-xs text-[#1F2937] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-[#FACC15] transition-all"
                  />
                  <p className="text-[11px] text-[#6B7280] dark:text-[#94A3B8] mt-1">
                    Displayed in audit logs, system event history, and access request reviews.
                  </p>
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-[#1F2937] dark:text-[#E2E8F0] mb-1.5">
                    Email Address <span className="text-xs font-normal text-neutral-400">(Read-Only)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={currentUser?.email || ''}
                      disabled
                      className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#FFFBEB]/40 dark:bg-[#070D1E]/60 text-xs text-[#4B5563] dark:text-[#94A3B8] cursor-not-allowed"
                    />
                    <Mail className="size-4 text-neutral-400 absolute left-3.5 top-2.5" />
                  </div>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#94A3B8] mt-1">
                    Corporate email addresses are permanently bound to identity tokens and require domain-level verification.
                  </p>
                </div>

                <div className="pt-4 border-t border-[#F3F4F6] dark:border-[#1E293B] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFullName(currentUser?.fullName || '')
                      setProfileError(null)
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl border border-[#D1D5DB] dark:border-[#334155] bg-white dark:bg-[#0F172A] hover:bg-[#FFFBEB] dark:hover:bg-[#1E293B] text-[#1F2937] dark:text-[#CBD5E1] transition-all cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-[#1F2937] transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {savingProfile ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="size-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: CHANGE PASSWORD ===================== */}
        {activeTab === 'password' && (
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#0B1528] rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] p-6 sm:p-8 shadow-xs">
            <div className="border-b border-[#F3F4F6] dark:border-[#1E293B] pb-4 mb-6">
              <div className="flex items-center gap-2 text-[#92400E] dark:text-amber-400 mb-1">
                <LockKeyhole className="size-5" />
                <h3 className="text-base font-bold text-[#1F2937] dark:text-white">
                  Change Administrator Password
                </h3>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#94A3B8]">
                Update your account password. The backend verifies your existing password, hashes the new password with BCrypt, and logs an audit event.
              </p>
            </div>

            {passwordError && (
              <div className="mb-5 p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-5 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>{passwordSuccess}</span>
                </div>
                <p className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                  For optimal security, you may continue your current session or sign in again to verify your new credentials.
                </p>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-[#1F2937] dark:text-[#E2E8F0] mb-1.5">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D1D5DB] dark:border-[#334155] bg-white dark:bg-[#070D1E] text-xs text-[#1F2937] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-[#FACC15] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    title={showCurrentPass ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-[#1F2937] dark:text-[#E2E8F0] mb-1.5">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Enter at least 8 characters"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D1D5DB] dark:border-[#334155] bg-white dark:bg-[#070D1E] text-xs text-[#1F2937] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-[#FACC15] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    title={showNewPass ? 'Hide password' : 'Show password'}
                  >
                    {showNewPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-[#1F2937] dark:text-[#E2E8F0] mb-1.5">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Re-enter your new password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D1D5DB] dark:border-[#334155] bg-white dark:bg-[#070D1E] text-xs text-[#1F2937] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-[#FACC15] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    title={showConfirmPass ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-4 rounded-xl bg-[#FFFBEB]/50 dark:bg-[#070D1E]/70 border border-[#FDE68A] dark:border-[#1E293B] space-y-1.5 text-xs">
                <div className="font-bold text-[#92400E] dark:text-amber-400 mb-1">
                  Security Requirements:
                </div>
                <div className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-[#6B7280]'}`}>
                  <span className={`size-1.5 rounded-full ${newPassword.length >= 8 ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                  <span>At least 8 characters long</span>
                </div>
                <div className={`flex items-center gap-2 ${newPassword && newPassword === confirmPassword ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-[#6B7280]'}`}>
                  <span className={`size-1.5 rounded-full ${newPassword && newPassword === confirmPassword ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                  <span>Passwords match exactly</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F3F4F6] dark:border-[#1E293B] flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-[#1F2937] transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPassword ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Verifying &amp; Updating...</span>
                    </>
                  ) : (
                    <>
                      <LockKeyhole className="size-3.5" />
                      <span>Change Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================== TAB 3: ACCOUNT SECURITY ===================== */}
        {activeTab === 'security' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Status Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#0B1528] p-5 rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] shadow-xs">
                <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#94A3B8] mb-2">
                  <span>Account Status</span>
                  <ShieldCheck className="size-4 text-emerald-500" />
                </div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active &amp; Verified</span>
                </div>
                <p className="text-[11px] text-[#4B5563] dark:text-[#94A3B8] mt-1">
                  Account holds active ROLE_ADMIN authority
                </p>
              </div>

              <div className="bg-white dark:bg-[#0B1528] p-5 rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] shadow-xs">
                <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#94A3B8] mb-2">
                  <span>Password Last Updated</span>
                  <Clock className="size-4 text-[#B45309]" />
                </div>
                <div className="text-xs font-bold text-[#1F2937] dark:text-white">
                  {formatDate(currentUser?.passwordLastChangedAt)}
                </div>
                <p className="text-[11px] text-[#4B5563] dark:text-[#94A3B8] mt-1">
                  Tracked via security audit trail
                </p>
              </div>

              <div className="bg-white dark:bg-[#0B1528] p-5 rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] shadow-xs">
                <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#94A3B8] mb-2">
                  <span>Last Recorded Login</span>
                  <Calendar className="size-4 text-[#B45309]" />
                </div>
                <div className="text-xs font-bold text-[#1F2937] dark:text-white">
                  {currentUser?.lastLoginAt ? formatDate(currentUser.lastLoginAt) : 'Current active session'}
                </div>
                <p className="text-[11px] text-[#4B5563] dark:text-[#94A3B8] mt-1">
                  Derived from LOGIN_SUCCESS audit logs
                </p>
              </div>
            </div>

            {/* Security Architecture Information */}
            <div className="bg-white dark:bg-[#0B1528] rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] p-6 sm:p-8 shadow-xs">
              <h3 className="text-base font-bold text-[#1F2937] dark:text-white mb-2 flex items-center gap-2">
                <ShieldAlert className="size-4 text-[#B45309]" />
                <span>Authentication &amp; Session Architecture</span>
              </h3>
              <p className="text-xs text-[#4B5563] dark:text-[#94A3B8] leading-relaxed mb-4">
                TrustVault enforces stateless token authentication with HMAC-SHA256 signatures. Credentials are encrypted using BCrypt key-derivation algorithms.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-[#FDE68A] dark:border-[#1E293B] bg-[#FFFBEB]/40 dark:bg-[#070D1E]/60 space-y-1.5">
                  <div className="font-bold text-[#1F2937] dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span>Stateless JWT Tokens</span>
                  </div>
                  <p className="text-[#4B5563] dark:text-neutral-400">
                    Signed with HMAC-SHA512 keys. Automatically expires according to system token policy.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-[#FDE68A] dark:border-[#1E293B] bg-[#FFFBEB]/40 dark:bg-[#070D1E]/60 space-y-1.5">
                  <div className="font-bold text-[#1F2937] dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span>IP Rate Limiting Active</span>
                  </div>
                  <p className="text-[#4B5563] dark:text-neutral-400">
                    Authentication endpoints are throttled to prevent brute-force attacks and credential stuffing.
                  </p>
                </div>
              </div>
            </div>

            {/* Session Actions Card */}
            <div className="bg-white dark:bg-[#0B1528] rounded-2xl border border-rose-200 dark:border-rose-900/40 p-6 sm:p-8 shadow-xs">
              <h3 className="text-base font-bold text-rose-700 dark:text-rose-400 mb-1 flex items-center gap-2">
                <LogOut className="size-4" />
                <span>Session Termination</span>
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mb-5">
                Terminate your current administrator session or clear all local security tokens across browser tabs.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                  <span>Sign Out</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Clear all stored credentials and terminate session immediately?')) {
                      logout()
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                >
                  <span>Sign Out from All Devices</span>
                </button>
              </div>
            </div>

            {/* Logout Confirmation Dialog */}
            {showLogoutConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
                <div className="bg-white dark:bg-[#0B1528] rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] p-6 max-w-sm w-full shadow-xl space-y-4">
                  <div className="size-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                    <LogOut className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[#1F2937] dark:text-white">
                      Sign Out of TrustVault?
                    </h4>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-1">
                      You will need to enter your corporate credentials to sign back in.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-[#1F2937] dark:text-[#CBD5E1] hover:bg-neutral-50 dark:hover:bg-[#1E293B] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: PREFERENCES ===================== */}
        {activeTab === 'preferences' && (
          <div className="max-w-3xl mx-auto bg-white dark:bg-[#0B1528] rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] p-6 sm:p-8 shadow-xs space-y-8">
            <div className="border-b border-[#F3F4F6] dark:border-[#1E293B] pb-4">
              <h3 className="text-base font-bold text-[#1F2937] dark:text-white flex items-center gap-2">
                <Sliders className="size-4 text-[#B45309]" />
                <span>Personal Application Preferences</span>
              </h3>
              <p className="text-xs text-[#4B5563] dark:text-[#94A3B8] mt-1">
                Customize your display theme, interface density, and administrative notifications.
              </p>
            </div>

            {prefSavedMsg && (
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>{prefSavedMsg}</span>
              </div>
            )}

            {/* Appearance Theme */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#92400E] dark:text-amber-400 mb-3">
                Interface Theme
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    themeMode === 'light'
                      ? 'border-[#FACC15] bg-[#FFFBEB] dark:bg-amber-950/20 ring-2 ring-[#FACC15]/30'
                      : 'border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#FACC15]'
                  }`}
                >
                  <div className="size-9 rounded-lg bg-[#FACC15] text-[#1F2937] flex items-center justify-center shrink-0 font-bold">
                    <Sun className="size-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#1F2937] dark:text-white flex items-center gap-2">
                      <span>Light Theme</span>
                      {themeMode === 'light' && <span className="text-[10px] bg-[#1F2937] text-white px-1.5 py-0.5 rounded-md font-bold">Active</span>}
                    </div>
                    <p className="text-[11px] text-[#4B5563] dark:text-[#94A3B8] mt-0.5">
                      Clean white background with yellow accents and high-contrast typography.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    themeMode === 'dark'
                      ? 'border-[#FACC15] bg-[#FFFBEB] dark:bg-amber-950/20 ring-2 ring-[#FACC15]/30'
                      : 'border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#FACC15]'
                  }`}
                >
                  <div className="size-9 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center shrink-0">
                    <Moon className="size-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#1F2937] dark:text-white flex items-center gap-2">
                      <span>Dark Blue Theme</span>
                      {themeMode === 'dark' && <span className="text-[10px] bg-[#FACC15] text-[#1F2937] px-1.5 py-0.5 rounded-md font-bold">Active</span>}
                    </div>
                    <p className="text-[11px] text-[#4B5563] dark:text-[#94A3B8] mt-0.5">
                      High-contrast deep navy theme optimized for low-light environments.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="pt-6 border-t border-[#F3F4F6] dark:border-[#1E293B]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#92400E] dark:text-amber-400 mb-3">
                Security &amp; Workflow Notifications
              </label>

              <div className="space-y-4 text-xs">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="size-4 mt-0.5 rounded border-neutral-300 text-[#FACC15] focus:ring-[#FACC15] cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-[#1F2937] dark:text-white block">
                      Security Incident Notifications
                    </span>
                    <span className="text-[#4B5563] dark:text-[#94A3B8]">
                      Receive alerts when unauthorized access attempts or suspicious privilege elevations are recorded.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accessReqAlerts}
                    onChange={(e) => setAccessReqAlerts(e.target.checked)}
                    className="size-4 mt-0.5 rounded border-neutral-300 text-[#FACC15] focus:ring-[#FACC15] cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-[#1F2937] dark:text-white block">
                      Pending Access Request Summaries
                    </span>
                    <span className="text-[#4B5563] dark:text-[#94A3B8]">
                      Receive daily digest of document access requests awaiting administrative review.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Layout Density */}
            <div className="pt-6 border-t border-[#F3F4F6] dark:border-[#1E293B]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#92400E] dark:text-amber-400 mb-3">
                Display Density
              </label>

              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="density"
                    checked={!compactDensity}
                    onChange={() => setCompactDensity(false)}
                    className="text-[#FACC15] focus:ring-[#FACC15] cursor-pointer"
                  />
                  <span className="font-bold text-[#1F2937] dark:text-white">Comfortable (Default)</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="density"
                    checked={compactDensity}
                    onChange={() => setCompactDensity(true)}
                    className="text-[#FACC15] focus:ring-[#FACC15] cursor-pointer"
                  />
                  <span className="font-bold text-[#1F2937] dark:text-white">Compact</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F3F4F6] dark:border-[#1E293B] flex items-center justify-end">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-[#1F2937] transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
