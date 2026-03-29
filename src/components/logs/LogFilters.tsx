'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import type { Subject } from '@/types/app.types'
import { cn } from '@/lib/utils/cn'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Props {
  subjects: Subject[]
}

export function LogFilters({ subjects }: Props) {
  const T = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateFilter = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const toggleFilter = (key: string) => {
    const current = searchParams.get(key)
    updateFilter(key, current ? null : '1')
  }

  const isActive = (key: string) => searchParams.get(key) === '1'
  const activeSubject = searchParams.get('subject')

  const filterBtn = (key: string, label: string) => (
    <button
      onClick={() => toggleFilter(key)}
      className={cn(
        'px-3 py-1 text-xs rounded-full border transition-colors font-medium',
        isActive(key)
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400'
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center gap-2 flex-wrap py-2 px-1">
      <span className="text-xs text-slate-400 font-medium">Filter:</span>
      {filterBtn('my_logs', T.logbook.filter_mine)}
      {filterBtn('assigned', T.logbook.filter_assigned)}
      {filterBtn('info', T.logbook.filter_info)}
      {filterBtn('photos', T.logbook.filter_photos)}
      {filterBtn('open', T.logbook.filter_open)}

      {/* Subject filter */}
      {subjects.length > 0 && (
        <select
          value={activeSubject || ''}
          onChange={e => updateFilter('subject', e.target.value || null)}
          className="px-3 py-1 text-xs rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{T.logbook.filter_all}</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      {/* Clear filters */}
      {searchParams.toString() && (
        <button
          onClick={() => router.push(pathname)}
          className="px-3 py-1 text-xs text-red-500 hover:text-red-700 transition-colors"
        >
          Wis filters
        </button>
      )}
    </div>
  )
}
