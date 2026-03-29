'use client'

import { useState } from 'react'
import { LogEntry } from './LogEntry'
import type { Log, Subject, Area, MemberOption, Team, DisplayMode } from '@/types/app.types'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Props {
  logs: Log[]          // only the assigned open logs
  allLogs: Log[]       // full log list to compute busyTeamIds
  subjects: Subject[]
  areas: Area[]
  teams: Team[]
  members: MemberOption[]
  canEdit: boolean
  displayMode: DisplayMode
}

export function AssignedLogsBanner({ logs, allLogs, subjects, areas, teams, members, canEdit, displayMode }: Props) {
  const T = useTranslations()
  const [showPopup, setShowPopup] = useState(false)

  if (logs.length === 0) return null

  const busyTeamIds = new Set(
    allLogs.filter(l => l.status === 'open').flatMap(l => l.team_ids || [])
  )

  return (
    <>
      <button
        onClick={() => setShowPopup(true)}
        className="w-full bg-red-500 hover:bg-red-600 transition-colors px-4 py-2 flex items-center justify-center gap-2 text-white text-sm font-semibold"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        Je hebt {logs.length} openstaande melding{logs.length !== 1 ? 'en' : ''}. Verwerk {logs.length !== 1 ? 'deze meldingen' : 'deze melding'} zo snel mogelijk.
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </button>

      {showPopup && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowPopup(false)}
        >
          <div
            className="bg-slate-50 dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-xl shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  {T.logbook.assignedBanner} ({logs.length})
                </h2>
              </div>
              <button onClick={() => setShowPopup(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Log list */}
            <div className="overflow-y-auto p-4 space-y-0">
              {logs.map((log, index) => (
                <LogEntry
                  key={log.id}
                  log={log}
                  number={logs.length - index}
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
