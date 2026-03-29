import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { getServerLang } from '@/lib/i18n/server'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const lang = await getServerLang()
  return (
    <LanguageProvider initialLang={lang}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        {children}
      </div>
    </LanguageProvider>
  )
}
