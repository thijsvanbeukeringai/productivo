'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AreaStatus, PositionStatus } from '@/types/app.types'

// ============================================================
// SUBJECTS
// ============================================================
export async function createSubject(formData: FormData) {
  const supabase = await createClient()
  const projectId = formData.get('project_id') as string

  const { data, error } = await supabase.from('subjects').insert({
    project_id: projectId,
    name: formData.get('name') as string,
    color: (formData.get('color') as string) || null,
    sort_order: parseInt(formData.get('sort_order') as string) || 0,
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/subjects`)
  return { data }
}

export async function updateSubject(subjectId: string, projectId: string, updates: {
  name?: string; color?: string; sort_order?: number; is_active?: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('subjects').update(updates).eq('id', subjectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/subjects`)
  return { success: true }
}

export async function deleteSubject(subjectId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('subjects').delete().eq('id', subjectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/subjects`)
  return { success: true }
}

// ============================================================
// AREAS
// ============================================================
export async function createArea(formData: FormData) {
  const supabase = await createClient()
  const projectId = formData.get('project_id') as string

  const { data, error } = await supabase.from('areas').insert({
    project_id: projectId,
    name: formData.get('name') as string,
    sort_order: parseInt(formData.get('sort_order') as string) || 0,
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/areas`)
  return { data }
}

export async function updateAreaStatus(areaId: string, projectId: string, status: AreaStatus) {
  const supabase = await createClient()
  const { error } = await supabase.from('areas').update({ status }).eq('id', areaId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}`)
  revalidatePath(`/project/${projectId}/areas`)
  revalidatePath(`/project/${projectId}/dashboard`)
  return { success: true }
}

export async function deleteArea(areaId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('areas').delete().eq('id', areaId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/areas`)
  return { success: true }
}

// ============================================================
// TEAMS
// ============================================================
export async function createTeam(formData: FormData) {
  const supabase = await createClient()
  const projectId = formData.get('project_id') as string

  // Get next team number
  const { data: existing } = await supabase
    .from('teams')
    .select('number')
    .eq('project_id', projectId)
    .order('number', { ascending: false })
    .limit(1)

  const nextNumber = (existing?.[0]?.number || 0) + 1

  const memberNamesRaw = formData.get('member_names') as string
  const memberNames = memberNamesRaw
    ? memberNamesRaw.split('\n').map(n => n.trim()).filter(Boolean)
    : []

  const { data, error } = await supabase.from('teams').insert({
    project_id: projectId,
    number: nextNumber,
    member_names: memberNames,
    area_id: (formData.get('area_id') as string) || null,
    is_active: formData.get('is_active') === 'true',
    is_standby: formData.get('is_standby') === 'true',
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/teams`)
  return { data }
}

export async function updateTeam(teamId: string, projectId: string, updates: {
  member_names?: string[]
  area_id?: string | null
  is_active?: boolean
  is_standby?: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('teams').update(updates).eq('id', teamId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/teams`)
  revalidatePath(`/project/${projectId}`)
  return { success: true }
}

export async function deleteTeam(teamId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/teams`)
  return { success: true }
}

// ============================================================
// POSITIONS
// ============================================================
export async function createPosition(formData: FormData) {
  const supabase = await createClient()
  const projectId = formData.get('project_id') as string

  const { data: existing } = await supabase
    .from('positions')
    .select('number')
    .eq('project_id', projectId)
    .order('number', { ascending: false })
    .limit(1)

  const nextNumber = (existing?.[0]?.number || 0) + 1

  const { data, error } = await supabase.from('positions').insert({
    project_id: projectId,
    number: nextNumber,
    name: (formData.get('name') as string) || null,
    area_id: (formData.get('area_id') as string) || null,
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/positions`)
  return { data }
}

export async function updatePositionStatus(
  positionId: string,
  projectId: string,
  status: PositionStatus
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const { data: position, error: posErr } = await supabase
    .from('positions')
    .update({ status })
    .eq('id', positionId)
    .select()
    .single()

  if (posErr) return { error: posErr.message }

  // Get display name for log
  const { data: member } = await supabase
    .from('project_members')
    .select('custom_display_name, profiles(full_name)')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  const displayName = member?.custom_display_name ||
    (member?.profiles as { full_name?: string } | null)?.full_name || 'Systeem'

  // Create audit log entry
  const message = status === 'portocheck_done'
    ? `Portocheck bevestigd voor positie #${position.number}`
    : status === 'sanitary_break'
    ? `Sanitaire pauze aangevraagd voor positie #${position.number}`
    : `Status reset voor positie #${position.number}`

  await supabase.from('logs').insert({
    project_id: projectId,
    incident_text: message,
    priority: 'info',
    logged_by: user.id,
    display_name_snapshot: displayName,
  })

  revalidatePath(`/project/${projectId}/settings/positions`)
  revalidatePath(`/project/${projectId}`)
  return { success: true }
}

// ============================================================
// USER PROFILE
// ============================================================
export async function updateUserProfile(updates: {
  full_name?: string
  language?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

// ============================================================
// PROJECT MEMBER CONTEXT SETTINGS
// ============================================================
export async function updateProjectMemberSettings(
  projectId: string,
  updates: {
    custom_display_name?: string
    standby_teams?: boolean
    fixed_positions?: boolean
    display_mode?: 'dynamic' | 'fixed' | 'cp_org'
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const { error } = await supabase
    .from('project_members')
    .update(updates)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}`)
  return { success: true }
}
