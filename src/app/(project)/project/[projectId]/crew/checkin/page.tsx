import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedMember } from '@/lib/supabase/session'
import { CheckinClient } from './CheckinClient'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function CheckinPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')

  const canAdmin = ['super_admin', 'company_admin', 'centralist'].includes(member.role)

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
