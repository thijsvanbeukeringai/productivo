'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { LogPriority, EnforcementType } from '@/types/app.types'
import { createTagNotifications, createAssignNotification } from './notification.actions'

async function broadcastLogChange(projectId: string, logId: string, action: 'insert' | 'update' | 'delete') {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    await admin.from('realtime_pings').insert({ project_id: projectId, log_id: logId, action })
  } catch {
    // Non-critical
  }
}

export async function createLog(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const projectId = formData.get('project_id') as string

  // Get display name snapshot
  const { data: member } = await supabase
    .from('project_members')
    .select('custom_display_name, profiles(full_name)')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  const displayName = member?.custom_display_name ||
    (member?.profiles as { full_name?: string } | null)?.full_name ||
    user.email?.split('@')[0] ||
    'Onbekend'

  const taggedRaw = formData.get('tagged_user_ids') as string
  const taggedUserIds: string[] = taggedRaw ? taggedRaw.split(',').filter(Boolean) : []

  const { data: log, error } = await supabase.from('logs').insert({
    project_id: projectId,
    incident_text: formData.get('incident_text') as string,
    subject_id: (formData.get('subject_id') as string) || null,
    priority: (formData.get('priority') as LogPriority) || 'low',
    area_id: (formData.get('area_id') as string) || null,
    team_ids: [],
    tagged_user_ids: taggedUserIds,
    position_id: (formData.get('position_id') as string) || null,
    assigned_user_id: (formData.get('assigned_user_id') as string) || null,
    enforcement_type: (formData.get('enforcement_type') as EnforcementType) || null,
    enforcement_reason: (formData.get('enforcement_reason') as string) || null,
    logged_by: user.id,
    display_name_snapshot: displayName,
  }).select().single()

  if (error) return { error: error.message }

  const assignedUserId = (formData.get('assigned_user_id') as string) || null

  await Promise.allSettled([
    taggedUserIds.length > 0
      ? createTagNotifications(projectId, log.id, taggedUserIds, displayName)
      : Promise.resolve(),
    assignedUserId && assignedUserId !== user.id
      ? createAssignNotification(projectId, log.id, assignedUserId, displayName)
      : Promise.resolve(),
  ])

  await broadcastLogChange(projectId, log.id, 'insert')
  revalidatePath(`/project/${projectId}`)
  return { data: log }
}

