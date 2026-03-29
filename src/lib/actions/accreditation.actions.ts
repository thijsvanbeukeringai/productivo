'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function guardAdmin(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('project_members').select('role')
    .eq('project_id', projectId).eq('user_id', user.id).single()
  if (!data || !['super_admin', 'company_admin', 'centralist'].includes(data.role)) return null
  return user
}

function path(projectId: string) {
  revalidatePath(`/project/${projectId}/accreditation`)
}

// ── Zones ─────────────────────────────────────────────────────
export async function createZone(projectId: string, name: string, color: string, capacity?: number | null) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { data: row, error } = await admin.from('accreditation_zones')
    .insert({ project_id: projectId, name: name.trim(), color, capacity: capacity ?? null })
    .select('id, sort_order').single()
  if (error) return { error: error.message }
  path(projectId); return { success: true, id: row.id, sort_order: row.sort_order }
}

export async function deleteZone(projectId: string, zoneId: string) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_zones')
    .delete().eq('id', zoneId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

// ── Item types ────────────────────────────────────────────────
export async function createItemType(projectId: string, name: string, totalAvailable: number | null) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { data: row, error } = await admin.from('accreditation_item_types')
    .insert({ project_id: projectId, name: name.trim(), total_available: totalAvailable })
    .select('id').single()
  if (error) return { error: error.message }
  path(projectId); return { success: true, id: row.id }
}

export async function deleteItemType(projectId: string, itemTypeId: string) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_item_types')
    .delete().eq('id', itemTypeId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

// ── Groups ────────────────────────────────────────────────────
export async function createGroup(
  projectId: string,
  data: { name: string; contact_name: string; contact_email: string; type: string }
) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { data: row, error } = await admin.from('accreditation_groups')
    .insert({ project_id: projectId, ...data, name: data.name.trim() })
    .select('id, invite_token').single()
  if (error) return { error: error.message }
  path(projectId); return { success: true, id: row.id, token: row.invite_token }
}

