'use client'

import { useTransition } from 'react'
import { updateAreaStatus } from '@/lib/actions/settings.actions'
import { cn } from '@/lib/utils/cn'
import type { Area, AreaStatus } from '@/types/app.types'

const statusConfig: Record<AreaStatus, { label: string; bg: string; activeBorder: string }> = {
  open:      { label: 'Open',      bg: 'bg-green-600',  activeBorder: 'border-green-200 dark:border-green-900/50' },
  regulated: { label: 'Reguleren', bg: 'bg-orange-500', activeBorder: 'border-orange-200 dark:border-orange-900/50' },
  closed:    { label: 'Gesloten',  bg: 'bg-red-600',    activeBorder: 'border-red-200 dark:border-red-900/50' },
}

const statusOrder: AreaStatus[] = ['open', 'regulated', 'closed']

interface Props {
  area: Area
  projectId: string
  readonly?: boolean
  count?: number
  countDanger?: boolean
}

export function AreaCard({ area, projectId, readonly = false, count, countDanger = false }: Props) {
  const [, startTransition] = useTransition()
  const current = statusConfig[area.status]

  function handleStatus(status: AreaStatus) {
    if (status === area.status) return
    startTransition(async () => { await updateAreaStatus(area.id, projectId, status) })
  }

  return (
    <div className={cn(
      'bg-white dark:bg-slate-800 rounded-xl border-2 p-4',
      current.activeBorder,
    )}>
      <div className={cn('flex items-center justify-between', !readonly && 'mb-3')}>
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">{area.name}</h3>
          {count !== undefined && count > 0 && (
            <span className={cn(
              'shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-full',
              countDanger
                ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            )}>
              {count}
            </span>
          )}
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full text-white shrink-0 ml-2', current.bg)}>
          {current.label}
        </span>
      </div>

      {!readonly && (
        <div className="flex gap-2">
          {statusOrder.map((status) => {
            const cfg = statusConfig[status]
            const isActive = area.status === status
            return (
              <button
                key={status}
                onClick={() => handleStatus(status)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                  isActive
                    ? cn(cfg.bg, 'text-white border-transparent')
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                )}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
