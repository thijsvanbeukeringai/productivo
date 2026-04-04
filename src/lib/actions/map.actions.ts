'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MapPoint, PoiType, CalibrationPoint } from '@/types/app.types'

export async function saveCalibration(projectId: string, points: CalibrationPoint[]) {
  const supabase = await createClient()
  const { error } = await supabase.from('projects').update({ map_calibration: points }).eq('id', projectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return {}
}

export async function saveAreaPolygon(areaId: string, projectId: string, polygon: MapPoint[] | null) {
  const supabase = await createClient()
  const { error } = await supabase.from('areas').update({ map_polygon: polygon }).eq('id', areaId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return {}
}

export async function savePositionPoint(positionId: string, projectId: string, point: MapPoint | null) {
  const supabase = await createClient()
  const { error } = await supabase.from('positions').update({ map_point: point }).eq('id', positionId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return {}
}

export async function saveMapBackground(projectId: string, url: string | null) {
  const supabase = await createClient()
  const { error } = await supabase.from('projects').update({ map_background_url: url }).eq('id', projectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return {}
}

export async function createPoi(projectId: string, label: string, type: PoiType, x: number, y: number, categoryId: string | null, note?: string | null) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('map_pois')
    .insert({ project_id: projectId, label, type, x, y, category_id: categoryId, note: note || null })
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return { data }
}

export async function updatePoi(poiId: string, projectId: string, label: string, type: PoiType, x: number, y: number, categoryId: string | null, note?: string | null) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('map_pois')
    .update({ label, type, x, y, category_id: categoryId, note: note || null })
    .eq('id', poiId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return {}
}

export async function deletePoi(poiId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('map_pois').delete().eq('id', poiId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return {}
}

// --- Area creation from map ---

export async function renameArea(areaId: string, projectId: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('areas').update({ name }).eq('id', areaId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  revalidatePath(`/project/${projectId}/logbook`)
  revalidatePath(`/project/${projectId}/settings/areas`)
  return {}
}

export async function createAreaFromMap(projectId: string, name: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('areas')
    .insert({ project_id: projectId, name, sort_order: 0 })
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  revalidatePath(`/project/${projectId}/logbook`)
  revalidatePath(`/project/${projectId}/settings/areas`)
  return { data }
}

export async function deleteAreaFromMap(areaId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('areas').delete().eq('id', areaId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  revalidatePath(`/project/${projectId}/logbook`)
  revalidatePath(`/project/${projectId}/settings/areas`)
  return {}
}

// --- Share token ---

export async function generateMapShareToken(projectId: string) {
  const supabase = await createClient()
  const token = crypto.randomUUID().replace(/-/g, '')
  const { error } = await supabase.from('projects').update({ map_share_token: token }).eq('id', projectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return { token }
}

export async function revokeMapShareToken(projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('projects').update({ map_share_token: null }).eq('id', projectId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return {}
}

// --- Category CRUD ---

export async function createPoiCategory(projectId: string, name: string, color: string, display_style: 'dot' | 'numbered' | 'text' = 'dot') {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('map_poi_categories')
    .insert({ project_id: projectId, name, color, display_style })
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return { data }
}

export async function updatePoiCategory(categoryId: string, projectId: string, name: string, color: string, display_style: 'dot' | 'numbered' | 'text' = 'dot') {
  const supabase = await createClient()
  const { error } = await supabase
    .from('map_poi_categories')
    .update({ name, color, display_style })
    .eq('id', categoryId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return {}
}

export async function deletePoiCategory(categoryId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('map_poi_categories').delete().eq('id', categoryId)
  if (error) return { error: error.message }
  revalidatePath(`/project/${projectId}/map`)
  return {}
}
