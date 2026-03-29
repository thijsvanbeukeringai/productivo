export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedMember } from '@/lib/supabase/session'
import { createForm } from '@/lib/actions/form.actions'
import { getServerTranslations } from '@/lib/i18n/server'

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

        {!forms || forms.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-8 py-14 text-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{T.forms.noForms}</p>
            <p className="text-xs text-slate-400">{T.forms.noFormsDesc}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map(f => {
              const fieldCount = (f.form_fields as any[])?.length ?? 0
              const assignments = (f.form_assignments as any[]) ?? []
              const responseCount = (f.form_responses as any[])?.length ?? 0
              return (
                <Link key={f.id} href={`/project/${projectId}/forms/${f.id}`}
                  className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{f.title}</h2>
                      {f.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{f.description}</p>}
                      <p className="text-xs text-slate-400 mt-1">
                        {fieldCount} {fieldCount === 1 ? 'veld' : 'velden'}
                        {responseCount > 0 && <> · <span className="text-green-600 dark:text-green-400 font-medium">{responseCount} {T.forms.responseCount}</span></>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[200px]">
                      {assignments.map((a: any) => (
                        <span key={a.crew_company_id} className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800">
                          {a.crew_companies?.name ?? '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
