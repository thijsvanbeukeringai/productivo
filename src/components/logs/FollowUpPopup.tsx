'use client'

import { useState, useRef } from 'react'
import { addFollowup } from '@/lib/actions/log.actions'
import { formatTimestamp } from '@/lib/utils/format-timestamp'
import type { LogFollowup, MemberOption } from '@/types/app.types'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Props {
  logId: string
  onClose: () => void
  initialContent?: string
  allFollowups?: LogFollowup[]
  members?: MemberOption[]
}

export function FollowUpPopup({ logId, onClose, initialContent = '', allFollowups = [], members = [] }: Props) {
  const T = useTranslations()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localFollowups, setLocalFollowups] = useState<LogFollowup[]>(allFollowups)
  const [content, setContent] = useState(initialContent)
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isAdvies = initialContent.startsWith('Advies')

  const filteredMembers = mentionQuery !== null
    ? members.filter(m => m.display_name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : []

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)
    const cursor = e.target.selectionStart ?? val.length
    const beforeCursor = val.slice(0, cursor)
    const atMatch = beforeCursor.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
    } else {
      setMentionQuery(null)
    }
  }

  function selectMention(member: MemberOption) {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart ?? content.length
    const beforeCursor = content.slice(0, cursor)
    const afterCursor = content.slice(cursor)
    const atIndex = beforeCursor.lastIndexOf('@')
    const newContent = beforeCursor.slice(0, atIndex) + `@${member.display_name} ` + afterCursor
    setContent(newContent)
    setMentionedIds(prev => [...new Set([...prev, member.id])])
    setMentionQuery(null)
    setTimeout(() => textarea.focus(), 0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.set('log_id', logId)
    formData.set('content', content.trim())
    if (mentionedIds.length > 0) {
      formData.set('mentioned_user_ids', mentionedIds.join(','))
    }

    const result = await addFollowup(formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      if (result.data) {
        setLocalFollowups(prev => [...prev, result.data as LogFollowup])
      }
      window.dispatchEvent(new CustomEvent('log-mutated', { detail: { logId } }))
      setContent('')
      setMentionedIds([])
      setMentionQuery(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            {isAdvies ? T.logbook.adviesTitle : T.logbook.followupTitle}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Follow-up history */}
        {localFollowups.length > 0 && (
          <div className="overflow-y-auto px-4 py-3 space-y-2 border-b border-slate-100 dark:border-slate-700">
            {localFollowups.map(fu => (
              <div key={fu.id} className="flex items-baseline gap-2 text-sm">
                <span className="font-mono text-xs text-slate-400 shrink-0 tabular-nums">
                  {formatTimestamp(fu.created_at)}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                  {fu.display_name_snapshot}:
                </span>
                <span className="text-slate-800 dark:text-slate-200">{fu.content}</span>
              </div>
            ))}
          </div>
        )}

        {/* New follow-up form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 shrink-0">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              rows={3}
              required
              placeholder={isAdvies ? T.logbook.adviesPlaceholder : T.logbook.newFollowupPlaceholder}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              autoFocus
            />

            {/* @mention dropdown */}
            {mentionQuery !== null && filteredMembers.length > 0 && (
              <div className="absolute left-0 bottom-full mb-1 w-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg z-10 overflow-hidden">
                {filteredMembers.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectMention(m) }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    @{m.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {mentionedIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mentionedIds.map(id => {
                const m = members.find(x => x.id === id)
                return m ? (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                    @{m.display_name}
                  </span>
                ) : null
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              {T.common.close}
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
              {loading ? T.common.saving : T.common.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
