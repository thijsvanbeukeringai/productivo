export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBriefing } from '@/lib/actions/briefing.actions'
import { getServerTranslations } from '@/lib/i18n/server'

interface PageProps {
  params: Promise<{ projectId: string }>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function BriefingsPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()
  const T = await getServerTranslations()

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
  const { data: briefings } = await admin
    .from('briefings')
    .select(`
      id, title, content, updated_at,
      briefing_assignments(crew_company_id, crew_companies(name))
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  async function handleCreate(formData: FormData) {
    'use server'
    const title = (formData.get('title') as string)?.trim() || T.briefings.untitled
    const res = await createBriefing(projectId, title)
    if (res.success && res.id) redirect(`/project/${projectId}/briefings/${res.id}`)
  }

  return (
    <main className="h-full overflow-y-auto px-6 py-4">
      <div className="max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.briefings.title}</h1>

          {canAdmin && (
            <form action={handleCreate} className="flex items-center gap-2">
              <input
                name="title"
                placeholder={T.briefings.untitled}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
              <button
                type="submit"
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                + {T.briefings.new}
              </button>
            </form>
          )}
        </div>

        {/* List */}
        {!briefings || briefings.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-8 py-14 text-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{T.briefings.noBriefings}</p>
            <p className="text-xs text-slate-400">{T.briefings.noBriefingsDesc}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {briefings.map(b => {
              const blockCount = Array.isArray(b.content) ? b.content.length : 0
              const assignments = (b.briefing_assignments as any[]) || []
              return (
                <Link
                  key={b.id}
                  href={`/project/${projectId}/briefings/${b.id}`}
                  className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {b.title}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {blockCount} {blockCount === 1 ? 'blok' : 'blokken'}
                        {' · '}
                        {T.briefings.lastUpdated} {formatDate(b.updated_at)}
                      </p>
                    </div>

                    {/* Assigned companies */}
                    {assignments.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[200px]">
                        {assignments.map((a: any) => (
                          <span
                            key={a.crew_company_id}
                            className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800"
                          >
                            {a.crew_companies?.name ?? '—'}
                          </span>
                        ))}
                      </div>
                    )}
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
