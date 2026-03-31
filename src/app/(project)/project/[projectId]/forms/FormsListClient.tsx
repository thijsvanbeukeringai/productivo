'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Assignment { crew_company_id: string; crew_companies: { name: string } | null }
interface Form {
  id: string
  title: string
  description: string | null
  updated_at: string
  form_fields: { id: string }[]
  form_assignments: Assignment[]
  form_responses: { id: string }[]
}

interface Props {
  projectId: string
  initialForms: Form[]
  responseCountLabel: string
  noFormsLabel: string
  noFormsDescLabel: string
}

export function FormsListClient({ projectId, initialForms, responseCountLabel, noFormsLabel, noFormsDescLabel }: Props) {
  const [forms, setForms] = useState<Form[]>(initialForms)

  useEffect(() => {
    const supabase = createClient()
    // Subscribe to form changes
    const formsCh = supabase.channel(`forms-list-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'forms',
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const f = payload.new as Form
          setForms(prev => [{ ...f, form_fields: [], form_assignments: [], form_responses: [] }, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setForms(prev => prev.map(f =>
            f.id === payload.new.id ? { ...f, title: payload.new.title, description: payload.new.description, updated_at: payload.new.updated_at } : f
          ))
        } else if (payload.eventType === 'DELETE') {
          setForms(prev => prev.filter(f => f.id !== payload.old.id))
        }
      })
      // Also subscribe to new responses so count updates live
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'form_responses',
      }, (payload) => {
        setForms(prev => prev.map(f =>
          f.id === payload.new.form_id
            ? { ...f, form_responses: [...f.form_responses, { id: payload.new.id }] }
            : f
        ))
      })
      .subscribe()
    return () => { supabase.removeChannel(formsCh) }
  }, [projectId])

  if (forms.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-8 py-14 text-center">
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{noFormsLabel}</p>
        <p className="text-xs text-slate-400">{noFormsDescLabel}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {forms.map(f => {
        const fieldCount = f.form_fields?.length ?? 0
        const assignments = f.form_assignments ?? []
        const responseCount = f.form_responses?.length ?? 0
        return (
          <Link key={f.id} href={`/project/${projectId}/forms/${f.id}`}
            className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{f.title}</h2>
                {f.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{f.description}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  {fieldCount} {fieldCount === 1 ? 'veld' : 'velden'}
                  {responseCount > 0 && <> · <span className="text-green-600 dark:text-green-400 font-medium">{responseCount} {responseCountLabel}</span></>}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[200px]">
                {assignments.map(a => (
                  <span key={a.crew_company_id} className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800">
                    {a.crew_companies?.name ?? '—'}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
