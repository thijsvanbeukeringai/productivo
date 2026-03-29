'use client'

import { useState, useEffect } from 'react'
import { updateUserProfile, updateProjectMemberSettings } from '@/lib/actions/settings.actions'
import { logout } from '@/lib/actions/auth.actions'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LANG_OPTIONS, type Lang } from '@/lib/i18n/translations'
import type { DisplayMode } from '@/types/app.types'

interface Props {
  projectId: string
  userId: string
  email: string
  fullName: string | null
  customDisplayName: string | null
  displayMode: DisplayMode
  onClose: () => void
}

export function UserProfilePopup({
  projectId, userId, email, fullName, customDisplayName, displayMode, onClose
}: Props) {
  const { lang, setLang, T } = useLanguage()
  const [name, setName] = useState(fullName || '')
  const [screenName, setScreenName] = useState(customDisplayName || '')
  const [selectedMode, setSelectedMode] = useState<DisplayMode>(displayMode)
  const [selectedLang, setSelectedLang] = useState<Lang>(lang)
  const [darkMode, setDarkMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const displayModes: { value: DisplayMode; label: string }[] = [
    { value: 'dynamic', label: T.profile.modeDynamic },
    { value: 'fixed',   label: T.profile.modeFixed },
    { value: 'cp_org',  label: T.profile.modeCpo },
  ]

  // Sync dark mode state from DOM
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'))
  }, [])

  function toggleDarkMode() {
    const isDark = document.documentElement.classList.contains('dark')
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('ims-theme', 'light')
      setDarkMode(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('ims-theme', 'dark')
      setDarkMode(true)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const [profileResult, memberResult] = await Promise.all([
      updateUserProfile({ full_name: name, language: selectedLang }),
      updateProjectMemberSettings(projectId, {
        custom_display_name: screenName || undefined,
        display_mode: selectedMode,
      }),
    ])

    setSaving(false)
    if (profileResult.error) {
      setError(profileResult.error)
    } else if (memberResult && 'error' in memberResult && memberResult.error) {
      setError(memberResult.error as string)
    } else {
      // Apply language change immediately
      if (selectedLang !== lang) setLang(selectedLang)
      onClose()
    }
  }

  // Initials for avatar
  const initials = (name || email).substring(0, 2).toUpperCase()

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">{T.profile.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold select-none">
              {initials}
            </div>
          </div>

          {/* Full name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
              {T.profile.name}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
              {T.profile.email}
            </label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 cursor-not-allowed"
            />
          </div>

          {/* Screen name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
              {T.profile.screenName}
            </label>
            <input
              type="text"
              value={screenName}
              onChange={e => setScreenName(e.target.value)}
              placeholder={name || email}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{T.profile.screenNameHint}</p>
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
              {T.profile.language}
            </label>
            <select
              value={selectedLang}
              onChange={e => setSelectedLang(e.target.value as Lang)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LANG_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Mode + Darkmode */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
              {T.profile.mode}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {displayModes.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors select-none"
                  onClick={() => setSelectedMode(value)}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedMode === value
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {selectedMode === value && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                </label>
              ))}

              {/* Darkmode toggle */}
              <label
                className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors select-none"
                onClick={toggleDarkMode}
              >
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  darkMode
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {darkMode && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{T.profile.darkMode}</span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 pb-4 gap-2">
          {/* Delete account */}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            >
              {T.profile.deleteAccount}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 dark:text-red-400">{T.profile.areYouSure}</span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-colors"
              >
                {T.profile.no}
              </button>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 font-semibold transition-colors"
                >
                  {T.profile.yesLogout}
                </button>
              </form>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {T.profile.cancel}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? T.profile.saving : T.profile.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
