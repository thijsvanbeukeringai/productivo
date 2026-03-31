export default function Loading() {
  return (
    <main className="h-full overflow-y-auto px-6 py-4 animate-pulse">
      <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
            <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </main>
  )
}
