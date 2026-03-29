'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function guardShiftAdmin(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!data || !['super_admin', 'company_admin', 'centralist'].includes(data.role)) return null
  return user
}

// ── Create shift ──────────────────────────────────────────────
export async function createShift(
  projectId: string,
  fields: { title: string; work_date: string; start_time: string; end_time: string; max_slots: number | null; notes: string | null }
) {
  const user = await guardShiftAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('crew_shifts')
    .insert({ project_id: projectId, ...fields })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/crew/rooster`)
  return { success: true, id: data.id }
}

// ── Update shift ──────────────────────────────────────────────
export async function updateShift(
  projectId: string,
  shiftId: string,
  fields: { title: string; work_date: string; start_time: string; end_time: string; max_slots: number | null; notes: string | null }
) {
  const user = await guardShiftAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_shifts')
    .update(fields)
    .eq('id', shiftId)
    .eq('project_id', projectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/crew/rooster`)
  return { success: true }
}

// ── Delete shift ──────────────────────────────────────────────
export async function deleteShift(projectId: string, shiftId: string) {
  const user = await guardShiftAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_shifts')
    .delete()
    .eq('id', shiftId)
    .eq('project_id', projectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/crew/rooster`)
  return { success: true }
}

// ── Assign crew member to shift ───────────────────────────────
export async function assignMemberToShift(projectId: string, shiftId: string, memberId: string) {
  const user = await guardShiftAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_shift_assignments')
    .upsert({ shift_id: shiftId, crew_member_id: memberId }, { onConflict: 'shift_id,crew_member_id' })
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/crew/rooster`)
  return { success: true }
}

// ── Remove crew member from shift ────────────────────────────
export async function removeMemberFromShift(projectId: string, shiftId: string, memberId: string) {
  const user = await guardShiftAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_shift_assignments')
    .delete()
    .eq('shift_id', shiftId)
    .eq('crew_member_id', memberId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/crew/rooster`)
  return { success: true }
}