export async function updateGroupItemLimits(projectId: string, groupId: string, limits: Record<string, number>) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_groups')
    .update({ item_limits: limits }).eq('id', groupId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

export async function updateGroupMealConfig(projectId: string, groupId: string, mealConfig: Record<string, string[]>) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_groups')
    .update({ meal_config: mealConfig }).eq('id', groupId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

export async function updateGroupMaxPersons(projectId: string, groupId: string, maxPersons: number | null) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_groups')
    .update({ max_persons: maxPersons }).eq('id', groupId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

export async function deleteGroup(projectId: string, groupId: string) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_groups')
    .delete().eq('id', groupId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

// ── Persons ───────────────────────────────────────────────────
export async function createPerson(
  projectId: string,
  data: { first_name: string; last_name: string; email: string; role: string; group_id: string | null; notes: string }
) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { data: row, error } = await admin.from('accreditation_persons')
    .insert({
      project_id: projectId,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email?.trim() || null,
      role: data.role,
      group_id: data.group_id || null,
      notes: data.notes?.trim() || null,
    })
    .select('id').single()
  if (error) return { error: error.message }
  path(projectId); return { success: true, id: row.id }
}

export async function updatePerson(
  projectId: string,
  personId: string,
  fields: Partial<{ first_name: string; last_name: string; email: string | null; role: string; group_id: string | null; notes: string | null; valid_days: string[] | null; meal_selections: Record<string, string[]> | null; status: string }>
) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_persons')
    .update(fields).eq('id', personId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

export async function deletePerson(projectId: string, personId: string) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_persons')
    .delete().eq('id', personId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

export async function approvePerson(projectId: string, personId: string) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  // Fetch the person's valid_days to set as approved_days
  const { data: p } = await admin.from('accreditation_persons')
    .select('valid_days').eq('id', personId).single()
  const { error } = await admin.from('accreditation_persons')
    .update({ status: 'approved', approved_days: p?.valid_days || null })
    .eq('id', personId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

export async function approvePersonDays(projectId: string, personId: string, approvedDays: string[]) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const newStatus = approvedDays.length > 0 ? 'approved' : 'draft'
  const { error } = await admin.from('accreditation_persons')
    .update({ status: newStatus, approved_days: approvedDays.length > 0 ? approvedDays : null })
    .eq('id', personId).eq('project_id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true, status: newStatus }
}

export async function approveAllDraftInGroup(projectId: string, groupId: string) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  // Fetch all draft persons in this group to get their valid_days
  const { data: draftPersons } = await admin.from('accreditation_persons')
    .select('id, valid_days').eq('project_id', projectId).eq('group_id', groupId).eq('status', 'draft')
  if (draftPersons) {
    await Promise.all(draftPersons.map(p =>
      admin.from('accreditation_persons')
        .update({ status: 'approved', approved_days: p.valid_days || null })
        .eq('id', p.id)
    ))
  }
  path(projectId); return { success: true }
}

// ── Zone assignments ──────────────────────────────────────────
export async function setPersonZones(projectId: string, personId: string, zoneIds: string[]) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  // Replace all
  await admin.from('accreditation_person_zones').delete().eq('person_id', personId)
  if (zoneIds.length > 0) {
    const { error } = await admin.from('accreditation_person_zones')
      .insert(zoneIds.map(zone_id => ({ person_id: personId, zone_id })))
    if (error) return { error: error.message }
  }
  path(projectId); return { success: true }
}

// ── Item assignments ──────────────────────────────────────────
export async function setPersonItems(
  projectId: string,
  personId: string,
  items: Array<{ item_type_id: string; quantity: number; selected_variant?: string | null; day?: string | null }>
) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  // Replace all
  await admin.from('accreditation_person_items').delete().eq('person_id', personId)
  const toInsert = items.filter(i => i.quantity > 0)
  if (toInsert.length > 0) {
    const { error } = await admin.from('accreditation_person_items')
      .insert(toInsert.map(i => ({ person_id: personId, item_type_id: i.item_type_id, quantity: i.quantity, selected_variant: i.selected_variant || null, day: i.day || null })))
    if (error) return { error: error.message }
  }
  path(projectId); return { success: true }
}

export async function updateItemTypeVariants(projectId: string, itemTypeId: string, variants: string[]) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_item_types')
    .update({ variants: variants.length > 0 ? variants : null })
    .eq('id', itemTypeId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

// ── Project show days ─────────────────────────────────────────
export async function updateProjectShowDays(projectId: string, days: string[]) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('projects')
    .update({ show_days: days.length > 0 ? days : null })
    .eq('id', projectId)
  if (error) return { error: error.message }
  path(projectId)
  return { success: true }
}

export async function updateProjectDayMeals(projectId: string, dayMeals: Record<string, string[]>) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('projects').update({ day_meals: dayMeals }).eq('id', projectId)
  if (error) return { error: error.message }

  // Clean up person meal_selections: remove meals no longer available for each day
  const { data: persons } = await admin.from('accreditation_persons')
    .select('id, meal_selections')
    .eq('project_id', projectId)
    .not('meal_selections', 'is', null)

  if (persons && persons.length > 0) {
    const updates: Promise<unknown>[] = []
    for (const p of persons) {
      const sel = p.meal_selections as Record<string, string[]>
      if (!sel) continue
      let changed = false
      const cleaned: Record<string, string[]> = {}
      for (const [day, meals] of Object.entries(sel)) {
        const allowed = dayMeals[day] || []
        // If no meals configured for this day, remove all selections for it
        if (allowed.length === 0) { changed = true; continue }
        const filtered = meals.filter(m => allowed.includes(m))
        if (filtered.length !== meals.length) changed = true
        if (filtered.length > 0) cleaned[day] = filtered
      }
      if (changed) {
        const newSel = Object.keys(cleaned).length > 0 ? cleaned : null
        updates.push(admin.from('accreditation_persons').update({ meal_selections: newSel }).eq('id', p.id) as unknown as Promise<unknown>)
      }
    }
    if (updates.length > 0) await Promise.all(updates)
  }

  path(projectId); return { success: true }
}

export async function updateProjectDayItems(projectId: string, dayItems: Record<string, string[]>) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('projects').update({ day_items: dayItems }).eq('id', projectId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

export async function updateProjectBuildDays(projectId: string, days: string[]) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('projects')
    .update({ build_days: days.length > 0 ? days : null })
    .eq('id', projectId)
  if (error) return { error: error.message }
  path(projectId)
  return { success: true }
}

export async function markItemIssued(projectId: string, personItemId: string, issued: boolean) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()
  const { error } = await admin.from('accreditation_person_items')
    .update({ issued, issued_at: issued ? new Date().toISOString() : null })
    .eq('id', personItemId)
  if (error) return { error: error.message }
  path(projectId); return { success: true }
}

// ── Check-in (QR scan — fraud prevention) ────────────────────
export async function checkInByQrToken(projectId: string, qrToken: string) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()

  const { data: person } = await admin.from('accreditation_persons')
    .select('id, first_name, last_name, role, status, checked_in_at, valid_days')
    .eq('qr_token', qrToken).eq('project_id', projectId).single()

  if (!person) {
    await admin.from('accreditation_scan_log').insert({
      project_id: projectId,
      person_id: null,
      qr_token: qrToken,
      success: false,
      action: 'checkin',
      message: 'Onbekend accreditatiebewijs.',
    })
    return { error: 'Onbekend accreditatiebewijs.' }
  }

  if (person.status === 'draft') {
    await admin.from('accreditation_scan_log').insert({
      project_id: projectId,
      person_id: person.id,
      qr_token: qrToken,
      success: false,
      action: 'checkin',
      message: 'Niet goedgekeurd.',
    })
    return { error: 'Niet goedgekeurd. Vraag de beheerder om goedkeuring.' }
  }

  // Feature 2: check valid_days
  if (person.valid_days && person.valid_days.length > 0) {
    const nowAmsterdam = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    if (!person.valid_days.includes(nowAmsterdam)) {
      await admin.from('accreditation_scan_log').insert({
        project_id: projectId,
        person_id: person.id,
        qr_token: qrToken,
        success: false,
        action: 'checkin',
        message: 'Niet geaccrediteerd voor vandaag.',
      })
      return { error: 'Niet geaccrediteerd voor vandaag.' }
    }
  }

  // Fetch items for this person
  const { data: personItems } = await admin.from('accreditation_person_items')
    .select('id, item_type_id, quantity, issued, issued_at, accreditation_item_types(name)')
    .eq('person_id', person.id)

  const items = (personItems || []) as unknown as Array<{
    id: string; item_type_id: string; quantity: number; issued: boolean; issued_at: string | null
    accreditation_item_types: { name: string } | null
  }>

  if (person.status === 'checked_in') {
    await admin.from('accreditation_scan_log').insert({
      project_id: projectId,
      person_id: person.id,
      qr_token: qrToken,
      success: true,
      action: 'checkin',
      message: 'Al ingecheckt.',
    })
    return { alreadyCheckedIn: true, person, items }
  }

  const { error } = await admin.from('accreditation_persons')
    .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
    .eq('id', person.id)

  if (error) {
    return { error: error.message }
  }

  await admin.from('accreditation_scan_log').insert({
    project_id: projectId,
    person_id: person.id,
    qr_token: qrToken,
    success: true,
    action: 'checkin',
    message: 'Ingecheckt.',
  })

  revalidatePath(`/project/${projectId}/accreditation/checkin`)
  return { success: true, person, items }
}

