import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { logout } from '@/lib/actions/auth.actions'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { getTranslations, DEFAULT_LANG, type Lang } from '@/lib/i18n/translations'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, email, language').eq('id', user.id).single()

  const userLang = ((profile?.language) || DEFAULT_LANG) as Lang
  const T = getTranslations(userLang)

  return (
    <LanguageProvider initialLang={userLang}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-slate-900 dark:text-white">IMS</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {profile?.full_name || profile?.email}
            </span>
            <ThemeToggle />
            <form action={logout}>
              <button type="submit" className="text-sm text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded">
                {T.auth.logout}
              </button>
            </form>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </LanguageProvider>
  )
}
