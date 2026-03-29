export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AccreditationClient } from './AccreditationClient'

interface PageProps {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function AccreditationPage({ params, searchParams }: PageProps) {
  const { projectId } = await params
  const { tab } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase.from('project_members')
    .select('role').eq('project_id', projectId).eq('user_id', user.id).single()
  if (!member) redirect('/dashboard')

  const canAdmin = ['super_admin', 'company_admin', 'centralist'].includes(member.role)

  const admin = createAdminClient()
  const [
    { data: persons },
    { data: groups },
    { data: zones },
    { data: itemTypes },
    { data: briefings },
    { data: briefingAssignments },
    { data: projectData },
  ] = await Promise.all([
    admin.from('accreditation_persons')
      .select(`
        id, first_name, last_name, email, role, status, notes, qr_token, checked_in_at, checked_out_at, created_at,
        group_id, valid_days, approved_days, meal_selections,
        accreditation_groups(id, name, type),
        accreditation_person_zones(zone_id),
        accreditation_person_items(id, item_type_id, quantity, issued, issued_at, selected_variant)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    admin.from('accreditation_groups')
      .select('id, name, contact_name, contact_email, type, invite_token, item_limits, max_persons, meal_config, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    admin.from('accreditation_zones')
      .select('id, name, color, sort_order, capacity')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    admin.from('accreditation_item_types')
      .select('id, name, total_available, sort_order, variants')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    admin.from('briefings')
      .select('id, title, cover_image_url')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    admin.from('briefing_assignments')
      .select('briefing_id, accreditation_group_id')
      .not('accreditation_group_id', 'is', null),
    admin.from('projects')
      .select('show_days, build_days, day_meals, day_items')
      .eq('id', projectId)
      .single(),
  ])

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <AccreditationClient
        projectId={projectId}
        initialPersons={(persons || []) as any}
        initialGroups={(groups || []) as any}
        initialZones={(zones || []) as any}
        initialItemTypes={(itemTypes || []) as any}
        initialBriefings={(briefings || []) as any}
        initialBriefingAssignments={(briefingAssignments || []) as any}
        canAdmin={canAdmin}
        projectShowDays={(projectData?.show_days as string[] | null) || []}
        projectBuildDays={(projectData?.build_days as string[] | null) || []}
        projectDayMeals={(projectData?.day_meals as Record<string, string[]> | null) || {}}
        projectDayItems={(projectData?.day_items as Record<string, string[]> | null) || {}}
        initialTab={tab || 'persons'}
      />
    </main>
  )
}
