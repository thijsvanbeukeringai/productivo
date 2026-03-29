export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedMember } from '@/lib/supabase/session'
import { BriefingDetailClient } from './BriefingDetailClient'

interface PageProps {
  params: Promise<{ projectId: string; briefingId: string }>
}

export default async function BriefingDetailPage({ params }: PageProps) {
  const { projectId, briefingId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')
  const canAdmin = ['super_admin', 'company_admin', 'centralist'].includes(member.role)

  const admin = createAdminClient()
  const [{ data: briefing }, { data: companies }, { data: assignments }] = await Promise.all([
    admin
      .from('briefings')
      .select('id, title, content, cover_image_url, updated_at')
      .eq('id', briefingId)
      .eq('project_id', projectId)
      .single(),
    admin
      .from('crew_companies')
      .select('id, name')
      .eq('project_id', projectId)
      .order('name', { ascending: true }),
    admin
      .from('briefing_assignments')
      .select('crew_company_id')
      .eq('briefing_id', briefingId),
  ])

  if (!briefing) notFound()

  const assignedIds = (assignments || []).map((a: any) => a.crew_company_id as string)

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <BriefingDetailClient
        projectId={projectId}
        briefingId={briefingId}
        initialTitle={briefing.title}
        initialContent={(briefing.content as any[]) || []}
        initialCoverImageUrl={(briefing as any).cover_image_url || null}
        companies={(companies || []) as { id: string; name: string }[]}
        assignedCompanyIds={assignedIds}
        canAdmin={canAdmin}
      />
    </main>
  )
}
