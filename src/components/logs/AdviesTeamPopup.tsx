'use client'

import { useTransition } from 'react'
import { connectTeamToLog } from '@/lib/actions/log.actions'
import { cn } from '@/lib/utils/cn'
import type { Team, Area } from '@/types/app.types'

interface Props {
  logId: string
  logAreaId: string | null
  areas: Area[]
  availableTeams: Team[]    // already filtered: active + not busy + not connected
  areaTeams: Team[]         // subset of availableTeams that are in the log's area
  onClose: () => void
}

export function AdviesTeamPopup({ logId, logAreaId, areas, availableTeams, areaTeams, onClose }: Props) {
  const [, startAdd] = useTransition()

  const areaName = logAreaId ? areas.find(a => a.id === logAreaId)?.name : null
  const teamsToShow = logAreaId ? areaTeams : availableTeams

  function handleSelect(team: Team) {
    startAdd(async () => {
      await connectTeamToLog(logId, team.id, team.number, 'add')
      window.dispatchEvent(new CustomEvent('log-mutated', { detail: { logId } }))
    })
    onClose()
  }

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
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Team koppelen via advies</h2>
            {areaName && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Beschikbare teams in {areaName}
              </p>
            )}
            {!logAreaId && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Alle beschikbare teams (geen area getagd)
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {teamsToShow.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
              {logAreaId
                ? 'Geen beschikbare teams in deze area.'
                : 'Geen beschikbare teams.'}
            </p>
          ) : (
            <div className="space-y-2">
              {teamsToShow.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleSelect(team)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left',
                    'border-green-200 dark:border-green-900/50 hover:bg-green-50 dark:hover:bg-green-950/20'
                  )}
                >
                  <span className="w-8 h-8 rounded bg-green-700 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {team.number}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      Team {team.number}
                      {team.is_standby && (
                        <span className="ml-1.5 text-xs text-yellow-600 dark:text-yellow-400 font-normal">standby</span>
                      )}
                    </div>
                    {team.member_names.length > 0 && (
                      <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {team.member_names.join(', ')}
                      </div>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
