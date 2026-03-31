export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedMember } from '@/lib/supabase/session'
import { createForm } from '@/lib/actions/form.actions'
import { getServerTranslations } from '@/lib/i18n/server'
import { FormsListClient } from './FormsListClient'

interface PageProps { params: Promise<{ projectId: string }> }

export default async function FormsPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()
  const T = await getServerTranslations()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')
  const canAdmin = ['super_admin', 'company_admin', 'centralist'].includes(member.role)

  const admin = createAdminClient()
  const { data: forms } = await admin
    .from('forms')
    .select(`id, title, description, updated_at, form_fields(id), form_assignments(crew_company_id, crew_companies(name)), form_responses(id)`)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  async function handleCreate(formData: FormData) {
    'use server'
    const title = (formData.get('title') as string)?.trim() || T.forms.untitled
    const res = await createForm(projectId, title)
    if (res.success && res.id) redirect(`/project/${projectId}/forms/${res.id}`)
  }

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <div className="max-w-3xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.forms.title}</h1>
          {canAdmin && (
            <form action={handleCreate} className="flex items-center gap-2">
              <input name="title" placeholder={T.forms.untitled}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
              <button type="submit" className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                + {T.forms.new}
              </button>
            </form>
          )}
        </div>

        <FormsListClient
          projectId={projectId}
          initialForms={(forms || []) as any}
          responseCountLabel={T.forms.responseCount}
          noFormsLabel={T.forms.noForms}
          noFormsDescLabel={T.forms.noFormsDesc}
        />
      </div>
    </main>
  )
}
