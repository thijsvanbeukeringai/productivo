'use client'

import { useState, useRef } from 'react'
import { createLog } from '@/lib/actions/log.actions'
import { enforcementConfig } from '@/lib/utils/priority-colors'
import type { Subject, Area, MemberOption, Team, Position } from '@/types/app.types'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Props {
  projectId: string
  subjects: Subject[]
  areas: Area[]
  members: MemberOption[]
  teams: Team[]
  positions: Position[]
}

type MentionItem = {
  label: string
  type: 'member' | 'subject' | 'area'
  id: string
}

export function LogEntryNew({ projectId, subjects, areas, members, teams, positions }: Props) {
  const T = useTranslations()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taggedIds, setTaggedIds] = useState<string[]>([])
  const [incidentText, setIncidentText] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [enforcementType, setEnforcementType] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Build mention candidates from all three categories
  const allItems: MentionItem[] = [
    ...members.map(m => ({ label: m.display_name, type: 'member' as const, id: m.id })),
    ...subjects.filter(s => s.is_active).map(s => ({ label: s.name, type: 'subject' as const, id: s.id })),
    ...areas.map(a => ({ label: a.name, type: 'area' as const, id: a.id })),
  ]

  const mentionResults = mentionQuery !== null
    ? allItems.filter(i => i.label.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8)
    : []

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setIncidentText(val)
    const cursor = e.target.selectionStart ?? val.length
    const beforeCursor = val.slice(0, cursor)
    const atMatch = beforeCursor.match(/@([\w\s]*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
    } else {
      setMentionQuery(null)
    }
  }

  function selectMention(item: MentionItem) {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart ?? incidentText.length
    const beforeCursor = incidentText.slice(0, cursor)
    const afterCursor = incidentText.slice(cursor)
    const atIndex = beforeCursor.lastIndexOf('@')
    const newText = beforeCursor.slice(0, atIndex) + `@${item.label} ` + afterCursor
    setIncidentText(newText)
    setMentionQuery(null)
    if (item.type === 'member' && !taggedIds.includes(item.id)) {
      setTaggedIds(prev => [...prev, item.id])
    }
    if (item.type === 'subject') {
      setSelectedSubjectId(item.id)
    }
    if (item.type === 'area') {
      setSelectedAreaId(item.id)
    }
    setTimeout(() => textarea.focus(), 0)
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    formData.set('incident_text', incidentText)
    formData.set('tagged_user_ids', taggedIds.join(','))
    const result = await createLog(formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      formRef.current?.reset()
      setTaggedIds([])
      setIncidentText('')
      setMentionQuery(null)
      setEnforcementType('')
      setSelectedSubjectId('')
      setSelectedAreaId('')
    }
  }

  const typeLabel: Record<MentionItem['type'], string> = {
    member: 'Collega',
    subject: T.logbook.subject,
    area: T.logbook.area,
  }

  const typeBadgeClass: Record<MentionItem['type'], string> = {
    member: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
    subject: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300',
    area: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300',
  }

  const selectClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-0">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nieuwe melding</h2>
      </div>

      <form ref={formRef} action={handleSubmit} className="p-4 space-y-3">
        <input type="hidden" name="project_id" value={projectId} />

        {/* Textarea with @mention */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            name="incident_text"
            required
            rows={4}
            value={incidentText}
            onChange={handleTextChange}
            placeholder="Melding invoeren — typ @ om te taggen"
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          {/* Mention dropdown */}
          {mentionQuery !== null && mentionResults.length > 0 && (
            <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xl z-20 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Taggen</p>
              </div>
              {mentionResults.map((item, i) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectMention(item) }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200">@{item.label}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeBadgeClass[item.type]}`}>
                    {typeLabel[item.type]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selects grid: 2 columns */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{T.logbook.priority}</label>
            <select name="priority" defaultValue="low" className={selectClass}>
              <option value="info">{T.logbook.priority_info}</option>
              <option value="low">{T.logbook.priority_low}</option>
              <option value="mid">{T.logbook.priority_mid}</option>
              <option value="high">{T.logbook.priority_high}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">{T.logbook.subject}</label>
            <select name="subject_id" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} className={selectClass}>
              <option value="">— Geen —</option>
              {subjects.filter(s => s.is_active).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">{T.logbook.position}</label>
            <select name="position_id" className={selectClass}>
              <option value="">— Geen —</option>
              {positions.map(p => (
                <option key={p.id} value={p.id}>
                  Pos. {p.number}{p.name ? ` — ${p.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">{T.logbook.area}</label>
            <select name="area_id" value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)} className={selectClass}>
              <option value="">— Geen —</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-slate-400 mb-1">{T.logbook.assignTo}</label>
            <select name="assigned_user_id" className={selectClass}>
              <option value="">— Niemand —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-slate-400 mb-1">{T.logbook.enforcement}</label>
            <select
              name="enforcement_type"
              value={enforcementType}
              onChange={e => setEnforcementType(e.target.value)}
              className={selectClass}
            >
              <option value="">— Geen —</option>
              {Object.entries(enforcementConfig).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {(enforcementType === 'ejection' || enforcementType === 'arrest') && (
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                Reden {enforcementType === 'ejection' ? 'uitzetting' : 'aanhouding'}
              </label>
              <input
                type="text"
                name="enforcement_reason"
                placeholder="Vul de reden in..."
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        {error &&<p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 text-sm bg-slate-800 hover:bg-slate-700 dark:bg-slate-600 dark:hover:bg-slate-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Loggen...' : 'Loggen'}
        </button>
      </form>
    </div>
  )
}
