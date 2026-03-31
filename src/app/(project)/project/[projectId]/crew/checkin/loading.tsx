export default function Loading() {
  return (
    <main className="h-full overflow-y-auto px-6 py-4 animate-pulse">
      <div className="max-w-4xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl mb-5" />
        <div className="flex gap-2 mb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          ))}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
