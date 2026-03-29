'use client'

import { useState, useTransition } from 'react'
import { LogEditPopup } from './LogEditPopup'
import { FollowUpPopup } from './FollowUpPopup'
import { AdviesTeamPopup } from './AdviesTeamPopup'
import { toggleLogStatus, updateLog, deleteLog, connectTeamToLog } from '@/lib/actions/log.actions'
import { formatTimestamp } from '@/lib/utils/format-timestamp'
import { enforcementConfig, priorityConfig } from '@/lib/utils/priority-colors'
import { cn } from '@/lib/utils/cn'
import type { Log, Subject, Area, MemberOption, Team } from '@/types/app.types'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Props {
  log: Log
  number: number
  subjects: Subject[]
  areas: Area[]
  teams: Team[]
  busyTeamIds: Set<string>
  members: MemberOption[]
  canEdit: boolean
  isDynamic: boolean
  isCpOrg: boolean
}

export function LogEntry({ log, number, subjects, areas, teams, busyTeamIds, members, canEdit, isDynamic, isCpOrg }: Props) {
  const T = useTranslations()
  const [showEdit, setShowEdit] = useState(false)
  const [showFollowup, setShowFollowup] = useState(false)
  const [showAdvies, setShowAdvies] = useState(false)
  const [followupPrefix, setFollowupPrefix] = useState('')
  const [toggling, startToggle] = useTransition()
  const [, startUpdate] = useTransition()

  const cfg = priorityConfig[log.priority]
  const enforcement = log.enforcement_type ? enforcementConfig[log.enforcement_type] : null
  const connectedTeams = teams.filter(t => (log.team_ids || []).includes(t.id))
  // Available = active + not connected to this log + not busy on another open log
  const availableTeams = teams.filter(t =>
    t.is_active &&
    !(log.team_ids || []).includes(t.id) &&
    !busyTeamIds.has(t.id)
  )
  // For advies: available teams filtered to the log's area
  const areaTeams = availableTeams.filter(t => t.area_id === log.area_id)

  const bodyBg = log.status === 'open'
    ? 'bg-red-50 dark:bg-red-950/20'
    : 'bg-green-50 dark:bg-green-950/20'

  function dispatch(logId: string, deleted = false) {
    window.dispatchEvent(new CustomEvent('log-mutated', { detail: { logId, deleted } }))
  }

  function handleToggleStatus() {
    startToggle(async () => {
      await toggleLogStatus(log.id, log.status)
      dispatch(log.id)
    })
  }

  function handleInlineUpdate(field: 'subject_id' | 'assigned_user_id', value: string) {
    startUpdate(async () => {
      await updateLog(log.id, { [field]: value || null })
      dispatch(log.id)
    })
  }

  function handleAddTeam(e: React.ChangeEvent<HTMLSelectElement>) {
    const teamId = e.target.value
    if (!teamId) return
    const team = teams.find(t => t.id === teamId)
    if (team) startUpdate(async () => {
      await connectTeamToLog(log.id, teamId, team.number, 'add')
      dispatch(log.id)
    })
    e.target.value = ''
  }

  function handleRemoveTeam(teamId: string, teamNumber: number) {
    startUpdate(async () => {
      await connectTeamToLog(log.id, teamId, teamNumber, 'remove')
      dispatch(log.id)
    })
  }

  function handleDelete() {
    if (confirm(`Incident ${number} verwijderen?`)) {
      startUpdate(async () => {
        await deleteLog(log.id)
        dispatch(log.id, true)
      })
    }
  }

  function openFollowup(prefix = '') {
    setFollowupPrefix(prefix)
    setShowFollowup(true)
  }

  const recentFollowups = log.followups?.slice(-3) || []
  const extraFollowups = (log.followups?.length || 0) - 3

  const chipSelect = (hasValue: boolean, alert = false) => cn(
    'text-xs rounded-md px-3 py-1 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors bg-white dark:bg-slate-700 appearance-none pr-6',
    hasValue
      ? 'border-slate-300 dark:border-slate-500 text-slate-700 dark:text-slate-200'
      : alert
        ? 'border-dashed border-orange-300 text-orange-400'
        : 'border-dashed border-slate-300 dark:border-slate-600 text-slate-400'
  )

  return (
    <>
      <div className={cn(
        'rounded-xl border mb-2 overflow-hidden shadow-sm',
        log.status === 'open' ? 'border-red-200 dark:border-red-900/50' : 'border-green-200 dark:border-green-900/50'
      )}>

        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex-wrap">

          {/* ID — color by priority */}
          <span className={cn('shrink-0 text-[11px] font-bold px-2 py-0.5 text-white rounded-md tracking-wide', cfg.idBadge)}>
            INCIDENT ID {number}
          </span>

          {/* Timestamp */}
          <span className="shrink-0 text-xs font-mono text-slate-500 dark:text-slate-400">
            {formatTimestamp(log.created_at)}
          </span>

          {/* Logger */}
          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
            {log.display_name_snapshot}
          </span>

          {/* Enforcement */}
          {enforcement && (
            <span className={cn('shrink-0 text-xs font-bold', enforcement.color)}>
              {enforcement.label}
            </span>
          )}

          {/* Connected team badges in header — interactive, only dynamic mode */}
          {isDynamic && connectedTeams.map(t => (
            <span key={t.id} className="shrink-0 inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-red-600 text-white text-xs font-bold">
              <span className="w-2 h-2 bg-white rounded-sm opacity-80 shrink-0" />
              Team {t.number}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemoveTeam(t.id, t.number)}
                  className="ml-0.5 w-4 h-4 rounded flex items-center justify-center hover:bg-red-500 transition-colors"
                  title={`Team ${t.number} ontkoppelen`}
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))}

          {/* Add team dropdown — in header, dynamic + canEdit only */}
          {isDynamic && canEdit && availableTeams.length > 0 && (
            <div className="relative shrink-0">
              <select
                onChange={handleAddTeam}
                className="text-xs rounded-md pl-2 pr-6 py-0.5 border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none"
              >
                <option value="">+ Team</option>
                {availableTeams.map(t => (
                  <option key={t.id} value={t.id}>Team {t.number}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}

          <div className="flex-1 min-w-0" />

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            <button
              onClick={handleToggleStatus}
              disabled={toggling || !canEdit}
              className={cn(
                'text-xs px-3 py-1 rounded-lg font-semibold transition-colors',
                log.status === 'closed'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white'
              )}
            >
              {log.status === 'closed' ? T.logbook.status_closed : T.logbook.status_open}
            </button>

            {canEdit && (
              <>
                <button onClick={() => setShowEdit(true)}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 font-medium transition-colors">
                  {T.common.edit}
                </button>
                <button onClick={() => openFollowup()}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 font-medium transition-colors">
                  {T.logbook.followUp}
                </button>
                {isDynamic && (
                  <button onClick={() => setShowAdvies(true)}
                    className="text-xs px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 font-medium transition-colors">
                    Advies
                  </button>
                )}
                <button onClick={handleDelete}
                  className="p-1.5 rounded-lg border border-red-100 dark:border-red-900/50 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title={T.common.delete}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Body ── klik opent follow-up */}
        <div
          className={cn('px-4 py-3 cursor-pointer', bodyBg)}
          onClick={() => canEdit && openFollowup()}
        >

          {/* Incident text */}
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
            {enforcement && (
              <span className={cn('mr-1', enforcement.color)}>{enforcement.label}:</span>
            )}
            {log.incident_text}
          </p>

          {/* Follow-ups — directly under incident text */}
          {recentFollowups.length > 0 && (
            <div className="mt-2 space-y-1">
              {recentFollowups.map(fu => (
                <div key={fu.id} className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                    {formatTimestamp(fu.created_at)}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                    {fu.display_name_snapshot}:
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">{fu.content}</span>
                </div>
              ))}
              {extraFollowups > 0 && (
                <button onClick={() => openFollowup()} className="text-xs text-blue-600 hover:underline">
                  +{extraFollowups} meer opvolgingen bekijken
                </button>
              )}
            </div>
          )}

          {/* Metadata chips — stop propagation zo dat de dropdown klikken geen follow-up opent */}
          <div className="flex items-center gap-2 flex-wrap mt-3" onClick={e => e.stopPropagation()}>

            {/* Subject chip */}
            <div className="relative">
              <select
                value={log.subject_id || ''}
                onChange={(e) => handleInlineUpdate('subject_id', e.target.value)}
                disabled={!canEdit}
                className={chipSelect(!!log.subject_id, true)}
              >
                <option value="">+ {T.logbook.subject}</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Assigned user chip */}
            <div className="relative">
              <select
                value={log.assigned_user_id || ''}
                onChange={(e) => handleInlineUpdate('assigned_user_id', e.target.value)}
                disabled={!canEdit}
                className={chipSelect(!!log.assigned_user_id)}
              >
                <option value="">+ Centralist koppelen</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <LogEditPopup log={log} subjects={subjects} areas={areas} members={members} onClose={() => setShowEdit(false)} />
      )}
      {showFollowup && (
        <FollowUpPopup
          logId={log.id}
          initialContent={followupPrefix}
          allFollowups={log.followups || []}
          members={members}
          onClose={() => setShowFollowup(false)}
        />
      )}
      {showAdvies && (
        <AdviesTeamPopup
          logId={log.id}
          logAreaId={log.area_id}
          areas={areas}
          availableTeams={availableTeams}
          areaTeams={areaTeams}
          onClose={() => setShowAdvies(false)}
        />
      )}
    </>
  )
}
