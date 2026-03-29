/**
 * Shared helpers for fast per-request auth + project member checks.
 *
 * Strategy:
 * - The middleware already calls getUser() (authoritative JWT check).
 *   Pages can safely use getSession() — it decodes the JWT locally
 *   with no network round-trip (~1ms vs ~25ms).
 * - Member role is cached per (userId, projectId) for 15 seconds
 *   so navigating between pages of the same project skips the DB.
 */

import { unstable_cache } from 'next/cache'
import { createAdminClient } from './admin'

export const getCachedMember = unstable_cache(
  async (projectId: string, userId: string) => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('project_members')
      .select('role, display_mode, custom_display_name, profiles(id, full_name, email, language)')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()
    return data
  },
  ['project-member'],
  { revalidate: 15, tags: ['project-member'] }
)

export const getCachedStaticData = unstable_cache(
  async (projectId: string) => {
    const admin = createAdminClient()
    const [subjectsRes, areasRes, teamsRes, positionsRes, membersRes] = await Promise.all([
      admin.from('subjects').select('*').eq('project_id', projectId).eq('is_active', true).order('sort_order'),
      admin.from('areas').select('*').eq('project_id', projectId).order('sort_order'),
      admin.from('teams').select('*').eq('project_id', projectId).eq('is_active', true).order('number'),
      admin.from('positions').select('*').eq('project_id', projectId).order('number'),
      admin.from('project_members')
        .select('user_id, custom_display_name, profiles(id, full_name, email)')
        .eq('project_id', projectId),
    ])
    return {
      subjects: subjectsRes.data || [],
      areas: areasRes.data || [],
      teams: teamsRes.data || [],
      positions: positionsRes.data || [],
      rawMembers: membersRes.data || [],
    }
  },
  ['project-static'],
  { revalidate: 15, tags: ['project-static'] }
)
