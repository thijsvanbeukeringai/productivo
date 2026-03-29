export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedMember } from '@/lib/supabase/session'
import { RoosterClient } from './RoosterClient'

interface PageProps { params: Promise<{ projectId: string }> }

export default async function RoosterPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')
  const canAdmin = ['super_admin', 'company_admin', 'centralist'].includes(member.role)

  const admin = createAdminClient()
  const [{ data: shifts }, { data: crewMembers }] = await Promise.all([
    admin.from('crew_shifts')
      .select(`id, title, work_date, start_time, end_time, max_slots, notes, crew_shift_assignments(crew_member_id, crew_members(id, first_name, last_name, crew_companies(name)))`)
      .eq('project_id', projectId)
      .order('work_date', { ascending: true })
      .order('start_time', { ascending: true }),
    admin.from('crew_members')
      .select('id, first_name, last_name, crew_companies(name), crew_planning(status)')
      .eq('project_id', projectId)
      .order('last_name', { ascending: true }),
  ])

  // Only include crew members who have at least one approved planning row
  const approvedMembers = (crewMembers || []).filter((m: any) =>
    (m.crew_planning || []).some((p: any) => p.status === 'approved')
  )

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <RoosterClient
        projectId={projectId}
        initialShifts={(shifts || []) as any}
        crewMembers={approvedMembers as any}
        canAdmin={canAdmin}
      />
    </main>
  )
}
