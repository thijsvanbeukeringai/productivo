import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember } from '@/lib/supabase/session'
import { inviteUser } from '@/lib/actions/project.actions'
import { roleLabels } from '@/lib/utils/priority-colors'
import type { UserRole } from '@/types/app.types'
import { getServerTranslations } from '@/lib/i18n/server'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function MembersPage({ params }: PageProps) {
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

  const canAdmin = ['super_admin', 'company_admin'].includes(member.role)
  if (!canAdmin) redirect(`/project/${projectId}/settings`)

  const { data: members } = await supabase
    .from('project_members')
    .select('*, profiles(*)')
    .eq('project_id', projectId)
    .order('created_at')

  async function handleInvite(formData: FormData) {
    'use server'
    formData.set('company_id', project.company_id)
    formData.set('project_id', projectId)
    await inviteUser(formData)
  }

  const roles: UserRole[] = ['company_admin', 'centralist', 'planner', 'runner']

  return (
    <main className="h-full overflow-y-auto px-4 py-4 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href={`/project/${projectId}/settings`} className="text-slate-400 hover:text-slate-600 text-sm">{T.settings.backToSettings}</a>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.members.title}</h1>
        </div>

        {/* Invite form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{T.members.invite}</h2>
          <form action={handleInvite} className="flex gap-2">
            <input name="email" type="email" required placeholder="naam@bedrijf.nl"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select name="role"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {roles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
            </select>
            <button type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              {T.members.invite}
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-2">
            Als de gebruiker al bestaat wordt hij direct toegevoegd. Anders ontvangt hij een uitnodigingsmail.
          </p>
        </div>

        {/* Members table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{T.common.name}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{T.common.email}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{T.members.role}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{T.profile.screenName}</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Standby</th>
              </tr>
            </thead>
            <tbody>
              {members?.map(member => {
                const profile = member.profiles as { full_name: string | null; email: string } | null
                return (
                  <tr key={member.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                      {profile?.full_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{profile?.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                        {roleLabels[member.role] || member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm">
                      {member.custom_display_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {member.standby_teams ? '✓' : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
    </main>
  )
}
