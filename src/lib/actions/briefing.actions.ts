'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function guardBriefingAdmin(projectId: string) {
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

// ── Create a new empty briefing ───────────────────────────────
export async function createBriefing(projectId: string, title: string) {
  const user = await guardBriefingAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('briefings')
    .insert({ project_id: projectId, title: title.trim() || 'Zonder titel', content: [], created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/briefings`)
  return { success: true, id: data.id }
}

// ── Update briefing title + content (auto-save) ───────────────
export async function updateBriefing(
  projectId: string,
  briefingId: string,
  title: string,
  content: object[]
) {
  const user = await guardBriefingAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('briefings')
    .update({ title: title.trim() || 'Zonder titel', content, updated_at: new Date().toISOString() })
    .eq('id', briefingId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/briefings`)
  revalidatePath(`/project/${projectId}/briefings/${briefingId}`)
  return { success: true }
}

// ── Delete a briefing ─────────────────────────────────────────
export async function deleteBriefing(projectId: string, briefingId: string) {
  const user = await guardBriefingAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('briefings')
    .delete()
    .eq('id', briefingId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/briefings`)
  return { success: true }
}

// ── Assign briefing to a crew company ────────────────────────
export async function assignBriefing(projectId: string, briefingId: string, companyId: string) {
  const user = await guardBriefingAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('briefing_assignments')
    .upsert({ briefing_id: briefingId, crew_company_id: companyId }, { onConflict: 'briefing_id,crew_company_id' })

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/briefings/${briefingId}`)
  return { success: true }
}

// ── Upload cover image ────────────────────────────────────────
export async function uploadBriefingCover(projectId: string, briefingId: string, formData: FormData) {
  const user = await guardBriefingAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'Geen bestand.' }
  if (!file.type.startsWith('image/')) return { error: 'Alleen afbeeldingen toegestaan.' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Maximaal 5 MB.' }

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `briefing-covers/${briefingId}/cover.${ext}`
  const bytes = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('project-files')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = admin.storage.from('project-files').getPublicUrl(path)
  const publicUrl = urlData.publicUrl + `?t=${Date.now()}`

  const { error: updateError } = await admin
    .from('briefings')
    .update({ cover_image_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', briefingId)
    .eq('project_id', projectId)

  if (updateError) return { error: updateError.message }
  revalidatePath(`/project/${projectId}/briefings/${briefingId}`)
  return { success: true, url: publicUrl }
}

// ── Remove cover image ────────────────────────────────────────
export async function removeBriefingCover(projectId: string, briefingId: string) {
  const user = await guardBriefingAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('briefings')
    .update({ cover_image_url: null, updated_at: new Date().toISOString() })
    .eq('id', briefingId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/briefings/${briefingId}`)
  return { success: true }
}

// ── Assign / unassign briefing to accreditation group ────────
export async function assignBriefingToAccGroup(projectId: string, briefingId: string, groupId: string) {
  const user = await guardBriefingAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('briefing_assignments')
    .upsert({ briefing_id: briefingId, accreditation_group_id: groupId }, { onConflict: 'briefing_id,accreditation_group_id' })
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/accreditation`)
  return { success: true }
}

export async function unassignBriefingFromAccGroup(projectId: string, briefingId: string, groupId: string) {
  const user = await guardBriefingAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('briefing_assignments')
    .delete()
    .eq('briefing_id', briefingId)
    .eq('accreditation_group_id', groupId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/accreditation`)
  return { success: true }
}

// ── Unassign briefing from a crew company ────────────────────
export async function unassignBriefing(projectId: string, briefingId: string, companyId: string) {
  const user = await guardBriefingAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('briefing_assignments')
    .delete()
    .eq('briefing_id', briefingId)
    .eq('crew_company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/briefings/${briefingId}`)
  return { success: true }
}
