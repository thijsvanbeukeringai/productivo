'use client'

import { useRealtimeLogs } from '@/lib/hooks/useRealtimeLogs'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LogEntry } from './LogEntry'
import { TeamsPanel } from './TeamsPanel'
import type { Log, Subject, Area, MemberOption, Team } from '@/types/app.types'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Props {
  projectId: string
  initialLogs: Log[]
  subjects: Subject[]
  areas: Area[]
  teams: Team[]
  members: MemberOption[]
  canEdit: boolean
  displayMode: 'dynamic' | 'fixed' | 'cp_org'
  currentPage: number
  totalCount: number
  pageSize: number
}

export function LogFeed({ projectId, initialLogs, subjects, areas, teams, members, canEdit, displayMode, currentPage, totalCount, pageSize }: Props) {
  const T = useTranslations()
  const logs = useRealtimeLogs(projectId, initialLogs)
  const searchParams = useSearchParams()
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  function buildPageUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    return `?${params.toString()}`
  }

  // Teams currently busy (connected to an open log)
  const busyTeamIds = new Set(
    logs.filter(l => l.status === 'open').flatMap(l => l.team_ids || [])
  )

  return (
    <div>
      {/* Teams panel — only in dynamic mode */}
      {displayMode === 'dynamic' && (
        <TeamsPanel teams={teams} liveLogs={logs} projectId={projectId} />
      )}

      {logs.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium">{T.logbook.noLogs}</p>
          <p className="text-xs mt-1">Gebruik het formulier hierboven om een melding te loggen</p>
        </div>
      ) : (
        <>
          {logs.map((log, index) => (
            <LogEntry
              key={log.id}
              log={log}
              number={log.log_number ?? (logs.length - index)}
              subjects={subjects}
              areas={areas}
              teams={teams}
              busyTeamIds={busyTeamIds}
              members={members}
              canEdit={canEdit}
              isDynamic={displayMode === 'dynamic'}
              isCpOrg={displayMode === 'cp_org'}
            />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-xs text-slate-400">
                {totalCount} logs — {T.logbook.page} {currentPage} {T.logbook.of} {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Link
                  href={buildPageUrl(currentPage - 1)}
                  aria-disabled={currentPage <= 1}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    currentPage <= 1
                      ? 'border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 pointer-events-none'
                      : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  ← Vorige
                </Link>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`dots-${i}`} className="px-2 text-xs text-slate-400">…</span>
                    ) : (
                      <Link
                        key={p}
                        href={buildPageUrl(p as number)}
                        className={`w-8 h-8 flex items-center justify-center text-xs rounded-lg border transition-colors ${
                          p === currentPage
                            ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent font-semibold'
                            : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {p}
                      </Link>
                    )
                  )}

                <Link
                  href={buildPageUrl(currentPage + 1)}
                  aria-disabled={currentPage >= totalPages}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    currentPage >= totalPages
                      ? 'border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 pointer-events-none'
                      : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Volgende →
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
