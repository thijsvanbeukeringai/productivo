export default function Loading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Tab bar */}
      <div className="flex gap-2 px-4 pt-3 pb-0 border-b border-slate-200 dark:border-slate-700">
        {['GPS', 'Live', 'Editor'].map(t => (
          <div key={t} className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-t-lg" />
        ))}
      </div>
      {/* Map area */}
      <div className="flex-1 bg-slate-100 dark:bg-slate-800" />
    </div>
  )
}
