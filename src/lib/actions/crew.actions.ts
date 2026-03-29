'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function guardCrewAdmin(projectId: string) {
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

// ── Invite external crew company ─────────────────────────────
export async function inviteCrewCompany(projectId: string, formData: FormData) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const name         = (formData.get('name') as string)?.trim()
  const contactName  = (formData.get('contact_name') as string)?.trim()
  const contactEmail = (formData.get('contact_email') as string)?.trim()
  const targetCount  = parseInt(formData.get('target_count') as string) || null

  if (!name || !contactName || !contactEmail) return { error: 'Vul alle verplichte velden in.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('crew_companies')
    .insert({ project_id: projectId, name, contact_name: contactName, contact_email: contactEmail, target_count: targetCount })
    .select('invite_token')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/crew`)
  return { success: true, token: data.invite_token }
}

// ── Update project show days ──────────────────────────────────
export async function updateProjectShowDays(projectId: string, showDays: string[]) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('projects')
    .update({ show_days: showDays })
    .eq('id', projectId)

  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/crew`)
  return { success: true }
}

// ── Portal: load company by token (no auth) ───────────────────
export async function getCrewPortalData(token: string) {
  const admin = createAdminClient()

  const { data: company, error } = await admin
    .from('crew_companies')
    .select('id, name, contact_name, project_id, target_count')
    .eq('invite_token', token)
    .single()

  if (error || !company) return { error: 'Ongeldige of verlopen uitnodigingslink.' }

  const { data: project } = await admin
    .from('projects')
    .select('id, name, start_date, end_date, show_days')
    .eq('id', company.project_id)
    .single()

  if (!project) return { error: 'Project niet gevonden.' }

  // Current crew members for this company (including their form responses)
  const { data: members } = await admin
    .from('crew_members')
    .select('id, first_name, last_name, email, crew_planning(*), form_responses(form_id)')
    .eq('crew_company_id', company.id)
    .order('created_at', { ascending: true })

  // Briefings assigned to this company
  const { data: briefingAssignments } = await admin
    .from('briefing_assignments')
    .select('briefings(id, title, content, cover_image_url)')
    .eq('crew_company_id', company.id)

  // Forms assigned to this company (with fields)
  const { data: formAssignments } = await admin
    .from('form_assignments')
    .select(`
      forms(
        id, title, description,
        form_fields(id, type, label, placeholder, options, required, sort_order)
      )
    `)
    .eq('crew_company_id', company.id)

  return {
    company: { id: company.id, name: company.name, target_count: company.target_count },
    project: {
      id: project.id,
      name: project.name,
      start_date: project.start_date as string | null,
      end_date: project.end_date as string | null,
      show_days: (project.show_days as string[]) || [],
    },
    members: members || [],
    briefings: (briefingAssignments || []).map((a: any) => a.briefings).filter(Boolean),
    forms: (formAssignments || []).map((a: any) => ({
      ...a.forms,
      form_fields: (a.forms?.form_fields || []).sort((x: any, y: any) => x.sort_order - y.sort_order),
    })).filter((f: any) => f.id),
  }
}

// ── Portal: add crew member + planning (no auth, token validated) ──
export async function portalAddCrewMember(
  token: string,
  member: { first_name: string; last_name: string; email: string },
  planning: Array<{ work_date: string; lunch: boolean; diner: boolean; night_snack: boolean; parking_card: boolean; walkie_talkie_type: string | null }>
) {
  const admin = createAdminClient()

  // Validate token
  const { data: company } = await admin
    .from('crew_companies')
    .select('id, project_id')
    .eq('invite_token', token)
    .single()

  if (!company) return { error: 'Ongeldige uitnodigingslink.' }

  // Insert member
  const { data: newMember, error: memberError } = await admin
    .from('crew_members')
    .insert({
      crew_company_id: company.id,
      project_id: company.project_id,
      first_name: member.first_name.trim(),
      last_name: member.last_name.trim(),
      email: member.email?.trim() || null,
    })
    .select('id')
    .single()

  if (memberError || !newMember) return { error: memberError?.message || 'Aanmaken mislukt.' }

  // Insert planning rows for selected days
  if (planning.length > 0) {
    const rows = planning.map(p => ({
      crew_member_id: newMember.id,
      project_id: company.project_id,
      work_date: p.work_date,
      lunch: p.lunch,
      diner: p.diner,
      night_snack: p.night_snack,
      parking_card: p.parking_card,
      walkie_talkie_type: p.walkie_talkie_type || null,
      status: 'pending_approval',
    }))
    const { error: planError } = await admin.from('crew_planning').insert(rows)
    if (planError) return { error: planError.message }
  }

  return { success: true, memberId: newMember.id }
}

