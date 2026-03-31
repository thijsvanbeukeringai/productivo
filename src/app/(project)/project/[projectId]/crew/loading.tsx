export default function Loading() {
  return (
    <main className="h-full overflow-y-auto px-6 py-4 animate-pulse">
      <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
