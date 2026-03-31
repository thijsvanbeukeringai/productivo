'use server'

import { createClient } from '@/lib/supabase/server'
import { getShiftDateLabel } from '@/lib/utils/format-timestamp'
import type { EnforcementCounters, Area } from '@/types/app.types'

function getCurrentShiftDate(): string {
  const now = new Date()
  const amsterdam = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  if (amsterdam.getHours() < 7) {
    amsterdam.setDate(amsterdam.getDate() - 1)
  }
  return amsterdam.toISOString().split('T')[0]
}

export interface DashboardStats {
  totalLogs: number
  openLogs: number
  totalOpenHighPrio: number
  medicalLogs: number
  hasMedical: boolean
  areas: Area[]
  subjects: Array<{ id: string; name: string }>
  latestLogs: Array<{
    id: string
    log_number: number
    incident_text: string
    priority: string
    created_at: string
    subject: { name: string; color: string | null } | null
    area: { name: string } | null
  }>
  highPriorityLogs: Array<{
    id: string
    incident_text: string
    created_at: string
    subject: { name: string } | null
    area: { name: string } | null
  }>
  areaCounts: Record<string, number>
  subjectCounts: Record<string, number>
  recentAreaCounts: Record<string, number>
  logsByHour: number[]
  shiftStartHour: number
  counters: EnforcementCounters[]
  shiftLabel: string
}

export async function getDashboardStats(projectId: string): Promise<DashboardStats | null> {
  const supabase = await createClient()
  const shiftDate = getCurrentShiftDate()
  const shiftStart = `${shiftDate}T07:00:00+02:00`
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const [
    areasRes,
    countersRes,
    subjectsRes,
    allLogsRes,
    shiftLogsRes,
    latestLogsRes,
    highPrioLogsRes,
    totalLogsRes,
    openLogsRes,
    totalOpenHighPrioRes,
    recentLogsRes,
  ] = await Promise.all([
    supabase.from('areas').select('*').eq('project_id', projectId).order('name'),
    supabase.from('enforcement_counters').select('*, subject:subjects(*)').eq('project_id', projectId).eq('shift_date', shiftDate),
    supabase.from('subjects').select('id, name').eq('project_id', projectId).eq('is_active', true).order('name'),
    supabase.from('logs').select('area_id, subject_id').eq('project_id', projectId),
    supabase.from('logs').select('created_at').eq('project_id', projectId).gte('created_at', shiftStart),
    supabase.from('logs').select('id, log_number, incident_text, priority, created_at, subject:subjects(name, color), area:areas(name)').eq('project_id', projectId).eq('status', 'open').order('created_at', { ascending: false }).limit(5),
    supabase.from('logs').select('id, incident_text, created_at, subject:subjects(name), area:areas(name)').eq('project_id', projectId).eq('status', 'open').eq('priority', 'high').order('created_at', { ascending: false }).limit(10),
    supabase.from('logs').select('id', { count: 'exact', head: true }).eq('project_id', projectId).gte('created_at', shiftStart),
    supabase.from('logs').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'open').gte('created_at', shiftStart),
    supabase.from('logs').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'open').eq('priority', 'high'),
    supabase.from('logs').select('area_id').eq('project_id', projectId).gte('created_at', thirtyMinutesAgo),
  ])

  const areas = areasRes.data || []
  const subjects = subjectsRes.data || []
  const allLogs = allLogsRes.data || []
  const shiftLogs = shiftLogsRes.data || []
  const recentLogs = recentLogsRes.data || []

  // Per-area counts (all-time) — use area_id column only
  const areaCounts: Record<string, number> = {}
  for (const log of allLogs) {
    if (log.area_id) areaCounts[log.area_id] = (areaCounts[log.area_id] || 0) + 1
  }

  // Per-subject counts — use subject_id column only
  const subjectCounts: Record<string, number> = {}
  for (const log of allLogs) {
    if (log.subject_id) subjectCounts[log.subject_id] = (subjectCounts[log.subject_id] || 0) + 1
  }

  // Recent area counts (last 30 min)
  const recentAreaCounts: Record<string, number> = {}
  for (const log of recentLogs) {
    if (log.area_id) recentAreaCounts[log.area_id] = (recentAreaCounts[log.area_id] || 0) + 1
  }

  // Logs per hour (current shift)
  const nowAmsterdam = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  const shiftStartHour = 7
  const currentHour = nowAmsterdam.getHours()
  const hoursInShift = currentHour >= shiftStartHour
    ? currentHour - shiftStartHour + 1
    : 24 - shiftStartHour + currentHour + 1

  const logsByHour: number[] = Array(Math.max(hoursInShift, 1)).fill(0)
  for (const log of shiftLogs) {
    const logHour = new Date(new Date(log.created_at).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getHours()
    const idx = logHour >= shiftStartHour
      ? logHour - shiftStartHour
      : 24 - shiftStartHour + logHour
    if (idx >= 0 && idx < logsByHour.length) logsByHour[idx]++
  }

  // Medical count — computed from already-fetched allLogs + subjects (no extra round trip)
  const medicalSubject = subjects.find(s => s.name.toLowerCase() === 'medical')
  const medicalLogs = medicalSubject ? (subjectCounts[medicalSubject.id] || 0) : 0

  // Normalize latest logs (supabase returns joined rows as objects or arrays)
  const latestLogs = (latestLogsRes.data || []).map(log => ({
    ...log,
    subject: (Array.isArray(log.subject) ? log.subject[0] : log.subject) as { name: string; color: string | null } | null,
    area: (Array.isArray(log.area) ? log.area[0] : log.area) as { name: string } | null,
  }))

  const highPriorityLogs = (highPrioLogsRes.data || []).map(log => ({
    ...log,
    subject: (Array.isArray(log.subject) ? log.subject[0] : log.subject) as { name: string } | null,
    area: (Array.isArray(log.area) ? log.area[0] : log.area) as { name: string } | null,
  }))

  return {
    totalLogs: totalLogsRes.count ?? 0,
    openLogs: openLogsRes.count ?? 0,
    totalOpenHighPrio: totalOpenHighPrioRes.count ?? 0,
    medicalLogs,
    hasMedical: !!medicalSubject,
    areas,
    subjects,
    latestLogs,
    highPriorityLogs,
    areaCounts,
    subjectCounts,
    recentAreaCounts,
    logsByHour,
    shiftStartHour,
    counters: (countersRes.data as EnforcementCounters[]) || [],
    shiftLabel: getShiftDateLabel(shiftDate),
  }
}