export async function checkOutPerson(projectId: string, personId: string) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()

  // Fetch qr_token for logging
  const { data: personData } = await admin.from('accreditation_persons')
    .select('qr_token').eq('id', personId).single()

  const { error } = await admin.from('accreditation_persons')
    .update({ status: 'checked_out', checked_out_at: new Date().toISOString() })
    .eq('id', personId).eq('project_id', projectId)
  if (error) return { error: error.message }

  await admin.from('accreditation_scan_log').insert({
    project_id: projectId,
    person_id: personId,
    qr_token: personData?.qr_token || '',
    success: true,
    action: 'checkout',
    message: 'Uitgecheckt.',
  })

  revalidatePath(`/project/${projectId}/accreditation/checkin`)
  return { success: true }
}

// ── Bulk CSV import ────────────────────────────────────────────
export async function bulkCreatePersons(
  projectId: string,
  persons: Array<{ first_name: string; last_name: string; email: string; role: string; group_name: string }>
) {
  const user = await guardAdmin(projectId)
  if (!user) return { error: 'Geen toegang.' }
  const admin = createAdminClient()

  // Fetch groups to map name → id
  const { data: groups } = await admin.from('accreditation_groups')
    .select('id, name').eq('project_id', projectId)
  const groupMap: Record<string, string> = {}
  for (const g of groups || []) {
    groupMap[g.name.toLowerCase().trim()] = g.id
  }

  const rows = persons.map(p => ({
    project_id: projectId,
    first_name: p.first_name.trim(),
    last_name: p.last_name.trim(),
    email: p.email?.trim() || null,
    role: p.role?.trim() || 'crew',
    group_id: p.group_name ? (groupMap[p.group_name.toLowerCase().trim()] || null) : null,
    status: 'draft',
  }))

  const { error } = await admin.from('accreditation_persons').insert(rows)
  if (error) return { error: error.message }
  path(projectId)
  return { success: true, count: rows.length }
}

