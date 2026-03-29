import { getServerTranslations } from '@/lib/i18n/server'

export default async function GuestlistPage() {
  const T = await getServerTranslations()
  return (
    <main className="h-full overflow-y-auto p-8 flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-4">👥</p>
        <h1 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-2">{T.guestlist.title}</h1>
        <p className="text-sm text-slate-400">{T.notAvailable}</p>
      </div>
    </main>
  )
}
