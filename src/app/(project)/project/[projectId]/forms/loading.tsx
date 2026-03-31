export default function Loading() {
  return (
    <main className="h-full overflow-y-auto px-6 py-4 animate-pulse">
      <div className="max-w-3xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4">
              <div className="h-4 w-44 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
              <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
