import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember } from '@/lib/supabase/session'
import { createPosition, updatePositionStatus } from '@/lib/actions/settings.actions'
import type { PositionStatus } from '@/types/app.types'
import { cn } from '@/lib/utils/cn'
import { getServerTranslations } from '@/lib/i18n/server'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function PositionsPage({ params }: PageProps) {
  const { projectId } = await params
  const T = await getServerTranslations()
  const supabase = await createClient()

  const positionStatusConfig = {
    normal: { label: T.positions.status_normal, bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', dot: '' },
    portocheck_done: { label: T.positions.status_portocheck, bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
    sanitary_break: { label: T.positions.status_sanitary, bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) notFound()

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')

  const { data: positions } = await supabase
    .from('positions').select('*, area:areas(*)').eq('project_id', projectId).order('number')

  const { data: areas } = await supabase
    .from('areas').select('*').eq('project_id', projectId).order('name')

  async function handleCreate(formData: FormData) {
    'use server'
    formData.set('project_id', projectId)
    await createPosition(formData)
  }

  async function handleStatusUpdate(positionId: string, status: PositionStatus) {
    'use server'
    await updatePositionStatus(positionId, projectId, status)
  }

  return (
    <main className="h-full overflow-y-auto px-4 py-4 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href={`/project/${projectId}/settings`} className="text-slate-400 hover:text-slate-600 text-sm">{T.settings.backToSettings}</a>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.positions.title}</h1>
        </div>

        {/* Add form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <form action={handleCreate} className="flex gap-2">
            <input name="name" type="text" placeholder="Naam (optioneel)"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select name="area_id"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Geen gebied —</option>
              {areas?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              {T.positions.add}
            </button>
          </form>
        </div>

        {/* Positions grid */}
        {!positions?.length ? (
          <div className="text-center py-8 text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            {T.positions.noPositions}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {positions.map(pos => {
              const cfg = positionStatusConfig[pos.status as keyof typeof positionStatusConfig]
              return (
                <div key={pos.id}
                  className={cn(
                    'rounded-xl border p-3 cursor-pointer transition-all',
                    cfg.bg,
                    pos.status === 'normal' ? 'border-slate-200 dark:border-slate-700' : 'border-transparent'
                  )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('font-bold text-lg', cfg.text)}>P{pos.number}</span>
                    {cfg.dot && (
                      <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                    )}
                  </div>

                  {pos.name && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 truncate">{pos.name}</p>
                  )}
                  {pos.area && (
                    <p className="text-xs text-slate-400 mb-2 truncate">📍 {pos.area.name}</p>
                  )}

                  <p className={cn('text-xs font-medium', cfg.text)}>{cfg.label}</p>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1 mt-2">
                    <form action={handleStatusUpdate.bind(null, pos.id, 'portocheck_done')}>
                      <button type="submit"
                        className="w-full text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors">
                        ✓ {T.positions.portocheck}
                      </button>
                    </form>
                    <form action={handleStatusUpdate.bind(null, pos.id, 'sanitary_break')}>
                      <button type="submit"
                        className="w-full text-xs px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors">
                        🚻 {T.positions.sanitaryBreak}
                      </button>
                    </form>
                    {pos.status !== 'normal' && (
                      <form action={handleStatusUpdate.bind(null, pos.id, 'normal')}>
                        <button type="submit"
                          className="w-full text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded transition-colors">
                          {T.positions.reset}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </main>
  )
}
