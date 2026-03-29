import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CheckinClient } from './CheckinClient'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function CheckinPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const memberRes = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!memberRes.data) redirect('/dashboard')

  const canAdmin = ['super_admin', 'company_admin', 'centralist'].includes(memberRes.data.role)

  const admin = createAdminClient()
  const [{ data: planningRows }, { data: wristbands }] = await Promise.all([
    admin
      .from('crew_planning')
      .select(`
        id, work_date, lunch, diner, night_snack, parking_card, walkie_talkie_type,
        status, checked_in, checked_in_at,
        crew_members(
          id, first_name, last_name, email, phone, parking_ticket,
          wristband_id, wristbands(id, name, color),
          crew_companies(id, name)
        )
      `)
      .eq('project_id', projectId)
      .eq('status', 'approved')
      .order('work_date', { ascending: true }),
    admin
      .from('wristbands')
      .select('id, name, color')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
  ])

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <CheckinClient
        projectId={projectId}
        planningRows={(planningRows || []) as any}
        wristbands={(wristbands || []) as any}
        canAdmin={canAdmin}
      />
    </main>
  )
}
