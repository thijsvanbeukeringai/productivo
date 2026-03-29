import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember } from '@/lib/supabase/session'
import { createSubject, updateSubject, deleteSubject } from '@/lib/actions/settings.actions'
import { addDefaultSubjects } from '@/lib/actions/project.actions'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'
import { getServerTranslations } from '@/lib/i18n/server'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function SubjectsPage({ params }: PageProps) {
  const { projectId } = await params
  const T = await getServerTranslations()
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) notFound()

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')

  const { data: subjects } = await supabase
    .from('subjects').select('*').eq('project_id', projectId).order('sort_order').order('name')

  async function handleCreate(formData: FormData) {
    'use server'
    formData.set('project_id', projectId)
    await createSubject(formData)
  }

  async function handleToggleActive(subjectId: string, current: boolean) {
    'use server'
    await updateSubject(subjectId, projectId, { is_active: !current })
  }

  async function handleDelete(subjectId: string) {
    'use server'
    await deleteSubject(subjectId, projectId)
  }

  async function handleSeedDefaults() {
    'use server'
    await addDefaultSubjects(projectId)
  }

  return (
    <main className="h-full overflow-y-auto px-4 py-4 max-w-3xl w-full mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <a href={`/project/${projectId}/settings`} className="text-slate-400 hover:text-slate-600 text-sm">{T.settings.backToSettings}</a>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.subjects.title}</h1>
          </div>
          <form action={handleSeedDefaults}>
            <button type="submit"
              className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
              Standaard onderwerpen laden
            </button>
          </form>
        </div>

        {/* Add form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{T.subjects.add}</h2>
          <form action={handleCreate} className="flex gap-2">
            <input name="name" type="text" required placeholder="Bijv. Geweld, Opium, Diefstal..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="color" type="color" defaultValue="#6366f1" title={T.subjects.color}
              className="w-10 h-9 rounded border border-slate-300 dark:border-slate-600 cursor-pointer" />
            <button type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              {T.common.add}
            </button>
          </form>
        </div>

        {/* Subjects list */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {!subjects?.length ? (
            <p className="text-center text-slate-400 py-8 text-sm">{T.subjects.noSubjects}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{T.common.name}</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">{T.subjects.color}</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">{T.subjects.active}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {subjects.map(subject => (
                  <tr key={subject.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {subject.color && (
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
                        )}
                        <span className="font-medium text-slate-800 dark:text-white">{subject.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {subject.color ? (
                        <span className="text-xs font-mono text-slate-400">{subject.color}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form action={handleToggleActive.bind(null, subject.id, subject.is_active)}>
                        <button type="submit"
                          className={`w-10 h-5 rounded-full transition-colors ${subject.is_active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <span className={`block w-4 h-4 bg-white rounded-full mx-auto transition-transform ${subject.is_active ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={handleDelete.bind(null, subject.id)}>
                        <ConfirmDeleteButton message={T.subjects.delete} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                          {T.common.delete}
                        </ConfirmDeleteButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
    </main>
  )
}
