import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember } from '@/lib/supabase/session'
import { createArea, updateAreaStatus, deleteArea } from '@/lib/actions/settings.actions'
import { areaStatusConfig } from '@/lib/utils/priority-colors'
import type { AreaStatus } from '@/types/app.types'
import { cn } from '@/lib/utils/cn'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'
import { getServerTranslations } from '@/lib/i18n/server'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function AreasPage({ params }: PageProps) {
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

  const { data: areas } = await supabase
    .from('areas').select('*').eq('project_id', projectId).order('sort_order').order('name')

  async function handleCreate(formData: FormData) {
    'use server'
    formData.set('project_id', projectId)
    await createArea(formData)
  }

  async function handleStatusChange(areaId: string, status: AreaStatus) {
    'use server'
    await updateAreaStatus(areaId, projectId, status)
  }

  async function handleDelete(areaId: string) {
    'use server'
    await deleteArea(areaId, projectId)
  }

  const statusOptions: AreaStatus[] = ['open', 'regulated', 'closed']

  return (
    <main className="h-full overflow-y-auto px-4 py-4 max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href={`/project/${projectId}/settings`} className="text-slate-400 hover:text-slate-600 text-sm">{T.settings.backToSettings}</a>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.areasSettings.title}</h1>
        </div>

        {/* Add form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <form action={handleCreate} className="flex gap-2">
            <input name="name" type="text" required placeholder="Bijv. Hoofdpodium, Ingang Noord..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              {T.areasSettings.add}
            </button>
          </form>
        </div>

        {/* Areas list */}
        <div className="space-y-2">
          {!areas?.length ? (
            <div className="text-center py-8 text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              {T.areasSettings.noAreas}
            </div>
          ) : (
            areas.map(area => {
              const cfg = areaStatusConfig[area.status as keyof typeof areaStatusConfig]
              return (
                <div key={area.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white">{area.name}</p>
                  </div>

                  {/* Status buttons */}
                  <div className="flex gap-1">
                    {statusOptions.map(status => {
                      const sCfg = areaStatusConfig[status]
                      return (
                        <form key={status} action={handleStatusChange.bind(null, area.id, status)}>
                          <button type="submit"
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-full transition-colors border',
                              area.status === status
                                ? `${sCfg.bg} ${sCfg.text} border-transparent`
                                : 'bg-white dark:bg-slate-700 text-slate-500 border-slate-300 dark:border-slate-600 hover:border-slate-400'
                            )}>
                            {sCfg.label}
                          </button>
                        </form>
                      )
                    })}
                  </div>

                  <form action={handleDelete.bind(null, area.id)}>
                    <ConfirmDeleteButton message={T.areasSettings.delete} className="text-xs text-red-400 hover:text-red-600 ml-2">
                      ✕
                    </ConfirmDeleteButton>
                  </form>
                </div>
              )
            })
          )}
        </div>
    </main>
  )
}
