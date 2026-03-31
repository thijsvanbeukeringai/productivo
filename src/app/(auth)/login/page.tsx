import { login } from '@/lib/actions/auth.actions'
import { getServerTranslations } from '@/lib/i18n/server'
import { LoginForm } from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const T = await getServerTranslations()
  const { error } = await searchParams

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">IMS</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{T.auth.ims}</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error.includes('Invalid login') || error.includes('invalid_credentials')
              ? 'Ongeldig e-mailadres of wachtwoord.'
              : error}
          </div>
        )}

        <LoginForm loginAction={login} labels={{ email: T.auth.email, password: T.auth.password, login: T.auth.login, emailPlaceholder: T.auth.emailPlaceholder }} />

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          {T.auth.noAccount}
        </p>
      </div>
    </div>
  )
}