export async function updateLog(logId: string, updates: {
  incident_text?: string
  subject_id?: string | null
  priority?: LogPriority
  area_id?: string | null
  team_ids?: string[]
  position_id?: string | null
  assigned_user_id?: string | null
  enforcement_type?: EnforcementType | null
  enforcement_reason?: string | null
  status?: 'open' | 'closed'
  image_urls?: string[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const { data, error } = await supabase
    .from('logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single()

  if (error) return { error: error.message }

  await broadcastLogChange(data.project_id, logId, 'update')
  revalidatePath(`/project/${data.project_id}`)
  return { data }
}

export async function toggleLogStatus(logId: string, currentStatus: 'open' | 'closed') {
  const newStatus = currentStatus === 'open' ? 'closed' : 'open'
  const extra = newStatus === 'closed' ? { team_ids: [] } : {}
  return updateLog(logId, { status: newStatus, ...extra })
}

export async function addFollowup(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const logId = formData.get('log_id') as string

  // Get display name
  const { data: log } = await supabase
    .from('logs')
    .select('project_id')
    .eq('id', logId)
    .single()

  if (!log) return { error: 'Log niet gevonden.' }

  const { data: member } = await supabase
    .from('project_members')
    .select('custom_display_name, profiles(full_name)')
    .eq('project_id', log.project_id)
    .eq('user_id', user.id)
    .single()

  const displayName = member?.custom_display_name ||
    (member?.profiles as { full_name?: string } | null)?.full_name ||
    user.email?.split('@')[0] ||
    'Onbekend'

  const content = formData.get('content') as string

  const { data, error } = await supabase.from('log_followups').insert({
    log_id: logId,
    content,
    created_by: user.id,
    display_name_snapshot: displayName,
  }).select().single()

  if (error) return { error: error.message }

  // Parse @mentions in followup and tag those users on the log + send notifications
  const mentionedTaggedIds = formData.get('mentioned_user_ids') as string
  if (mentionedTaggedIds) {
    const mentionedIds = mentionedTaggedIds.split(',').filter(Boolean)
    if (mentionedIds.length > 0) {
      // Add to log's tagged_user_ids (merge, no duplicates)
      const { data: currentLog } = await supabase
        .from('logs').select('tagged_user_ids').eq('id', logId).single()
      const existing: string[] = (currentLog as { tagged_user_ids: string[] } | null)?.tagged_user_ids || []
      const merged = [...new Set([...existing, ...mentionedIds])]
      await supabase.from('logs').update({ tagged_user_ids: merged }).eq('id', logId)
      await createTagNotifications(log.project_id, logId, mentionedIds, displayName)
    }
  }

  await broadcastLogChange(log.project_id, logId, 'update')
  revalidatePath(`/project/${log.project_id}`)
  return { data }
}

export async function connectTeamToLog(logId: string, teamId: string, teamNumber: number, action: 'add' | 'remove') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const { data: log } = await supabase.from('logs').select('project_id, team_ids').eq('id', logId).single()
  if (!log) return { error: 'Log niet gevonden.' }

  const { data: member } = await supabase
    .from('project_members')
    .select('custom_display_name, profiles(full_name)')
    .eq('project_id', log.project_id)
    .eq('user_id', user.id)
    .single()

  const displayName = member?.custom_display_name ||
    (member?.profiles as { full_name?: string } | null)?.full_name ||
    user.email?.split('@')[0] || 'Onbekend'

  const current: string[] = (log as { team_ids: string[] }).team_ids || []
  const newTeamIds = action === 'add'
    ? [...new Set([...current, teamId])]
    : current.filter(id => id !== teamId)

  const { error: updateErr } = await supabase.from('logs').update({ team_ids: newTeamIds }).eq('id', logId)
  if (updateErr) return { error: updateErr.message }

  const content = action === 'add'
    ? `Team ${teamNumber} gekoppeld aan melding`
    : `Team ${teamNumber} ontkoppeld van melding`

  await supabase.from('log_followups').insert({
    log_id: logId,
    content,
    created_by: user.id,
    display_name_snapshot: displayName,
  })

  await broadcastLogChange(log.project_id, logId, 'update')
  revalidatePath(`/project/${log.project_id}`)
  return { data: true }
}

export async function uploadLogImage(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const file = formData.get('file') as File
  const logId = formData.get('log_id') as string

  if (!file || !file.size) return { error: 'Geen bestand.' }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${logId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabase.storage
    .from('log-images')
    .upload(filename, file, { contentType: file.type, upsert: false })

  if (error) return { error: error.message }

  const { data: { publicUrl } } = supabase.storage
    .from('log-images')
    .getPublicUrl(data.path)

  return { url: publicUrl }
}

export async function deleteLog(logId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const { data: log } = await supabase.from('logs').select('project_id').eq('id', logId).single()
  if (!log) return { error: 'Log niet gevonden.' }

  const { error } = await supabase.rpc('delete_log_cascade', { p_log_id: logId })
  if (error) return { error: error.message }

  await broadcastLogChange(log.project_id, logId, 'delete')
  revalidatePath(`/project/${log.project_id}`)
  return { data: true }
}

export async function getLogs(projectId: string, filters?: {
  myLogs?: boolean
  assignedToMe?: boolean
  infoOnly?: boolean
  subjectId?: string
  hasPhotos?: boolean
  openOnly?: boolean
  userId?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('logs')
    .select(`
      *,
      subject:subjects(*),
      area:areas(*),
      assigned_user:profiles!logs_assigned_user_id_fkey(*),
      logger:profiles!logs_logged_by_fkey(*),
      followups:log_followups(*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (filters?.myLogs && filters.userId) {
    query = query.eq('logged_by', filters.userId)
  }
  if (filters?.assignedToMe && filters.userId) {
    query = query.eq('assigned_user_id', filters.userId)
  }
  if (filters?.infoOnly) {
    query = query.eq('priority', 'info')
  }
  if (filters?.subjectId) {
    query = query.eq('subject_id', filters.subjectId)
  }
  if (filters?.hasPhotos) {
    query = query.not('image_urls', 'eq', '{}')
  }
  if (filters?.openOnly) {
    query = query.eq('status', 'open')
  }

  const { data, error } = await query
  if (error) return { error: error.message }
  return { data }
}
