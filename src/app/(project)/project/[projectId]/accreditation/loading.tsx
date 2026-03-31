export default function Loading() {
  return (
    <main className="h-full overflow-y-auto px-6 py-4 animate-pulse">
      <div className="h-6 w-36 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-7 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
        ))}
      </div>
    </main>
  )
}
