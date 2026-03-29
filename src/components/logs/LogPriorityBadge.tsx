import { priorityConfig } from '@/lib/utils/priority-colors'
import type { LogPriority } from '@/types/app.types'
import { cn } from '@/lib/utils/cn'

export function LogPriorityBadge({ priority }: { priority: LogPriority }) {
  const cfg = priorityConfig[priority]
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
      cfg.bg, cfg.text
    )}>
      {cfg.label}
    </span>
  )
}
