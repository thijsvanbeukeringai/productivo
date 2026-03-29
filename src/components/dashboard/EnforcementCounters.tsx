import { enforcementConfig } from '@/lib/utils/priority-colors'
import type { EnforcementCounters } from '@/types/app.types'
import { cn } from '@/lib/utils/cn'

interface Props {
  counters: EnforcementCounters[]
  shiftLabel: string
}

export function EnforcementCounterCards({ counters, shiftLabel }: Props) {
  // Aggregate totals across all subjects
  const totals = counters.reduce(
    (acc, c) => ({
      ejections: acc.ejections + c.ejections,
      arrests:   acc.arrests   + c.arrests,
      refusals:  acc.refusals  + c.refusals,
      bans:      acc.bans      + c.bans,
    }),
    { ejections: 0, arrests: 0, refusals: 0, bans: 0 }
  )

  const cards = [
    { key: 'ejections' as const, type: 'ejection', count: totals.ejections },
    { key: 'arrests'   as const, type: 'arrest',   count: totals.arrests },
    { key: 'refusals'  as const, type: 'refusal',  count: totals.refusals },
    { key: 'bans'      as const, type: 'ban',       count: totals.bans },
  ]

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Handhaving overzicht</h2>
        <span className="text-xs text-slate-400">Shift: {shiftLabel}</span>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        {cards.map(card => {
          const cfg = enforcementConfig[card.type as keyof typeof enforcementConfig]
          return (
            <div
              key={card.key}
              className={cn(
                'rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700 flex items-center justify-between',
                cfg.bg
              )}
            >
              <p className={cn('text-xs font-medium uppercase tracking-wide', cfg.color)}>{cfg.label}</p>
              <p className={cn('text-2xl font-bold', cfg.color)}>{card.count}</p>
            </div>
          )
        })}
      </div>

      {/* Per-subject breakdown */}
      {counters.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Per onderwerp</h3>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Onderwerp</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-orange-600">Uitzetting</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-red-600">Aanhouding</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-purple-600">Weigering</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Ontzegging</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {counters
                  .filter(c => c.ejections + c.arrests + c.refusals + c.bans > 0)
                  .sort((a, b) => (b.ejections + b.arrests + b.refusals + b.bans) - (a.ejections + a.arrests + a.refusals + a.bans))
                  .map(counter => {
                    const total = counter.ejections + counter.arrests + counter.refusals + counter.bans
                    return (
                      <tr key={counter.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                          {counter.subject?.name || 'Geen onderwerp'}
                        </td>
                        <td className="text-center px-3 py-2 font-mono text-orange-600">{counter.ejections || '—'}</td>
                        <td className="text-center px-3 py-2 font-mono text-red-600">{counter.arrests || '—'}</td>
                        <td className="text-center px-3 py-2 font-mono text-purple-600">{counter.refusals || '—'}</td>
                        <td className="text-center px-3 py-2 font-mono text-gray-600">{counter.bans || '—'}</td>
                        <td className="text-center px-3 py-2 font-bold text-slate-700 dark:text-slate-300">{total}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