// ── Portal (no auth, token validated) ────────────────────────
export async function getAccreditationPortalData(token: string) {
  const admin = createAdminClient()
  const { data: group } = await admin.from('accreditation_groups')
    .select('id, name, contact_name, type, project_id, item_limits, max_persons')
    .eq('invite_token', token).single()
  if (!group) return { error: 'Ongeldige of verlopen uitnodigingslink.' }

  const [projectRes, personsRes, briefingRes, zonesRes, itemTypesRes, usedItemsRes] = await Promise.all([
    admin.from('projects').select('id, name, show_days, build_days, day_meals, day_items').eq('id', group.project_id).single(),
    admin.from('accreditation_persons')
      .select('id, first_name, last_name, email, role, status, valid_days, approved_days, meal_selections, created_at, accreditation_person_items(item_type_id, quantity, selected_variant, day)')
      .eq('group_id', group.id).order('created_at', { ascending: true }),
    admin.from('briefing_assignments')
      .select('briefings(id, title, content, cover_image_url)')
      .eq('accreditation_group_id', group.id),
    admin.from('accreditation_zones')
      .select('id, name, color').eq('project_id', group.project_id).order('sort_order'),
    admin.from('accreditation_item_types')
      .select('id, name, total_available, variants').eq('project_id', group.project_id).order('name'),
    admin.from('accreditation_person_items')
      .select('item_type_id, person_id, accreditation_persons!inner(group_id)')
      .eq('accreditation_persons.group_id', group.id),
  ])

  if (!projectRes.data) return { error: 'Project niet gevonden.' }

  // Count distinct persons per item type for this group (per-person model)
  const usedPerItem: Record<string, number> = {}
  const personsByItem: Record<string, Set<string>> = {}
  for (const row of (usedItemsRes.data || []) as any[]) {
    const id = row.item_type_id
    if (!personsByItem[id]) personsByItem[id] = new Set()
    personsByItem[id].add(row.person_id)
  }
  for (const [id, persons] of Object.entries(personsByItem)) {
    usedPerItem[id] = persons.size
  }

  const showDays = (projectRes.data.show_days as string[] | null) || []
  const buildDays = (projectRes.data.build_days as string[] | null) || []

  // Merge all days sorted, each tagged with type
  const allDays = [
    ...buildDays.map(d => ({ date: d, type: 'build' as const })),
    ...showDays.map(d => ({ date: d, type: 'show' as const })),
  ].filter((d, i, arr) => arr.findIndex(x => x.date === d.date) === i)
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    group: {
      id: group.id, name: group.name, type: group.type,
      item_limits: (group.item_limits as Record<string, number>) || {},
      max_persons: group.max_persons as number | null,
    },
    project: { name: projectRes.data.name },
    allDays,
    dayMeals: (projectRes.data.day_meals as Record<string, string[]> | null) || {},
    dayItems: (projectRes.data.day_items as Record<string, string[]> | null) || {},
    zones: zonesRes.data || [],
    itemTypes: itemTypesRes.data || [],
    usedPerItem,
    persons: personsRes.data || [],
    briefings: (briefingRes.data || []).map((a: any) => a.briefings).filter(Boolean),
  }
}

