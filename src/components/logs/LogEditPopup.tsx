'use client'

import { useState, useRef } from 'react'
import { updateLog, uploadLogImage } from '@/lib/actions/log.actions'
import { enforcementConfig } from '@/lib/utils/priority-colors'
import type { Log, Subject, Area, MemberOption } from '@/types/app.types'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Props {
  log: Log
  subjects: Subject[]
  areas: Area[]
  members: MemberOption[]
  onClose: () => void
}

const MAX_IMAGES = 4

export function LogEditPopup({ log, subjects, areas, members, onClose }: Props) {
  const T = useTranslations()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingUrls, setExistingUrls] = useState<string[]>(log.image_urls || [])
  const [newImages, setNewImages] = useState<{ file: File; preview: string }[]>([])
  const [enforcementType, setEnforcementType] = useState(log.enforcement_type || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const needsReason = enforcementType === 'ejection' || enforcementType === 'arrest'

  const totalImages = existingUrls.length + newImages.length
  const canAddMore = totalImages < MAX_IMAGES

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const remaining = MAX_IMAGES - totalImages
    const toAdd = files.slice(0, remaining)

    const previews = toAdd.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setNewImages(prev => [...prev, ...previews])

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeExisting(url: string) {
    setExistingUrls(prev => prev.filter(u => u !== url))
  }

  function removeNew(index: number) {
    setNewImages(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Upload new images
    const uploadedUrls: string[] = []
    for (const img of newImages) {
      const fd = new FormData()
      fd.set('file', img.file)
      fd.set('log_id', log.id)
      const result = await uploadLogImage(fd)
      if (result.error) {
        setError(`${T.logbook.uploadFailed} ${result.error}`)
        setLoading(false)
        return
      }
      if (result.url) uploadedUrls.push(result.url)
    }

    const form = e.currentTarget
    const data = new FormData(form)

    const result = await updateLog(log.id, {
      incident_text: data.get('incident_text') as string,
      subject_id: (data.get('subject_id') as string) || null,
      priority: data.get('priority') as Log['priority'],
      area_id: (data.get('area_id') as string) || null,
      assigned_user_id: (data.get('assigned_user_id') as string) || null,
      enforcement_type: (data.get('enforcement_type') as Log['enforcement_type']) || null,
      enforcement_reason: needsReason ? (data.get('enforcement_reason') as string) || null : null,
      status: data.get('status') as 'open' | 'closed',
      image_urls: [...existingUrls, ...uploadedUrls],
    })

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">{T.logbook.editLog}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Incident text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {T.logbook.description}
            </label>
            <textarea
              name="incident_text"
              rows={5}
              required
              defaultValue={log.incident_text}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{T.logbook.priority}</label>
              <select
                name="priority"
                defaultValue={log.priority}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="info">{T.logbook.priority_info}</option>
                <option value="low">{T.logbook.priority_low}</option>
                <option value="mid">{T.logbook.priority_mid}</option>
                <option value="high">{T.logbook.priority_high}</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                name="status"
                defaultValue={log.status}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="open">{T.logbook.status_open}</option>
                <option value="closed">{T.logbook.status_closed}</option>
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{T.logbook.subject}</label>
              <select
                name="subject_id"
                defaultValue={log.subject_id || ''}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{T.logbook.noOption}</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Area */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{T.logbook.area}</label>
              <select
                name="area_id"
                defaultValue={log.area_id || ''}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{T.logbook.noOption}</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Assigned user */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{T.logbook.assignTo}</label>
              <select
                name="assigned_user_id"
                defaultValue={log.assigned_user_id || ''}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{T.logbook.noAssignee}</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
            </div>

            {/* Enforcement type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{T.logbook.enforcement}</label>
              <select
                name="enforcement_type"
                value={enforcementType}
                onChange={e => setEnforcementType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{T.logbook.noOption}</option>
                {Object.entries(enforcementConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            {/* Enforcement reason — only for ejection/arrest */}
            {needsReason && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {enforcementType === 'ejection' ? T.logbook.ejectionReason : T.logbook.arrestReason}
                </label>
                <input
                  type="text"
                  name="enforcement_reason"
                  defaultValue={log.enforcement_reason || ''}
                  placeholder={T.logbook.reasonPlaceholder}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {T.logbook.photos} <span className="text-slate-400 font-normal">({totalImages}/{MAX_IMAGES})</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {/* Existing images */}
              {existingUrls.map(url => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExisting(url)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* New images (not yet uploaded) */}
              {newImages.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-blue-200 dark:border-blue-700 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-blue-600/70 text-white text-[10px] text-center py-0.5">
                    {T.logbook.newImage}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNew(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Add button */}
              {canAddMore && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[10px]">{T.logbook.photo}</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* All followups */}
          {log.followups && log.followups.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {T.logbook.allFollowups} ({log.followups.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                {log.followups.map(fu => (
                  <div key={fu.id} className="text-xs border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                    <span className="text-slate-400 font-mono">{new Date(fu.created_at).toLocaleTimeString('nl-NL')}</span>
                    <span className="text-slate-500 dark:text-slate-400 ml-1">— {fu.display_name_snapshot}:</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{fu.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {T.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? T.common.saving : T.logbook.saveChanges}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