// ── Admin: update crew member fields ─────────────────────────
export async function adminUpdateCrewMember(
  projectId: string,
  memberId: string,
  fields: Partial<{
    first_name: string
    last_name: string
    email: string
    phone: string
    clothing_size: string
    notes: string
    parking_ticket: string
  }>
) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_members')
    .update(fields)
    .eq('id', memberId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/crew`)
  return { success: true }
}

// ── Admin: approve single day ─────────────────────────────────
export async function adminApprovePlanningDay(projectId: string, planningId: string) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_planning')
    .update({ status: 'approved' })
    .eq('id', planningId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/crew`)
  return { success: true }
}

// ── Admin: approve all days for a member ─────────────────────
export async function adminApproveAllDays(projectId: string, memberId: string) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_planning')
    .update({ status: 'approved' })
    .eq('crew_member_id', memberId)
    .eq('project_id', projectId)
    .eq('status', 'pending_approval')

  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/crew`)
  return { success: true }
}

// ── Admin: reject planning day ────────────────────────────────
export async function adminRejectPlanningDay(projectId: string, planningId: string) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_planning')
    .update({ status: 'rejected' })
    .eq('id', planningId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/crew`)
  return { success: true }
}

// ── Admin: toggle check-in ────────────────────────────────────
export async function adminToggleCheckin(projectId: string, planningId: string, checkedIn: boolean) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_planning')
    .update({
      checked_in: checkedIn,
      checked_in_at: checkedIn ? new Date().toISOString() : null,
    })
    .eq('id', planningId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/crew/checkin`)
  return { success: true }
}

// ── Wristband CRUD ────────────────────────────────────────────
export async function createWristband(projectId: string, name: string, color: string) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('wristbands')
    .insert({ project_id: projectId, name, color })

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/wristbands`)
  return { success: true }
}

export async function deleteWristband(projectId: string, wristbandId: string) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('wristbands')
    .delete()
    .eq('id', wristbandId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/settings/wristbands`)
  return { success: true }
}

export async function adminSetWristband(projectId: string, memberId: string, wristbandId: string | null) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_members')
    .update({ wristband_id: wristbandId })
    .eq('id', memberId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/crew`)
  return { success: true }
}

// ── Admin: check-in crew member by member ID (QR scan) ────────
export async function adminCheckinByMemberId(projectId: string, memberId: string, date: string) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { data: row, error: findError } = await admin
    .from('crew_planning')
    .select('id, checked_in')
    .eq('project_id', projectId)
    .eq('crew_member_id', memberId)
    .eq('work_date', date)
    .eq('status', 'approved')
    .single()

  if (findError || !row) return { error: 'Geen goedgekeurd werkdag gevonden voor dit crewlid.' }
  if (row.checked_in) return { alreadyCheckedIn: true, planningId: row.id }

  const { error } = await admin
    .from('crew_planning')
    .update({ checked_in: true, checked_in_at: new Date().toISOString() })
    .eq('id', row.id)

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/crew/checkin`)
  return { success: true, planningId: row.id }
}

// ── Admin: delete crew member ─────────────────────────────────
export async function adminDeleteCrewMember(projectId: string, memberId: string) {
  const user = await guardCrewAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_members')
    .delete()
    .eq('id', memberId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/crew`)
  return { success: true }
}
