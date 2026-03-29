'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DigitalClock } from '@/components/shared/DigitalClock'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { logout } from '@/lib/actions/auth.actions'
import { UserProfilePopup } from './UserProfilePopup'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { ReminderManager } from '@/components/notifications/ReminderManager'
import { useTranslations } from '@/lib/i18n/LanguageContext'
import type { Project, Team, DisplayMode } from '@/types/app.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMember = any

interface Props {
  project: Project
  projectId: string
  standbyTeams: Team[]
  currentMember: AnyMember
  userEmail?: string
  canAdmin?: boolean
  isSuperAdmin?: boolean
  userId?: string
}

export function ProjectHeader({ project, projectId, standbyTeams, currentMember, userEmail = '', canAdmin = false, isSuperAdmin = false, userId = '' }: Props) {
  const [showProfile, setShowProfile] = useState(false)
  const pathname = usePathname()
  const T = useTranslations()

  const logbookSegments = ['/logbook', '/dashboard', '/areas', '/weer']
  const isLogbookModule = logbookSegments.some(seg => pathname.includes(seg))
  const isCrewModule = pathname.includes('/crew')

  const displayName = currentMember.custom_display_name ||
    currentMember.profiles?.full_name || currentMember.profile?.full_name || T.common.unknown
  const fullName = currentMember.profiles?.full_name || currentMember.profile?.full_name || null
  const currentMode = (currentMember.display_mode || 'dynamic') as DisplayMode

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center gap-3">
      {/* Left: Breadcrumb + logbook sub-nav */}
      <nav className="flex items-center gap-1 text-sm">
        <Link
          href="/dashboard"
          className="px-2 py-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          {T.nav.projects}
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="font-semibold text-slate-900 dark:text-white px-2">{project.name}</span>

        {isLogbookModule && (
          <div className="flex items-center gap-1 ml-2">
            <Link href={`/project/${project.id}/logbook`}
              className="px-3 py-1.5 text-xs rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
              {T.nav.logbook}
            </Link>
            <Link href={`/project/${project.id}/dashboard`}
              className="px-3 py-1.5 text-xs rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
              {T.nav.dashboard}
            </Link>
            <Link href={`/project/${project.id}/areas`}
              className="px-3 py-1.5 text-xs rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
              {T.nav.areas}
            </Link>
            <Link href={`/project/${project.id}/weer`}
              className="px-3 py-1.5 text-xs rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
              {T.nav.weather}
            </Link>
          </div>
        )}

        {isCrewModule && (
          <div className="flex items-center gap-1 ml-2">
            <Link href={`/project/${project.id}/crew`}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                pathname === `/project/${project.id}/crew`
                  ? 'bg-slate-100 dark:bg-slate-700 font-medium text-slate-900 dark:text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
              {T.nav.planning}
            </Link>
            <Link href={`/project/${project.id}/crew/rooster`}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                pathname.includes('/crew/rooster')
                  ? 'bg-slate-100 dark:bg-slate-700 font-medium text-slate-900 dark:text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
              {T.nav.rooster}
            </Link>
            <Link href={`/project/${project.id}/crew/checkin`}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                pathname.includes('/crew/checkin')
                  ? 'bg-slate-100 dark:bg-slate-700 font-medium text-slate-900 dark:text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
              {T.nav.checkin}
            </Link>
          </div>
        )}
      </nav>

      {/* Center: Standby teams */}
      <div className="flex-1 flex items-center gap-2 justify-center overflow-x-auto">
        {standbyTeams.length > 0 && (
          <>
            <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{T.nav.standby}</span>
            {standbyTeams.map(team => (
              <span key={team.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                {T.nav.team} {team.number}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Right: Clock + User profile + Theme */}
      <div className="flex items-center gap-1.5">
        {isLogbookModule && <DigitalClock />}
        {isLogbookModule && <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-1" />}
        {isLogbookModule && userId && <NotificationBell projectId={projectId} userId={userId} />}
        {isLogbookModule && userId && <ReminderManager projectId={projectId} />}

        {/* User button — just name, opens profile */}
        <button
          onClick={() => setShowProfile(true)}
          className="px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          {displayName}
        </button>

        {isSuperAdmin && (
          <Link
            href="/admin"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors"
            title="Super Admin"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </Link>
        )}
        <ThemeToggle />
        <Link
          href={`/project/${project.id}/settings`}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          title={T.nav.settings}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
        <form action={logout}>
          <button type="submit"
            className="px-2 py-1.5 text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors">
            {T.nav.logout}
          </button>
        </form>
      </div>

      {showProfile && (
        <UserProfilePopup
          projectId={projectId}
          userId={currentMember.user_id || ''}
          email={userEmail}
          fullName={fullName}
          customDisplayName={currentMember.custom_display_name || null}
          displayMode={currentMode}
          onClose={() => setShowProfile(false)}
        />
      )}
    </header>
  )
}
