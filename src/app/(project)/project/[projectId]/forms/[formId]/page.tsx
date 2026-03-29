export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedMember } from '@/lib/supabase/session'
import { FormDetailClient } from './FormDetailClient'

interface PageProps { params: Promise<{ projectId: string; formId: string }> }

export default async function FormDetailPage({ params }: PageProps) {
  const { projectId, formId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')
  const canAdmin = ['super_admin', 'company_admin', 'centralist'].includes(member.role)

  const admin = createAdminClient()
  const [{ data: form }, { data: companies }, { data: assignments }] = await Promise.all([
    admin.from('forms').select(`id, title, description, form_fields(id, type, label, placeholder, options, required, sort_order)`).eq('id', formId).eq('project_id', projectId).single(),
    admin.from('crew_companies').select('id, name').eq('project_id', projectId).order('name'),
    admin.from('form_assignments').select('crew_company_id').eq('form_id', formId),
  ])

  if (!form) notFound()

  const fields = ((form.form_fields as any[]) || []).sort((a, b) => a.sort_order - b.sort_order)
  const assignedIds = (assignments || []).map((a: any) => a.crew_company_id as string)

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <FormDetailClient
        projectId={projectId}
        formId={formId}
        initialTitle={form.title}
        initialDescription={form.description || ''}
        initialFields={fields}
        companies={(companies || []) as { id: string; name: string }[]}
        assignedCompanyIds={assignedIds}
        canAdmin={canAdmin}
      />
    </main>
  )
}
