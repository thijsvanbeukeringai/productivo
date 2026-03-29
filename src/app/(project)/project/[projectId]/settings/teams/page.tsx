import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember } from '@/lib/supabase/session'
import { createTeam, updateTeam, deleteTeam } from '@/lib/actions/settings.actions'
import { cn } from '@/lib/utils/cn'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'
import { getServerTranslations } from '@/lib/i18n/server'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function TeamsPage({ params }: PageProps) {
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

  const { data: teams } = await supabase
    .from('teams').select('*, area:areas(*)').eq('project_id', projectId).order('number')

  const { data: areas } = await supabase
    .from('areas').select('*').eq('project_id', projectId).order('name')

  async function handleCreate(formData: FormData) {
    'use server'
    formData.set('project_id', projectId)
    await createTeam(formData)
  }

  async function handleToggleActive(teamId: string, current: boolean) {
    'use server'
    await updateTeam(teamId, projectId, { is_active: !current })
  }

  async function handleToggleStandby(teamId: string, current: boolean) {
    'use server'
    await updateTeam(teamId, projectId, { is_standby: !current })
  }

  async function handleDelete(teamId: string) {
    'use server'
    await deleteTeam(teamId, projectId)
  }

  return (
    <main className="h-full overflow-y-auto px-4 py-4 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href={`/project/${projectId}/settings`} className="text-slate-400 hover:text-slate-600 text-sm">{T.settings.backToSettings}</a>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.teams.title}</h1>
        </div>

        {/* Add form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{T.teams.add}</h2>
          <form action={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{T.teams.memberNames}</label>
              <textarea name="member_names" rows={3} placeholder="Jan de Vries&#10;Piet Jansen"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{T.teams.area}</label>
                <select name="area_id"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Geen —</option>
                  {areas?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="is_active" value="true" defaultChecked
                    className="rounded" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{T.teams.active}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="is_standby" value="true"
                    className="rounded" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{T.teams.standby}</span>
                </label>
              </div>
              <button type="submit"
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                {T.teams.add}
              </button>
            </div>
          </form>
        </div>

        {/* Teams list */}
        <div className="space-y-2">
          {!teams?.length ? (
            <div className="text-center py-8 text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              {T.teams.noTeams}
            </div>
          ) : teams.map(team => (
            <div key={team.id}
              className={cn(
                'bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-start gap-4',
                team.is_active
                  ? 'border-slate-200 dark:border-slate-700'
                  : 'border-slate-100 dark:border-slate-700 opacity-60'
              )}>
              <div className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg shrink-0">
                <span className="font-bold text-slate-700 dark:text-slate-300">T{team.number}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {team.area && (
                    <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                      📍 {team.area.name}
                    </span>
                  )}
                  {team.is_standby && (
                    <span className="text-xs px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded">
                      ⏸ {T.teams.standby}
                    </span>
                  )}
                </div>
                {team.member_names.length > 0 && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {team.member_names.join(', ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <form action={handleToggleActive.bind(null, team.id, team.is_active)}>
                  <button type="submit"
                    className={cn(
                      'text-xs px-2 py-1 rounded font-medium transition-colors',
                      team.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    )}>
                    {team.is_active ? T.teams.active : T.common.no}
                  </button>
                </form>
                <form action={handleToggleStandby.bind(null, team.id, team.is_standby)}>
                  <button type="submit"
                    className={cn(
                      'text-xs px-2 py-1 rounded font-medium transition-colors',
                      team.is_standby
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    )}>
                    {team.is_standby ? T.teams.standby : '→ ' + T.teams.standby}
                  </button>
                </form>
                <form action={handleDelete.bind(null, team.id)}>
                  <ConfirmDeleteButton message={`Team ${team.number} ${T.teams.delete}`} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">
                    ✕
                  </ConfirmDeleteButton>
                </form>
              </div>
            </div>
          ))}
        </div>
    </main>
  )
}
