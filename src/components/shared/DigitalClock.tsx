'use client'

import { useClock } from '@/lib/hooks/useClock'

export function DigitalClock() {
  const time = useClock()
  return (
    <span className="font-digital text-2xl font-bold tabular-nums tracking-widest text-slate-900 dark:text-white">
      {time || '00:00:00'}
    </span>
  )
}
