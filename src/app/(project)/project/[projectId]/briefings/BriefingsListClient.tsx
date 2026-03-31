'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Assignment { crew_company_id: string; crew_companies: { name: string } | null }
interface Briefing {
  id: string
  title: string
  content: unknown
  updated_at: string
  briefing_assignments: Assignment[]
}

interface Props {
  projectId: string
  initialBriefings: Briefing[]
  lastUpdatedLabel: string
  noBriefingsLabel: string
  noBriefingsDescLabel: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BriefingsListClient({ projectId, initialBriefings, lastUpdatedLabel, noBriefingsLabel, noBriefingsDescLabel }: Props) {
  const [briefings, setBriefings] = useState<Briefing[]>(initialBriefings)

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`briefings-list-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'briefings',
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const b = payload.new as Briefing
          setBriefings(prev => [{ ...b, briefing_assignments: [] }, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setBriefings(prev => prev.map(b =>
            b.id === payload.new.id ? { ...b, title: payload.new.title, content: payload.new.content, updated_at: payload.new.updated_at } : b
          ))
        } else if (payload.eventType === 'DELETE') {
          setBriefings(prev => prev.filter(b => b.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  if (briefings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-8 py-14 text-center">
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{noBriefingsLabel}</p>
        <p className="text-xs text-slate-400">{noBriefingsDescLabel}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {briefings.map(b => {
        const blockCount = Array.isArray(b.content) ? (b.content as unknown[]).length : 0
        const assignments = b.briefing_assignments || []
        return (
          <Link
            key={b.id}
            href={`/project/${projectId}/briefings/${b.id}`}
            className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {b.title}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {blockCount} {blockCount === 1 ? 'blok' : 'blokken'}
                  {' · '}
                  {lastUpdatedLabel} {formatDate(b.updated_at)}
                </p>
              </div>
              {assignments.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[200px]">
                  {assignments.map(a => (
                    <span
                      key={a.crew_company_id}
                      className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800"
                    >
                      {a.crew_companies?.name ?? '—'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
