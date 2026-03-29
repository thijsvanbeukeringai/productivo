'use client'

import { useState, useTransition, useEffect } from 'react'
import { updateTeam } from '@/lib/actions/settings.actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { Team, Log } from '@/types/app.types'

interface Props {
  teams: Team[]
  liveLogs: Log[]
  projectId: string
}

type TeamStatus = 'busy' | 'available' | 'standby' | 'inactive'

function getTeamStatus(team: Team, busyTeamIds: Set<string>): TeamStatus {
  if (!team.is_active) return 'inactive'
  if (busyTeamIds.has(team.id)) return 'busy'
  if (team.is_standby) return 'standby'
  return 'available'
}

const statusStyle: Record<TeamStatus, string> = {
  busy:      'bg-red-600 hover:bg-red-700 text-white',
  available: 'bg-green-700 hover:bg-green-800 text-white',
  standby:   'bg-yellow-400 hover:bg-yellow-500 text-slate-900',
  inactive:  'bg-slate-400 hover:bg-slate-500 text-white',
}

// ── Team edit popup ──────────────────────────────────────────
interface TeamEditProps {
  team: Team
  status: TeamStatus
  projectId: string
  onClose: () => void
  onSave: (updated: Team) => void
}

function TeamEditPopup({ team, status, projectId, onClose, onSave }: TeamEditProps) {
  const [memberText, setMemberText] = useState(team.member_names.join('\n'))
  const [isActive, setIsActive] = useState(team.is_active)
  const [isStandby, setIsStandby] = useState(team.is_standby)
  const [saving, startSave] = useTransition()

  function handleSave() {
    const memberNames = memberText.split('\n').map(n => n.trim()).filter(Boolean)
    const updated: Team = { ...team, member_names: memberNames, is_active: isActive, is_standby: isStandby }
    onSave(updated) // optimistic update immediately
    startSave(async () => {
      await updateTeam(team.id, projectId, { member_names: memberNames, is_active: isActive, is_standby: isStandby })
      onClose()
    })
  }

  const statusLabel: Record<TeamStatus, string> = {
    busy: 'Bezet (open melding)',
    available: 'Beschikbaar',
    standby: 'Standby',
    inactive: 'Inactief',
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className={cn('w-7 h-7 rounded flex items-center justify-center text-sm font-bold', statusStyle[status])}>
              {team.number}
            </span>
            <h2 className="font-semibold text-slate-900 dark:text-white">Team {team.number}</h2>
            <span className="text-xs text-slate-400">{statusLabel[status]}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Members */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Teamleden <span className="text-xs text-slate-400 font-normal">(één per regel)</span>
            </label>
            <textarea
              value={memberText}
              onChange={e => setMemberText(e.target.value)}
              rows={4}
              placeholder="Jan de Vries&#10;Piet Jansen"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
            />
          </div>

          {/* Status toggles */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setIsActive(!isActive); if (!isActive) setIsStandby(false) }}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
                isActive
                  ? 'bg-green-50 border-green-400 text-green-700'
                  : 'bg-slate-50 border-slate-300 text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400'
              )}
            >
              {isActive ? '✓ Actief' : 'Inactief'}
            </button>
            <button
              type="button"
              disabled={!isActive}
              onClick={() => setIsStandby(!isStandby)}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
                isStandby
                  ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
                  : 'bg-slate-50 border-slate-300 text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400',
                !isActive && 'opacity-40 cursor-not-allowed'
              )}
            >
              {isStandby ? '⏸ Standby' : 'Standby'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Teams Panel ──────────────────────────────────────────────
export function TeamsPanel({ teams: initialTeams, liveLogs, projectId }: Props) {
  const [teams, setTeams] = useState<Team[]>(initialTeams)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)

  // Sync if parent re-renders with new teams (e.g. after page navigation)
  useEffect(() => { setTeams(initialTeams) }, [initialTeams])

  // Realtime: pick up team changes from other users
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`teams-panel-${projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `project_id=eq.${projectId}` },
        (p) => setTeams(prev => prev.map(t => t.id === p.new.id ? { ...t, ...p.new } : t)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  function handleTeamSave(updated: Team) {
    setTeams(prev => prev.map(t => t.id === updated.id ? updated : t))
    setEditingTeam(null)
  }

  const busyTeamIds = new Set(
    liveLogs.filter(l => l.status === 'open').flatMap(l => l.team_ids || [])
  )

  if (teams.length === 0) return null

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Teams
          </span>
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {teams.map(team => {
              const status = getTeamStatus(team, busyTeamIds)
              return (
                <button
                  key={team.id}
                  onClick={() => setEditingTeam(team)}
                  title={team.member_names.length ? team.member_names.join(', ') : `Team ${team.number}`}
                  className={cn(
                    'w-10 h-8 rounded text-sm font-bold transition-all ring-offset-1 hover:ring-2 hover:ring-slate-400',
                    statusStyle[status],
                    status === 'busy' && 'ring-2 ring-red-400'
                  )}
                >
                  {team.number}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 shrink-0">
            {(['available', 'busy', 'standby', 'inactive'] as TeamStatus[]).map(s => (
              <span key={s} className="flex items-center gap-1 text-xs text-slate-400">
                <span className={cn('w-3 h-3 rounded-sm inline-block', statusStyle[s].split(' ')[0])} />
                {{ available: 'Beschikbaar', busy: 'Bezet', standby: 'Standby', inactive: 'Inactief' }[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {editingTeam && (
        <TeamEditPopup
          team={editingTeam}
          status={getTeamStatus(editingTeam, busyTeamIds)}
          projectId={projectId}
          onClose={() => setEditingTeam(null)}
          onSave={handleTeamSave}
        />
      )}
    </>
  )
}
