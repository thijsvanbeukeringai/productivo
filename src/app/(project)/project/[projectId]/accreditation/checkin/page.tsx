export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AccreditationCheckinClient } from './AccreditationCheckinClient'

interface PageProps { params: Promise<{ projectId: string }> }

export default async function AccreditationCheckinPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase.from('project_members')
    .select('role').eq('project_id', projectId).eq('user_id', user.id).single()
  if (!member) redirect('/dashboard')

  const admin = createAdminClient()
  const [
    { data: persons },
    { data: zones },
    { data: scanLog },
  ] = await Promise.all([
    admin.from('accreditation_persons')
      .select(`
        id, first_name, last_name, email, role, status, qr_token, checked_in_at, checked_out_at,
        accreditation_groups(name),
        accreditation_person_zones(zone_id, accreditation_zones(name, color)),
        accreditation_person_items(id, quantity, issued, accreditation_item_types(name))
      `)
      .eq('project_id', projectId)
      .in('status', ['approved', 'checked_in', 'checked_out'])
      .order('last_name', { ascending: true }),
    admin.from('accreditation_zones')
      .select('id, name, color, capacity')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    admin.from('accreditation_scan_log')
      .select('id, qr_token, success, action, message, scanned_at, person_id, accreditation_persons(first_name, last_name)')
      .eq('project_id', projectId)
      .order('scanned_at', { ascending: false })
      .limit(50),
  ])

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <AccreditationCheckinClient
        projectId={projectId}
        initialPersons={(persons || []) as any}
        initialZones={(zones || []) as any}
        initialScanLog={(scanLog || []) as any}
      />
    </main>
  )
}
