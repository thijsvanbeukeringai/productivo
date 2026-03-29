import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember } from '@/lib/supabase/session'
import { EnforcementCounterCards } from '@/components/dashboard/EnforcementCounters'
import { AreasRealtimeGrid } from '@/components/areas/AreasRealtimeGrid'
import { getShiftDateLabel } from '@/lib/utils/format-timestamp'
import type { EnforcementCounters } from '@/types/app.types'

interface PageProps {
  params: Promise<{ projectId: string }>
}

function getCurrentShiftDate(): string {
  const now = new Date()
  const amsterdam = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  if (amsterdam.getHours() < 7) {
    amsterdam.setDate(amsterdam.getDate() - 1)
  }
  return amsterdam.toISOString().split('T')[0]
}

export default async function DashboardPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()
  if (!project) notFound()

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')

  const shiftDate = getCurrentShiftDate()

  const { data: areas } = await supabase
    .from('areas').select('*').eq('project_id', projectId).order('name')

  // Load enforcement counters for current shift
  const { data: counters } = await supabase
    .from('enforcement_counters')
    .select('*, subject:subjects(*)')
    .eq('project_id', projectId)
    .eq('shift_date', shiftDate)

  // All subjects for this project
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('name')

  const shiftStart = `${shiftDate}T07:00:00+02:00`

  // Alle logs voor area + subject counts (niet beperkt tot shift)
  const { data: allLogs } = await supabase
    .from('logs')
    .select('area_id, subject_id, incident_text')
    .eq('project_id', projectId)

  // Logs per uur (huidige shift)
  const { data: shiftLogs } = await supabase
    .from('logs')
    .select('created_at')
    .eq('project_id', projectId)
    .gte('created_at', shiftStart)

  // Laatste 5 open meldingen
  const { data: latestLogs } = await supabase
    .from('logs')
    .select('id, log_number, incident_text, priority, created_at, subject:subjects(name, color), area:areas(name)')
    .eq('project_id', projectId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(5)

  // Recent logs (last 30 min) for area card badges
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: recentLogs } = await supabase
    .from('logs')
    .select('area_id, incident_text')
    .eq('project_id', projectId)
    .gte('created_at', thirtyMinutesAgo)

  // Compute per-area counts last 30 min (area_id + @mention, deduplicated per log)
  const recentAreaCounts: Record<string, number> = {}
  for (const log of recentLogs || []) {
    const matched = new Set<string>()
    if (log.area_id) matched.add(log.area_id)
    const lower = (log.incident_text || '').toLowerCase()
    for (const area of areas || []) {
      if (lower.includes(`@${area.name.toLowerCase()}`)) matched.add(area.id)
    }
    for (const id of matched) recentAreaCounts[id] = (recentAreaCounts[id] || 0) + 1
  }

  // Compute per-area counts all-time (area_id + @mention in text, deduplicated per log)
  const areaCounts: Record<string, number> = {}
  for (const log of allLogs || []) {
    const matched = new Set<string>()
    if (log.area_id) matched.add(log.area_id)
    const lower = (log.incident_text || '').toLowerCase()
    for (const area of areas || []) {
      if (lower.includes(`@${area.name.toLowerCase()}`)) matched.add(area.id)
    }
    for (const id of matched) areaCounts[id] = (areaCounts[id] || 0) + 1
  }

  // Compute per-subject counts (subject_id + @mention in text, deduplicated per log)
  const subjectCounts: Record<string, number> = {}
  for (const log of allLogs || []) {
    const matched = new Set<string>()
    if (log.subject_id) matched.add(log.subject_id)
    const lower = (log.incident_text || '').toLowerCase()
    for (const subject of subjects || []) {
      if (lower.includes(`@${subject.name.toLowerCase()}`)) matched.add(subject.id)
    }
    for (const id of matched) subjectCounts[id] = (subjectCounts[id] || 0) + 1
  }

  const maxAreaCount = Math.max(1, ...Object.values(areaCounts))
  const maxSubjectCount = Math.max(1, ...Object.values(subjectCounts))

  // Bereken logs per uur voor de huidige shift
  const nowAmsterdam = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  const shiftStartHour = 7
  const currentHour = nowAmsterdam.getHours()
  const hoursInShift = currentHour >= shiftStartHour
    ? currentHour - shiftStartHour + 1
    : 24 - shiftStartHour + currentHour + 1

  const logsByHour: number[] = Array(Math.max(hoursInShift, 1)).fill(0)
  for (const log of shiftLogs || []) {
    const logHour = new Date(new Date(log.created_at).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getHours()
    const idx = logHour >= shiftStartHour
      ? logHour - shiftStartHour
      : 24 - shiftStartHour + logHour
    if (idx >= 0 && idx < logsByHour.length) logsByHour[idx]++
  }
  const maxHourCount = Math.max(1, ...logsByHour)

  // Load recent open high-priority logs
  const { data: highPriorityLogs } = await supabase
    .from('logs')
    .select(`
      *,
      subject:subjects(*),
      area:areas(*)
    `)
    .eq('project_id', projectId)
    .eq('status', 'open')
    .eq('priority', 'high')
    .order('created_at', { ascending: false })
    .limit(10)

  // Log stats for today's shift
  const { count: totalLogs } = await supabase
    .from('logs')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .gte('created_at', shiftStart)

  const { count: openLogs } = await supabase
    .from('logs')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'open')
    .gte('created_at', shiftStart)

  const { count: totalOpenLogs } = await supabase
    .from('logs')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'open')
    .eq('priority', 'high')

  // Medical logs count — subject with name 'medical' (case insensitive)
  const medicalSubject = (subjects || []).find(s => s.name.toLowerCase() === 'medical')
  const { count: medicalLogs } = medicalSubject
    ? await supabase
        .from('logs')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('subject_id', medicalSubject.id)
    : { count: 0 }

  return (
    <main className="h-full overflow-y-auto px-6 py-4 w-full">
      {/* Quick stats */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Logs deze shift</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{totalLogs ?? 0}</p>
        </div>
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Open logs</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{openLogs ?? 0}</p>
        </div>
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Gesloten logs</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{(totalLogs ?? 0) - (openLogs ?? 0)}</p>
        </div>
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/40 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Hoge prio open</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{totalOpenLogs ?? 0}</p>
        </div>
        {medicalSubject && (
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-900/40 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Medisch</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{medicalLogs ?? 0}</p>
          </div>
        )}
      </div>

      {/* Areas overview — realtime */}
      <AreasRealtimeGrid
        projectId={projectId}
        initialAreas={areas ?? []}
        recentAreaCounts={recentAreaCounts}
        calibration={(project.map_calibration as import('@/types/app.types').CalibrationPoint[]) ?? []}
        backgroundUrl={project.map_background_url ?? null}
      />

      {/* 4-column bottom row */}
      <div className="grid grid-cols-4 gap-4 mb-6 items-start">

        {/* Meldingen per area */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Meldingen per area</h2>
          {areas && areas.some(a => (areaCounts[a.id] || 0) > 0) ? (
            <div className="space-y-2.5">
              {[...areas]
                .map(a => ({ ...a, count: areaCounts[a.id] || 0 }))
                .filter(a => a.count > 0)
                .sort((a, b) => b.count - a.count)
                .map(area => (
                  <div key={area.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{area.name}</span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-2 shrink-0">{area.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(area.count / maxAreaCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nog geen meldingen.</p>
          )}
        </div>

        {/* Meldingen per onderwerp */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Meldingen per onderwerp</h2>
          {subjects && subjects.some(s => (subjectCounts[s.id] || 0) > 0) ? (
            <div className="space-y-2.5">
              {[...subjects]
                .map(s => ({ ...s, count: subjectCounts[s.id] || 0 }))
                .filter(s => s.count > 0)
                .sort((a, b) => b.count - a.count)
                .map(subject => (
                  <div key={subject.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{subject.name}</span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-2 shrink-0">{subject.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${(subject.count / maxSubjectCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nog geen meldingen.</p>
          )}
        </div>

        {/* Recente meldingen */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Recente meldingen</h3>
          {latestLogs && latestLogs.length > 0 ? (
            <div className="space-y-0">
              {latestLogs.map((log, i) => {
                const priorityColor: Record<string, string> = {
                  high: 'bg-red-500',
                  mid: 'bg-amber-400',
                  low: 'bg-blue-400',
                  info: 'bg-slate-300 dark:bg-slate-500',
                }
                const sub = (Array.isArray(log.subject) ? log.subject[0] : log.subject) as { name: string; color: string | null } | null
                const area = (Array.isArray(log.area) ? log.area[0] : log.area) as { name: string } | null
                return (
                  <div key={log.id} className={`flex items-start gap-2 py-2 text-xs ${i < latestLogs.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${priorityColor[log.priority] || priorityColor.low}`} />
                    <span className="text-slate-400 whitespace-nowrap mt-0.5 shrink-0">
                      {new Date(log.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <p className="flex-1 text-slate-800 dark:text-slate-200 truncate">{log.incident_text}</p>
                    {area && <span className="text-slate-400 shrink-0 truncate max-w-[60px]">📍{area.name}</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nog geen meldingen.</p>
          )}
        </div>

        {/* Handhaving overzicht */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <EnforcementCounterCards
            counters={(counters as EnforcementCounters[]) || []}
            shiftLabel={getShiftDateLabel(shiftDate)}
          />
        </div>

      </div>

      {/* High priority open logs */}
      {highPriorityLogs && highPriorityLogs.length > 0 && (
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
    </main>
  )
}
