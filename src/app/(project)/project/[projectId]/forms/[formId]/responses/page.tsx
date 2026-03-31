export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedMember } from '@/lib/supabase/session'
import { getServerTranslations } from '@/lib/i18n/server'
import { FormResponsesClient } from './FormResponsesClient'

interface PageProps { params: Promise<{ projectId: string; formId: string }> }

export default async function FormResponsesPage({ params }: PageProps) {
  const { projectId, formId } = await params
  const supabase = await createClient()
  const T = await getServerTranslations()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')

  const admin = createAdminClient()
  const [{ data: form }, { data: responses }] = await Promise.all([
    admin.from('forms').select('id, title, form_fields(id, type, label, sort_order)').eq('id', formId).eq('project_id', projectId).single(),
    admin.from('form_responses').select('id, data, submitted_at, crew_members(first_name, last_name)').eq('form_id', formId).order('submitted_at', { ascending: false }),
  ])

  if (!form) notFound()

  const fields = ((form.form_fields as any[]) || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const initialResponses = (responses || []).map((r: any) => ({
    id: r.id,
    data: r.data as Record<string, unknown>,
    submitted_at: r.submitted_at,
    crew_members: r.crew_members as { first_name: string; last_name: string } | null,
  }))

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <div className="max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/project/${projectId}/forms/${formId}`}
            className="text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
            ← {form.title}
          </Link>
        </div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
          {T.forms.responses}
        </h1>

        <FormResponsesClient
          formId={formId}
          fields={fields}
          initialResponses={initialResponses}
          noResponsesLabel={T.forms.noResponses}
          submittedOnLabel={T.forms.submittedOn}
          responseCountLabel={T.forms.responseCount}
          responsesLabel={T.forms.responses}
        />
      </div>
    </main>
  )
}
