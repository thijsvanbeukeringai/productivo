export default function Loading() {
  return (
    <main className="h-full overflow-y-auto px-6 py-4 w-full animate-pulse">
      {/* Stats row */}
      <div className="flex gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-8 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
      {/* Map/areas skeleton */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-6" style={{ height: 576 }}>
        <div className="h-full bg-slate-100 dark:bg-slate-700 rounded-xl" />
      </div>
      {/* Bottom 4-col grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-3 bg-slate-200 dark:bg-slate-700 rounded" />
            ))}
          </div>
        ))}
      </div>
    </main>
  )
}
