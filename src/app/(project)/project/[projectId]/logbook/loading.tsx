export default function Loading() {
  return (
    <div className="flex h-full">
      {/* Log feed skeleton */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 mt-1.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
                <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
        {/* New log input skeleton */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        </div>
      </div>
      {/* Teams panel skeleton */}
      <div className="w-64 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 hidden lg:block">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}
