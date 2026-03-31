'use client'

import { useEffect, useCallback, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDashboardStats } from '@/lib/actions/dashboard.actions'
import { EnforcementCounterCards } from './EnforcementCounters'
import { AreasRealtimeGrid } from '@/components/areas/AreasRealtimeGrid'
import type { DashboardStats } from '@/lib/actions/dashboard.actions'
import type { CalibrationPoint, EnforcementCounters } from '@/types/app.types'

const priorityColor: Record<string, string> = {
  high: 'bg-red-500',
  mid: 'bg-amber-400',
  low: 'bg-blue-400',
  info: 'bg-slate-300 dark:bg-slate-500',
}

interface Props {
  projectId: string
  initialStats: DashboardStats
  calibration: CalibrationPoint[]
  backgroundUrl: string | null
}

export function ProjectDashboardClient({ projectId, initialStats, calibration, backgroundUrl }: Props) {
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [, startTransition] = useTransition()

  const refresh = useCallback(() => {
    startTransition(async () => {
      const updated = await getDashboardStats(projectId)
      if (updated) setStats(updated)
    })
  }, [projectId])

  // Subscribe to log changes via Supabase realtime
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`dashboard-logs-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'logs',
        filter: `project_id=eq.${projectId}`,
      }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId, refresh])

  // Also listen to the log-created / log-mutated CustomEvents from server actions
  useEffect(() => {
    window.addEventListener('log-created', refresh)
    window.addEventListener('log-mutated', refresh)
    return () => {
      window.removeEventListener('log-created', refresh)
      window.removeEventListener('log-mutated', refresh)
    }
  }, [refresh])

  const {
    totalLogs, openLogs, totalOpenHighPrio, medicalLogs, hasMedical,
    latestLogs, highPriorityLogs, areaCounts, subjectCounts,
    recentAreaCounts, logsByHour, shiftStartHour, counters, shiftLabel,
    areas, subjects,
  } = stats

  const maxAreaCount = Math.max(1, ...Object.values(areaCounts))
  const maxSubjectCount = Math.max(1, ...Object.values(subjectCounts))
  const maxHourCount = Math.max(1, ...logsByHour)

  return (
    <>
      {/* Quick stats */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Logs deze shift</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{totalLogs}</p>
        </div>
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Open logs</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{openLogs}</p>
        </div>
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Gesloten logs</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{totalLogs - openLogs}</p>
        </div>
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/40 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Hoge prio open</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{totalOpenHighPrio}</p>
        </div>
        {hasMedical && (
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-900/40 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Medisch</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{medicalLogs}</p>
          </div>
        )}
      </div>

      {/* Areas overview — has its own realtime */}
      <AreasRealtimeGrid
        projectId={projectId}
        initialAreas={areas}
        recentAreaCounts={recentAreaCounts}
        calibration={calibration}
        backgroundUrl={backgroundUrl}
      />

      {/* 4-column bottom row */}
      <div className="grid grid-cols-4 gap-4 mb-6 items-start">

        {/* Meldingen per area */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Meldingen per area</h2>
          <NamedCountBars counts={areaCounts} items={areas} maxCount={maxAreaCount} color="bg-blue-500" />
        </div>

        {/* Meldingen per onderwerp */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Meldingen per onderwerp</h2>
          <NamedCountBars counts={subjectCounts} items={subjects} maxCount={maxSubjectCount} color="bg-purple-500" />
        </div>

        {/* Recente meldingen */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Recente meldingen</h3>
          {latestLogs.length > 0 ? (
            <div className="space-y-0">
              {latestLogs.map((log, i) => (
                <div key={log.id} className={`flex items-start gap-2 py-2 text-xs ${i < latestLogs.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${priorityColor[log.priority] || priorityColor.low}`} />
                  <span className="text-slate-400 whitespace-nowrap mt-0.5 shrink-0">
                    {new Date(log.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="flex-1 text-slate-800 dark:text-slate-200 truncate">{log.incident_text}</p>
                  {log.area && <span className="text-slate-400 shrink-0 truncate max-w-[60px]">📍{log.area.name}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nog geen meldingen.</p>
          )}
        </div>

        {/* Handhaving overzicht */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <EnforcementCounterCards
            counters={counters as EnforcementCounters[]}
            shiftLabel={shiftLabel}
          />
        </div>

      </div>

      {/* High priority open logs */}
      {highPriorityLogs.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900 p-4 mb-6">
          <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Hoge prioriteit — Open logs ({highPriorityLogs.length})
          </h3>
          <div className="space-y-0">
            {highPriorityLogs.map((log, i) => (
              <div key={log.id} className={`flex items-start gap-3 text-sm py-2 ${i < highPriorityLogs.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
                <span className="text-xs font-mono text-slate-400 whitespace-nowrap mt-0.5">
                  {new Date(log.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 dark:text-slate-200 truncate">{log.incident_text}</p>
                  <div className="flex gap-2 mt-0.5">
                    {log.subject && <span className="text-xs text-slate-500">{log.subject.name}</span>}
                    {log.area && <span className="text-xs text-slate-400">📍 {log.area.name}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs per uur */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Logs per uur — huidige shift</h3>
        <div className="flex items-end gap-1 h-24">
          {logsByHour.map((count, idx) => {
            const hour = (shiftStartHour + idx) % 24
            const label = `${String(hour).padStart(2, '0')}:00`
            const heightPct = (count / maxHourCount) * 100
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-[10px] text-slate-500 font-medium">{count > 0 ? count : ''}</span>
                <div className="w-full flex items-end" style={{ height: 64 }}>
                  <div className="w-full rounded-t bg-blue-500 dark:bg-blue-400 transition-all" style={{ height: `${Math.max(heightPct, count > 0 ? 4 : 0)}%` }} />
                </div>
                <span className="text-[9px] text-slate-400 truncate w-full text-center">{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function NamedCountBars({ counts, items, maxCount, color }: {
  counts: Record<string, number>
  items: Array<{ id: string; name: string }>
  maxCount: number
  color: string
}) {
  const sorted = items
    .map(a => ({ ...a, count: counts[a.id] || 0 }))
    .filter(a => a.count > 0)
    .sort((a, b) => b.count - a.count)

  if (sorted.length === 0) return <p className="text-xs text-slate-400">Nog geen meldingen.</p>

  return (
    <div className="space-y-2.5">
      {sorted.map(item => (
        <div key={item.id}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-2 shrink-0">{item.count}</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${(item.count / maxCount) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