export async function portalAddPerson(
  token: string,
  data: {
    first_name: string; last_name: string; email: string; role: string
    valid_days?: string[]
    meal_selections?: Record<string, string[]>
    items?: Array<{ item_type_id: string; quantity: number; selected_variant?: string; day?: string | null }>
  }
) {
  const admin = createAdminClient()
  const { data: group } = await admin.from('accreditation_groups')
    .select('id, project_id').eq('invite_token', token).single()
  if (!group) return { error: 'Ongeldige uitnodigingslink.' }

  const { data: row, error } = await admin.from('accreditation_persons')
    .insert({
      project_id: group.project_id,
      group_id: group.id,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email?.trim() || null,
      role: data.role,
      status: 'draft',
      valid_days: data.valid_days && data.valid_days.length > 0 ? data.valid_days : null,
      meal_selections: data.meal_selections && Object.keys(data.meal_selections).length > 0 ? data.meal_selections : null,
    })
    .select('id').single()

  if (error) return { error: error.message }

  const itemsToInsert = (data.items || []).filter(i => i.quantity > 0)
  if (itemsToInsert.length > 0) {
    await admin.from('accreditation_person_items')
      .insert(itemsToInsert.map(i => ({ person_id: row.id, item_type_id: i.item_type_id, quantity: i.quantity, selected_variant: i.selected_variant || null, day: (i as any).day || null })))
  }

  revalidatePath(`/project/${group.project_id}/accreditation`)
  return { success: true, id: row.id }
}

export async function portalUpdatePerson(
  token: string,
  personId: string,
  data: {
    first_name: string; last_name: string; email?: string
    valid_days?: string[]
    meal_selections?: Record<string, string[]>
    items?: Array<{ item_type_id: string; quantity: number; selected_variant?: string; day?: string | null }>
  }
) {
  const admin = createAdminClient()
  const { data: group } = await admin.from('accreditation_groups')
    .select('id, project_id').eq('invite_token', token).single()
  if (!group) return { error: 'Ongeldige uitnodigingslink.' }

  const { data: person } = await admin.from('accreditation_persons')
    .select('id, status').eq('id', personId).eq('group_id', group.id).single()
  if (!person) return { error: 'Persoon niet gevonden.' }
  if (person.status !== 'draft') return { error: 'Goedgekeurde personen kunnen niet meer bewerkt worden.' }

  const { error } = await admin.from('accreditation_persons')
    .update({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email?.trim() || null,
      valid_days: data.valid_days && data.valid_days.length > 0 ? data.valid_days : null,
      meal_selections: data.meal_selections && Object.keys(data.meal_selections).length > 0 ? data.meal_selections : null,
    })
    .eq('id', personId)

  if (error) return { error: error.message }

  if (data.items !== undefined) {
    await admin.from('accreditation_person_items').delete().eq('person_id', personId)
    const toInsert = data.items.filter(i => i.quantity > 0)
    if (toInsert.length > 0) {
      await admin.from('accreditation_person_items').insert(
        toInsert.map(i => ({ person_id: personId, item_type_id: i.item_type_id, quantity: i.quantity, selected_variant: i.selected_variant || null, day: (i as any).day || null }))
      )
    }
  }

  revalidatePath(`/project/${group.project_id}/accreditation`)
  return { success: true }
}

export async function portalDeletePerson(token: string, personId: string) {
  const admin = createAdminClient()
  const { data: group } = await admin.from('accreditation_groups')
    .select('id, project_id').eq('invite_token', token).single()
  if (!group) return { error: 'Ongeldige uitnodigingslink.' }

  const { data: person } = await admin.from('accreditation_persons')
    .select('id, status').eq('id', personId).eq('group_id', group.id).single()
  if (!person) return { error: 'Persoon niet gevonden.' }
  if (!['draft'].includes(person.status)) return { error: 'Goedgekeurde personen kunnen niet verwijderd worden.' }

  const { error } = await admin.from('accreditation_persons')
    .delete().eq('id', personId)
  if (error) return { error: error.message }

  revalidatePath(`/project/${group.project_id}/accreditation`)
  return { success: true }
}
