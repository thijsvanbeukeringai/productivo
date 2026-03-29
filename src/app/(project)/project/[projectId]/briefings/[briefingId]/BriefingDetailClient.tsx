'use client'

import { useState, useCallback, useRef, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n/LanguageContext'
import { updateBriefing, deleteBriefing, assignBriefing, unassignBriefing, uploadBriefingCover, removeBriefingCover } from '@/lib/actions/briefing.actions'

// ── Block types ────────────────────────────────────────────────
type HeadingBlock   = { type: 'heading';   text: string }
type ParagraphBlock = { type: 'paragraph'; text: string }
type ListBlock      = { type: 'list';      items: string[] }
type CalloutBlock   = { type: 'callout';   text: string; variant: 'info' | 'warning' | 'success' }
type TimelineBlock  = { type: 'timeline';  rows: Array<{ time: string; text: string }> }
type Block = HeadingBlock | ParagraphBlock | ListBlock | CalloutBlock | TimelineBlock

function newBlock(type: Block['type']): Block {
  if (type === 'list')     return { type: 'list', items: [''] }
  if (type === 'callout')  return { type: 'callout', text: '', variant: 'info' }
  if (type === 'heading')  return { type: 'heading', text: '' }
  if (type === 'timeline') return { type: 'timeline', rows: [{ time: '', text: '' }] }
  return { type: 'paragraph', text: '' }
}

interface Props {
  projectId: string
  briefingId: string
  initialTitle: string
  initialContent: Block[]
  initialCoverImageUrl: string | null
  companies: { id: string; name: string }[]
  assignedCompanyIds: string[]
  canAdmin: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function BriefingDetailClient({
  projectId, briefingId, initialTitle, initialContent, initialCoverImageUrl,
  companies, assignedCompanyIds: initialAssigned, canAdmin,
}: Props) {
  const T = useTranslations()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [title, setTitle]             = useState(initialTitle)
  const [blocks, setBlocks]           = useState<Block[]>(initialContent)
  const [assigned, setAssigned]       = useState<Set<string>>(new Set(initialAssigned))
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('idle')
  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [coverUrl, setCoverUrl]       = useState<string | null>(initialCoverImageUrl)
  const [coverUploading, setCoverUploading] = useState(false)

  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const triggerSave = useCallback((nextTitle: string, nextBlocks: Block[]) => {
    if (!canAdmin) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      const res = await updateBriefing(projectId, briefingId, nextTitle, nextBlocks)
      setSaveStatus(res.error ? 'error' : 'saved')
      if (res.error) setError(res.error)
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
  }, [projectId, briefingId, canAdmin])

  function updateBlock(idx: number, patch: Partial<Block>) {
    const next = blocks.map((b, i) => i === idx ? { ...b, ...patch } as Block : b)
    setBlocks(next); triggerSave(title, next)
  }
  function addBlock(type: Block['type']) {
    const next = [...blocks, newBlock(type)]
    setBlocks(next); setShowBlockPicker(false); triggerSave(title, next)
  }
  function removeBlock(idx: number) {
    const next = blocks.filter((_, i) => i !== idx)
    setBlocks(next); triggerSave(title, next)
  }
  function moveBlock(idx: number, dir: -1 | 1) {
    const next = [...blocks]; const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setBlocks(next); triggerSave(title, next)
  }
  function updateListItem(bi: number, ii: number, value: string) {
    const b = blocks[bi] as ListBlock
    updateBlock(bi, { items: b.items.map((it, i) => i === ii ? value : it) } as any)
  }
  function addListItem(bi: number) {
    const b = blocks[bi] as ListBlock
    updateBlock(bi, { items: [...b.items, ''] } as any)
  }
  function removeListItem(bi: number, ii: number) {
    const b = blocks[bi] as ListBlock
    const items = b.items.filter((_, i) => i !== ii)
    updateBlock(bi, { items: items.length ? items : [''] } as any)
  }
  function updateTimelineRow(bi: number, ri: number, patch: Partial<{ time: string; text: string }>) {
    const b = blocks[bi] as TimelineBlock
    updateBlock(bi, { rows: b.rows.map((r, i) => i === ri ? { ...r, ...patch } : r) } as any)
  }
  function addTimelineRow(bi: number) {
    const b = blocks[bi] as TimelineBlock
    updateBlock(bi, { rows: [...b.rows, { time: '', text: '' }] } as any)
  }
  function removeTimelineRow(bi: number, ri: number) {
    const b = blocks[bi] as TimelineBlock
    const rows = b.rows.filter((_, i) => i !== ri)
    updateBlock(bi, { rows: rows.length ? rows : [{ time: '', text: '' }] } as any)
  }
  function handleTitleChange(v: string) { setTitle(v); triggerSave(v, blocks) }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverUploading(true)
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadBriefingCover(projectId, briefingId, fd)
    setCoverUploading(false)
    if (res.error) { setError(res.error); return }
    setCoverUrl(res.url!)
  }

  async function handleRemoveCover() {
    setCoverUploading(true)
    const res = await removeBriefingCover(projectId, briefingId)
    setCoverUploading(false)
    if (res.error) { setError(res.error); return }
    setCoverUrl(null)
  }

  function toggleAssign(companyId: string) {
    const isAssigned = assigned.has(companyId)
    startTransition(async () => {
      const res = isAssigned
        ? await unassignBriefing(projectId, briefingId, companyId)
        : await assignBriefing(projectId, briefingId, companyId)
      if (res.error) { setError(res.error); return }
      setAssigned(prev => { const n = new Set(prev); isAssigned ? n.delete(companyId) : n.add(companyId); return n })
    })
  }

  function handleDelete() {
    if (!confirm(T.briefings.confirmDelete)) return
    startTransition(async () => {
      const res = await deleteBriefing(projectId, briefingId)
      if (res.error) { setError(res.error); return }
      router.push(`/project/${projectId}/briefings`)
    })
  }

  const calloutStyle: Record<string, string> = {
    info:    'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    warning: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  }

  return (
    <>
    <div className="max-w-4xl w-full mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <Link href={`/project/${projectId}/briefings`}
          className="text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0">
          ← {T.briefings.title}
        </Link>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <span className="text-xs text-slate-400">{T.briefings.saving}</span>}
          {saveStatus === 'saved'  && <span className="text-xs text-green-600 dark:text-green-400">{T.briefings.saved}</span>}
          <button onClick={() => window.print()}
            className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors">
            🖨 {T.crew.printTicket}
          </button>
          {canAdmin && (
            <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition-colors">
              {T.briefings.delete}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-6 items-start">
        {/* ── Editor ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Cover image */}
          <div className="mb-5 rounded-xl overflow-hidden">
            {coverUrl ? (
              <div className="relative group">
                <img src={coverUrl} alt="cover" className="w-full h-52 object-cover" />
                {canAdmin && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs bg-white text-slate-800 rounded-lg font-medium hover:bg-slate-100 transition-colors">
                      {T.briefings.changeCover}
                    </button>
                    <button onClick={handleRemoveCover} disabled={coverUploading}
                      className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors">
                      {T.briefings.removeCover}
                    </button>
                  </div>
                )}
              </div>
            ) : canAdmin ? (
              <button onClick={() => fileInputRef.current?.click()} disabled={coverUploading}
                className="w-full h-36 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors group">
                {coverUploading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <>
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <span className="text-sm font-medium">{T.briefings.uploadCover}</span>
                  </>
                )}
              </button>
            ) : null}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </div>

          <input value={title} onChange={e => handleTitleChange(e.target.value)} disabled={!canAdmin}
            placeholder={T.briefings.untitled}
            className="w-full text-2xl font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-600 mb-6 disabled:cursor-default" />

          <div className="space-y-3">
            {blocks.map((block, idx) => (
              <div key={idx} className="group relative flex gap-2 items-start">
                {canAdmin && (
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-1.5">
                    <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} title={T.briefings.moveUp}
                      className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} title={T.briefings.moveDown}
                      className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {block.type === 'heading' && (
                    <input value={block.text} onChange={e => updateBlock(idx, { text: e.target.value })}
                      disabled={!canAdmin} placeholder={T.briefings.headingPlaceholder}
                      className="w-full text-lg font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-600 disabled:cursor-default" />
                  )}

                  {block.type === 'paragraph' && (
                    <textarea value={block.text} onChange={e => updateBlock(idx, { text: e.target.value })}
                      disabled={!canAdmin} placeholder={T.briefings.placeholder} rows={3}
                      className="w-full text-sm text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-600 resize-none disabled:cursor-default leading-relaxed" />
                  )}

                  {block.type === 'list' && (
                    <ul className="space-y-1">
                      {block.items.map((item, ii) => (
                        <li key={ii} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-0.5" />
                          <input value={item} onChange={e => updateListItem(idx, ii, e.target.value)}
                            disabled={!canAdmin} placeholder={T.briefings.listItemPlaceholder}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); addListItem(idx) }
                              if (e.key === 'Backspace' && item === '' && block.items.length > 1) { e.preventDefault(); removeListItem(idx, ii) }
                            }}
                            className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-600 disabled:cursor-default" />
                          {canAdmin && block.items.length > 1 && (
                            <button onClick={() => removeListItem(idx, ii)} className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </li>
                      ))}
                      {canAdmin && <li><button onClick={() => addListItem(idx)} className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 ml-3.5">{T.briefings.addItem}</button></li>}
                    </ul>
                  )}

                  {block.type === 'callout' && (
                    <div className={`rounded-xl border p-4 ${calloutStyle[block.variant]}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {canAdmin ? (
                          <select value={block.variant} onChange={e => updateBlock(idx, { variant: e.target.value as any })}
                            className="text-xs font-semibold bg-transparent border-none outline-none cursor-pointer uppercase tracking-wider">
                            <option value="info">{T.briefings.calloutInfo}</option>
                            <option value="warning">{T.briefings.calloutWarning}</option>
                            <option value="success">{T.briefings.calloutSuccess}</option>
                          </select>
                        ) : (
                          <span className="text-xs font-semibold uppercase tracking-wider">
                            {block.variant === 'info' ? T.briefings.calloutInfo : block.variant === 'warning' ? T.briefings.calloutWarning : T.briefings.calloutSuccess}
                          </span>
                        )}
                      </div>
                      <textarea value={block.text} onChange={e => updateBlock(idx, { text: e.target.value })}
                        disabled={!canAdmin} placeholder={T.briefings.placeholder} rows={2}
                        className="w-full text-sm bg-transparent border-none outline-none placeholder-current/40 resize-none disabled:cursor-default leading-relaxed" />
                    </div>
                  )}

                  {block.type === 'timeline' && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {T.briefings.blockTimeline}
                      </div>
                      <table className="w-full">
                        <tbody>
                          {block.rows.map((row, ri) => (
                            <tr key={ri} className="border-t border-slate-100 dark:border-slate-700/50 group/row">
                              <td className="py-2 pl-4 pr-2 w-24">
                                <input value={row.time} onChange={e => updateTimelineRow(idx, ri, { time: e.target.value })}
                                  disabled={!canAdmin} placeholder="09:00"
                                  className="w-full text-sm font-mono text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-600 disabled:cursor-default" />
                              </td>
                              <td className="py-2 px-2">
                                <input value={row.text} onChange={e => updateTimelineRow(idx, ri, { text: e.target.value })}
                                  disabled={!canAdmin} placeholder={T.briefings.placeholder}
                                  className="w-full text-sm text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-600 disabled:cursor-default" />
                              </td>
                              {canAdmin && (
                                <td className="py-2 pr-3 w-8">
                                  <button onClick={() => removeTimelineRow(idx, ri)}
                                    className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {canAdmin && (
                        <button onClick={() => addTimelineRow(idx)}
                          className="w-full text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 px-4 py-2 text-left border-t border-slate-100 dark:border-slate-700/50">
                          + {T.briefings.addItem}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {canAdmin && (
                  <button onClick={() => removeBlock(idx)} title={T.briefings.deleteBlock}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 shrink-0 mt-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {canAdmin && (
            <div className="mt-6 relative">
              <button onClick={() => setShowBlockPicker(v => !v)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 rounded-xl px-4 py-2.5 w-full justify-center transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {T.briefings.addBlock}
              </button>
              {showBlockPicker && (
                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-20 p-2 w-full">
                  <div className="grid grid-cols-2 gap-1">
                    {([
                      { type: 'heading'   as const, label: T.briefings.blockHeading,   icon: 'H' },
                      { type: 'paragraph' as const, label: T.briefings.blockParagraph, icon: '¶' },
                      { type: 'list'      as const, label: T.briefings.blockList,       icon: '•' },
                      { type: 'callout'   as const, label: T.briefings.blockCallout,    icon: '!' },
                      { type: 'timeline'  as const, label: T.briefings.blockTimeline,  icon: '⏱' },
                    ]).map(opt => (
                      <button key={opt.type} onClick={() => addBlock(opt.type)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">{opt.icon}</span>
                        <span className="text-sm text-slate-700 dark:text-slate-200">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar: assignments ─────────────────────────── */}
        <div className="w-60 shrink-0">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{T.briefings.assignTo}</h3>
            </div>
            {companies.length === 0 ? (
              <p className="text-xs text-slate-400 px-4 py-4">{T.briefings.noCompanies}</p>
            ) : (
              <ul className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {companies.map(company => {
                  const isAssigned = assigned.has(company.id)
                  return (
                    <li key={company.id}>
                      <button onClick={() => canAdmin && toggleAssign(company.id)} disabled={!canAdmin}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${canAdmin ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer' : 'cursor-default'}`}>
                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${isAssigned ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                          {isAssigned && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        <span className={`text-sm ${isAssigned ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{company.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Print-only full briefing */}
    <div id="briefing-print">
      {coverUrl && <img src={coverUrl} alt="" className="briefing-print-cover" />}
      <h1 className="briefing-print-title">{title}</h1>
      {blocks.map((block, i) => (
        <div key={i} className="briefing-print-block">
          {block.type === 'heading'   && <h2 className="briefing-print-h2">{block.text}</h2>}
          {block.type === 'paragraph' && <p className="briefing-print-p">{block.text}</p>}
          {block.type === 'list' && <ul className="briefing-print-ul">{block.items.map((it, j) => <li key={j}>{it}</li>)}</ul>}
          {block.type === 'callout'   && <div className={`briefing-print-callout briefing-print-callout-${block.variant}`}><strong>{block.variant.toUpperCase()}</strong> {block.text}</div>}
          {block.type === 'timeline'  && (
            <table className="briefing-print-timeline">
              <tbody>{block.rows.map((r, j) => <tr key={j}><td className="briefing-print-time">{r.time}</td><td>{r.text}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      ))}
    </div>

    <style>{`
      #briefing-print { display: none; }
      @media print {
        body * { visibility: hidden; }
        #briefing-print, #briefing-print * { visibility: visible; }
        #briefing-print {
          display: block;
          position: fixed; top: 0; left: 0; width: 100%;
          padding: 0; font-family: Arial, sans-serif; color: #000; background: #fff;
        }
        .briefing-print-cover { width: 100%; max-height: 220px; object-fit: cover; display: block; }
        .briefing-print-title { font-size: 24px; font-weight: bold; margin: 24px 40px 16px; }
        .briefing-print-block { margin: 0 40px 16px; }
        .briefing-print-h2 { font-size: 16px; font-weight: bold; margin-bottom: 6px; }
        .briefing-print-p { font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
        .briefing-print-ul { font-size: 13px; padding-left: 18px; line-height: 1.8; }
        .briefing-print-callout { font-size: 12px; padding: 8px 12px; border-left: 3px solid; margin: 4px 0; }
        .briefing-print-callout-info { border-color: #3b82f6; background: #eff6ff; }
        .briefing-print-callout-warning { border-color: #f59e0b; background: #fffbeb; }
        .briefing-print-callout-success { border-color: #10b981; background: #ecfdf5; }
        .briefing-print-timeline { width: 100%; border-collapse: collapse; font-size: 13px; }
        .briefing-print-timeline tr { border-bottom: 1px solid #e2e8f0; }
        .briefing-print-timeline td { padding: 5px 8px; }
        .briefing-print-time { font-weight: bold; width: 80px; color: #475569; }
      }
    `}</style>
    </>
  )
}
