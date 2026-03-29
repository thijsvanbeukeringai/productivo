export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CrewPlanningClient } from './CrewPlanningClient'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function CrewPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [memberRes, projectRes] = await Promise.all([
    supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('projects')
      .select('id, name, start_date, end_date, show_days')
      .eq('id', projectId)
      .single(),
  ])

  if (!memberRes.data) redirect('/dashboard')
  if (!projectRes.data) notFound()

  const canAdmin = ['super_admin', 'company_admin', 'centralist'].includes(memberRes.data.role)

  const admin = createAdminClient()
  const [{ data: crewCompanies }, { data: wristbands }] = await Promise.all([
    admin
      .from('crew_companies')
      .select(`
        id, name, contact_name, contact_email, target_count, invite_token, created_at,
        crew_members(
          id, first_name, last_name, email, phone, clothing_size, notes, parking_ticket, created_at,
          wristband_id, wristbands(id, name, color),
          crew_planning(id, work_date, lunch, diner, night_snack, parking_card, walkie_talkie_type, status, checked_in, checked_in_at)
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    admin
      .from('wristbands')
      .select('id, name, color, sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  const project = {
    id: projectRes.data.id,
    name: projectRes.data.name,
    start_date: projectRes.data.start_date as string | null,
    end_date: projectRes.data.end_date as string | null,
    show_days: (projectRes.data.show_days as string[]) || [],
  }

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <CrewPlanningClient
        projectId={projectId}
        project={project}
        crewCompanies={(crewCompanies || []) as any}
        wristbands={(wristbands || []) as any}
        canAdmin={canAdmin}
        baseUrl={process.env.NEXT_PUBLIC_SITE_URL || ''}
      />
    </main>
  )
}
