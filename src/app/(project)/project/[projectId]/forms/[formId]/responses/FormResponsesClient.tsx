'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFormResponse } from '@/lib/actions/form.actions'

interface Field { id: string; type: string; label: string; sort_order: number }
interface Response {
  id: string
  data: Record<string, unknown>
  submitted_at: string
  crew_members: { first_name: string; last_name: string } | null
}

interface Props {
  formId: string
  fields: Field[]
  initialResponses: Response[]
  noResponsesLabel: string
  submittedOnLabel: string
  responseCountLabel: string
  responsesLabel: string
}

export function FormResponsesClient({ formId, fields, initialResponses, noResponsesLabel, submittedOnLabel, responseCountLabel, responsesLabel }: Props) {
  const [responses, setResponses] = useState<Response[]>(initialResponses)

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`form-responses-${formId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'form_responses',
        filter: `form_id=eq.${formId}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const full = await getFormResponse(payload.new.id)
          if (!full) return
          if (payload.eventType === 'INSERT') {
            setResponses(prev => [full, ...prev])
          } else {
            setResponses(prev => prev.map(r => r.id === full.id ? full : r))
          }
        } else if (payload.eventType === 'DELETE') {
          setResponses(prev => prev.filter(r => r.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [formId])

  if (responses.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-8 py-14 text-center">
        <p className="text-sm text-slate-400">{noResponsesLabel}</p>
      </div>
    )
  }

  return (
    <>
      <p className="text-sm font-normal text-slate-400 mb-4">{responses.length} {responseCountLabel}</p>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Crewlid</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{submittedOnLabel}</th>
              {fields.map(f => (
                <th key={f.id} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider max-w-[180px] truncate">
                  {f.label || f.type}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {responses.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-white whitespace-nowrap">
                  {r.crew_members ? `${r.crew_members.first_name} ${r.crew_members.last_name}` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                  {new Date(r.submitted_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                {fields.map(f => {
                  const val = r.data?.[f.id]
                  return (
                    <td key={f.id} className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[200px]">
                      {val === null || val === undefined
                        ? <span className="text-slate-300 dark:text-slate-600">—</span>
                        : typeof val === 'boolean' ? (val ? '✓' : '✗')
                        : String(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
