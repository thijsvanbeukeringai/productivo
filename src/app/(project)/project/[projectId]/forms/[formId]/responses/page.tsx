export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedMember } from '@/lib/supabase/session'
import { getServerTranslations } from '@/lib/i18n/server'

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
          {responses && responses.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">{responses.length} {T.forms.responseCount}</span>
          )}
        </h1>

        {!responses || responses.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-8 py-14 text-center">
            <p className="text-sm text-slate-400">{T.forms.noResponses}</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Crewlid</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{T.forms.submittedOn}</th>
                  {fields.map((f: any) => (
                    <th key={f.id} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider max-w-[180px] truncate">
                      {f.label || f.type}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {responses.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white whitespace-nowrap">
                      {(() => { const m = (r.crew_members as any); return m ? `${m.first_name} ${m.last_name}` : '—' })()}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                      {new Date(r.submitted_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    {fields.map((f: any) => {
                      const val = r.data?.[f.id]
                      return (
                        <td key={f.id} className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[200px]">
                          {val === null || val === undefined ? <span className="text-slate-300 dark:text-slate-600">—</span>
                           : typeof val === 'boolean' ? (val ? '✓' : '✗')
                           : String(val)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
