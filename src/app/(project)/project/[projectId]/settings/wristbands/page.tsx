export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createWristband, deleteWristband } from '@/lib/actions/crew.actions'
import { getServerTranslations } from '@/lib/i18n/server'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function WristbandsPage({ params }: PageProps) {
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
  if (!canAdmin) redirect(`/project/${projectId}/settings`)

  const admin = createAdminClient()
  const { data: wristbands } = await admin
    .from('wristbands')
    .select('id, name, color, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  async function handleAdd(formData: FormData) {
    'use server'
    const name = (formData.get('name') as string)?.trim()
    const color = (formData.get('color') as string) || '#3b82f6'
    if (name) await createWristband(projectId, name, color)
  }

  async function handleDelete(formData: FormData) {
    'use server'
    const id = formData.get('id') as string
    if (id) await deleteWristband(projectId, id)
  }

  return (
    <main className="h-full overflow-y-auto px-4 py-4 max-w-2xl w-full mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/project/${projectId}/settings`}
          className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          ← {T.settings.title}
        </Link>
      </div>

      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
        {T.settings.wristbands}
      </h1>

      {/* Add form */}
      <form action={handleAdd} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {T.common.name}
            </label>
            <input
              name="name"
              required
              placeholder="VIP"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Kleur
            </label>
            <input
              type="color"
              name="color"
              defaultValue="#3b82f6"
              className="h-9 w-14 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-700"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {T.common.add}
          </button>
        </div>
      </form>

      {/* Wristbands list */}
      {(!wristbands || wristbands.length === 0) ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">{T.settings.wristbandsDesc}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {wristbands.map(wb => (
            <div key={wb.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className="w-5 h-5 rounded-full shrink-0 border border-black/10"
                style={{ backgroundColor: wb.color }}
              />
              <span className="flex-1 text-sm font-medium text-slate-800 dark:text-white">{wb.name}</span>
              <form action={handleDelete}>
                <input type="hidden" name="id" value={wb.id} />
                <button
                  type="submit"
                  className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  {T.common.delete}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
