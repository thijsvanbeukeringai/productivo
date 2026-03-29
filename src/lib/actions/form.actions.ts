'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function guardFormAdmin(projectId: string) {
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

// ── Create form ───────────────────────────────────────────────
export async function createForm(projectId: string, title: string) {
  const user = await guardFormAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('forms')
    .insert({ project_id: projectId, title: title.trim() || 'Zonder titel', created_by: user.id })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/forms`)
  return { success: true, id: data.id }
}

// ── Update form metadata ──────────────────────────────────────
export async function updateForm(projectId: string, formId: string, title: string, description: string) {
  const user = await guardFormAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('forms')
    .update({ title: title.trim() || 'Zonder titel', description: description.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', formId)
    .eq('project_id', projectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/forms`)
  revalidatePath(`/project/${projectId}/forms/${formId}`)
  return { success: true }
}

// ── Delete form ───────────────────────────────────────────────
export async function deleteForm(projectId: string, formId: string) {
  const user = await guardFormAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('forms').delete().eq('id', formId).eq('project_id', projectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/forms`)
  return { success: true }
}

// ── Add field ─────────────────────────────────────────────────
export async function addFormField(projectId: string, formId: string, type: string, sortOrder: number) {
  const user = await guardFormAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('form_fields')
    .insert({ form_id: formId, type, label: '', sort_order: sortOrder })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/forms/${formId}`)
  return { success: true, id: data.id }
}

// ── Update field ──────────────────────────────────────────────
export async function updateFormField(
  projectId: string,
  fieldId: string,
  patch: { label?: string; placeholder?: string; options?: string[] | null; required?: boolean }
) {
  const user = await guardFormAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('form_fields').update(patch).eq('id', fieldId)
  if (error) return { error: error.message }
  return { success: true }
}

// ── Delete field ──────────────────────────────────────────────
export async function deleteFormField(projectId: string, fieldId: string, formId: string) {
  const user = await guardFormAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('form_fields').delete().eq('id', fieldId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/forms/${formId}`)
  return { success: true }
}

// ── Reorder fields ────────────────────────────────────────────
export async function reorderFormFields(projectId: string, formId: string, orderedIds: string[]) {
  const user = await guardFormAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  await Promise.all(orderedIds.map((id, i) =>
    admin.from('form_fields').update({ sort_order: i }).eq('id', id)
  ))
  revalidatePath(`/project/${projectId}/forms/${formId}`)
  return { success: true }
}

// ── Assign / unassign form to company ────────────────────────
export async function assignForm(projectId: string, formId: string, companyId: string) {
  const user = await guardFormAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('form_assignments')
    .upsert({ form_id: formId, crew_company_id: companyId }, { onConflict: 'form_id,crew_company_id' })
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/forms/${formId}`)
  return { success: true }
}

export async function unassignForm(projectId: string, formId: string, companyId: string) {
  const user = await guardFormAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('form_assignments')
    .delete()
    .eq('form_id', formId)
    .eq('crew_company_id', companyId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/forms/${formId}`)
  return { success: true }
}

// ── Submit form response per crew member (portal — no auth, token validated) ──
export async function submitFormResponse(
  token: string,
  formId: string,
  memberId: string,
  data: Record<string, unknown>
) {
  const admin = createAdminClient()
  // Validate token → company
  const { data: company } = await admin
    .from('crew_companies')
    .select('id')
    .eq('invite_token', token)
    .single()
  if (!company) return { error: 'Ongeldige uitnodigingslink.' }

  // Verify form is assigned to this company
  const { data: assignment } = await admin
    .from('form_assignments')
    .select('id')
    .eq('form_id', formId)
    .eq('crew_company_id', company.id)
    .single()
  if (!assignment) return { error: 'Formulier niet gevonden.' }

  // Verify member belongs to this company
  const { data: member } = await admin
    .from('crew_members')
    .select('id')
    .eq('id', memberId)
    .eq('crew_company_id', company.id)
    .single()
  if (!member) return { error: 'Crewlid niet gevonden.' }

  const { error } = await admin
    .from('form_responses')
    .upsert(
      { form_id: formId, crew_member_id: memberId, crew_company_id: company.id, data, submitted_at: new Date().toISOString() },
      { onConflict: 'form_id,crew_member_id' }
    )
  if (error) return { error: error.message }
  return { success: true }
}
