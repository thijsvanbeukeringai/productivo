import { createClient } from '@/lib/supabase/server'
import { acceptInvite } from '@/lib/actions/auth.actions'
import { notFound } from 'next/navigation'
import { getServerTranslations } from '@/lib/i18n/server'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const T = await getServerTranslations()

  const { data: invitation } = await supabase
    .from('invitations')
    .select('*, companies(name)')
    .eq('token', token)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())
    .single()

  if (!invitation) notFound()

  const companyName = (invitation.companies as { name: string })?.name || T.common.unknown

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-600 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.auth.invite.title}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {T.auth.invite.invitedFor} <strong>{companyName}</strong>
          </p>
        </div>

        <form action={acceptInvite} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="email" value={invitation.email} />

          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm text-slate-600 dark:text-slate-300">
            {T.auth.invite.invitationFor} <strong>{invitation.email}</strong>
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {T.auth.invite.fullName}
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              placeholder={T.auth.invite.fullNamePlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {T.auth.invite.setPassword}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder={T.auth.invite.minChars}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {T.auth.invite.createAccount}
          </button>
        </form>
      </div>
    </div>
  )
}
