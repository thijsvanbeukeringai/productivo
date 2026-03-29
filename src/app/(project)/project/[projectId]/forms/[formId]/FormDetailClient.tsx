'use client'

import { useState, useCallback, useRef, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n/LanguageContext'
import {
  updateForm, deleteForm,
  addFormField, updateFormField, deleteFormField, reorderFormFields,
  assignForm, unassignForm,
} from '@/lib/actions/form.actions'

type FieldType = 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number'

interface FormField {
  id: string
  type: FieldType
  label: string
  placeholder: string | null
  options: string[] | null
  required: boolean
  sort_order: number
}

interface Props {
  projectId: string
  formId: string
  initialTitle: string
  initialDescription: string
  initialFields: FormField[]
  companies: { id: string; name: string }[]
  assignedCompanyIds: string[]
  canAdmin: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type SidebarTab = 'assign' | 'preview'

// ── Live preview of a single field ───────────────────────────
function FieldPreview({ field }: { field: FormField }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {field.label || <span className="italic text-slate-300">Naamloos veld</span>}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.type === 'text' && (
        <input disabled placeholder={field.placeholder || ''} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed" />
      )}
      {field.type === 'textarea' && (
        <textarea disabled rows={3} placeholder={field.placeholder || ''} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed resize-none" />
      )}
      {field.type === 'number' && (
        <input type="number" disabled placeholder={field.placeholder || ''} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed" />
      )}
      {field.type === 'checkbox' && (
        <label className="flex items-center gap-2 cursor-not-allowed">
          <input type="checkbox" disabled className="w-4 h-4" />
          <span className="text-sm text-slate-500">{field.label || '—'}</span>
        </label>
      )}
      {field.type === 'select' && (
        <select disabled className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed">
          <option value="">— Kies een optie —</option>
          {(field.options || []).filter(Boolean).map((o, i) => <option key={i}>{o}</option>)}
        </select>
      )}
      {field.type === 'radio' && (
        <div className="space-y-1.5">
          {(field.options || []).filter(Boolean).length === 0
            ? <p className="text-xs text-slate-300 italic">Nog geen opties</p>
            : (field.options || []).filter(Boolean).map((o, i) => (
              <label key={i} className="flex items-center gap-2 cursor-not-allowed">
                <input type="radio" disabled className="w-4 h-4" />
                <span className="text-sm text-slate-500">{o}</span>
              </label>
            ))}
        </div>
      )}
    </div>
  )
}

export function FormDetailClient({
  projectId, formId, initialTitle, initialDescription,
  initialFields, companies, assignedCompanyIds: initialAssigned, canAdmin,
}: Props) {
  const T = useTranslations()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [title, setTitle]         = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [fields, setFields]       = useState<FormField[]>(initialFields)
  const [assigned, setAssigned]   = useState<Set<string>>(new Set(initialAssigned))
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [error, setError]         = useState<string | null>(null)
  const [expandedField, setExpandedField] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('assign')

  // fieldEdits: local display values (updates immediately on keystroke)
  const [fieldEdits, setFieldEdits] = useState<Record<string, Partial<FormField>>>({})
  // fieldEditsRef: mirrors fieldEdits but accessible inside setTimeout without stale closure
  const fieldEditsRef = useRef<Record<string, Partial<FormField>>>({})
  // One debounce timer per field (saves ALL accumulated edits for that field)
  const fieldTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const metaSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Title/description save ────────────────────────────────
  const triggerMetaSave = useCallback((t: string, d: string) => {
    if (!canAdmin) return
    if (metaSaveTimer.current) clearTimeout(metaSaveTimer.current)
    setSaveStatus('saving')
    metaSaveTimer.current = setTimeout(async () => {
      const res = await updateForm(projectId, formId, t, d)
      setSaveStatus(res.error ? 'error' : 'saved')
      if (res.error) setError(res.error)
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
  }, [projectId, formId, canAdmin])

  // ── Field property change: update display immediately, debounce server save ──
  function handleFieldChange(fieldId: string, patch: Partial<FormField>) {
    // 1. Merge into accumulated edits
    const merged = { ...fieldEditsRef.current[fieldId], ...patch }
    fieldEditsRef.current[fieldId] = merged
    setFieldEdits(prev => ({ ...prev, [fieldId]: merged }))

    // 2. Reset debounce timer — when it fires, save the accumulated edits (not just this patch)
    if (fieldTimers.current[fieldId]) clearTimeout(fieldTimers.current[fieldId])
    fieldTimers.current[fieldId] = setTimeout(async () => {
      const toSave = fieldEditsRef.current[fieldId]
      if (!toSave) return

      // Clean up options: remove empty strings before saving
      const cleanPatch = { ...toSave }
      if (Array.isArray(cleanPatch.options)) {
        cleanPatch.options = cleanPatch.options.filter(Boolean)
      }

      const res = await updateFormField(projectId, fieldId, cleanPatch as any)
      if (res.error) { setError(res.error); return }

      // Commit to canonical state, clear edits
      setFields(prev => prev.map(f => f.id === fieldId ? { ...f, ...cleanPatch } : f))
      delete fieldEditsRef.current[fieldId]
      setFieldEdits(prev => { const next = { ...prev }; delete next[fieldId]; return next })
    }, 700)
  }

  // Get display value for a field property (edits take priority over canonical state)
  function get<K extends keyof FormField>(fieldId: string, key: K, fallback: FormField[K]): FormField[K] {
    const edit = fieldEdits[fieldId]
    if (edit && key in edit) return edit[key] as FormField[K]
    return fallback
  }

  // Merged field for preview (edits + canonical)
  function merged(f: FormField): FormField {
    const edit = fieldEdits[f.id] || {}
    const result = { ...f, ...edit }
    // Clean options for preview display
    if (Array.isArray(result.options)) result.options = result.options.filter(Boolean)
    return result
  }

  // ── Required toggle (instant save, no debounce) ────────────
  async function handleRequiredToggle(fieldId: string, required: boolean) {
    const res = await updateFormField(projectId, fieldId, { required } as any)
    if (res.error) { setError(res.error); return }
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, required } : f))
  }

  // ── Add / delete / reorder ─────────────────────────────────
  async function handleAddField(type: FieldType) {
    const res = await addFormField(projectId, formId, type, fields.length)
    if (res.error) { setError(res.error); return }
    const newField: FormField = {
      id: res.id!, type, label: '', placeholder: null,
      options: type === 'select' || type === 'radio' ? [] : null,
      required: false, sort_order: fields.length,
    }
    setFields(prev => [...prev, newField])
    setExpandedField(res.id!)
  }

  async function handleDeleteField(fieldId: string) {
    const res = await deleteFormField(projectId, fieldId, formId)
    if (res.error) { setError(res.error); return }
    setFields(prev => prev.filter(f => f.id !== fieldId))
  }

  async function moveField(idx: number, dir: -1 | 1) {
    const next = [...fields]; const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setFields(next)
    await reorderFormFields(projectId, formId, next.map(f => f.id))
  }

  // ── Company assignment ─────────────────────────────────────
  function toggleAssign(companyId: string) {
    const isAssigned = assigned.has(companyId)
    startTransition(async () => {
      const res = isAssigned
        ? await unassignForm(projectId, formId, companyId)
        : await assignForm(projectId, formId, companyId)
      if (res.error) { setError(res.error); return }
      setAssigned(prev => { const n = new Set(prev); isAssigned ? n.delete(companyId) : n.add(companyId); return n })
    })
  }

  function handleDelete() {
    if (!confirm(T.forms.confirmDelete)) return
    startTransition(async () => {
      const res = await deleteForm(projectId, formId)
      if (res.error) { setError(res.error); return }
      router.push(`/project/${projectId}/forms`)
    })
  }

  const FIELD_TYPES: Array<{ type: FieldType; label: string; icon: string }> = [
    { type: 'text',     label: T.forms.fieldText,    icon: 'T' },
    { type: 'textarea', label: T.forms.fieldTextarea, icon: '¶' },
    { type: 'number',   label: T.forms.fieldNumber,   icon: '#' },
    { type: 'select',   label: T.forms.fieldSelect,   icon: '▾' },
    { type: 'radio',    label: T.forms.fieldRadio,    icon: '◉' },
    { type: 'checkbox', label: T.forms.fieldCheckbox, icon: '☑' },
  ]

  return (
    <div className="max-w-5xl w-full mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <Link href={`/project/${projectId}/forms`}
          className="text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0">
          ← {T.forms.title}
        </Link>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <span className="text-xs text-slate-400">{T.forms.saving}</span>}
          {saveStatus === 'saved'  && <span className="text-xs text-green-600 dark:text-green-400">{T.forms.saved}</span>}
          <Link href={`/project/${projectId}/forms/${formId}/responses`}
            className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors">
            {T.forms.viewResponses}
          </Link>
          {canAdmin && (
            <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition-colors">
              {T.forms.delete}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-6 items-start">
        {/* ── Builder ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); triggerMetaSave(e.target.value, description) }}
            disabled={!canAdmin}
            placeholder={T.forms.untitled}
            className="w-full text-2xl font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-600 mb-2 disabled:cursor-default"
          />
          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); triggerMetaSave(title, e.target.value) }}
            disabled={!canAdmin}
            placeholder={T.forms.descriptionPlaceholder}
            rows={2}
            className="w-full text-sm text-slate-500 dark:text-slate-400 bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-600 resize-none disabled:cursor-default mb-5 leading-relaxed"
          />

          <div className="space-y-2">
            {fields.map((field, idx) => {
              const isExpanded = expandedField === field.id
              const label       = get(field.id, 'label', field.label)
              const placeholder = get(field.id, 'placeholder', field.placeholder)
              const options     = get(field.id, 'options', field.options)

              return (
                <div key={field.id} className={`bg-white dark:bg-slate-800 rounded-xl border overflow-hidden transition-colors ${isExpanded ? 'border-blue-300 dark:border-blue-600' : 'border-slate-200 dark:border-slate-700'}`}>
                  {/* Row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {canAdmin && (
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button onClick={() => moveField(idx, -1)} disabled={idx === 0}
                          className="w-4 h-4 flex items-center justify-center text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}
                          className="w-4 h-4 flex items-center justify-center text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                    )}
                    <span className="text-xs font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded shrink-0">
                      {FIELD_TYPES.find(t => t.type === field.type)?.icon ?? 'T'}
                    </span>
                    <input
                      value={label}
                      onChange={e => handleFieldChange(field.id, { label: e.target.value })}
                      disabled={!canAdmin}
                      placeholder={T.forms.fieldLabelPlaceholder}
                      className="flex-1 text-sm font-medium text-slate-800 dark:text-white bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-500 disabled:cursor-default"
                    />
                    <span className="text-xs text-slate-400 shrink-0">
                      {FIELD_TYPES.find(t => t.type === field.type)?.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </span>
                    {canAdmin && (
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button onClick={() => setExpandedField(isExpanded ? null : field.id)}
                          className={`w-6 h-6 flex items-center justify-center transition-colors rounded ${isExpanded ? 'text-blue-500' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <button onClick={() => handleDeleteField(field.id)}
                          className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded settings */}
                  {isExpanded && canAdmin && (
                    <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3 bg-slate-50/50 dark:bg-slate-700/20">
                      {(field.type === 'text' || field.type === 'textarea' || field.type === 'number') && (
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">
                            {T.forms.fieldPlaceholder} <span className="font-normal text-slate-400">(optioneel)</span>
                          </label>
                          <input
                            value={placeholder || ''}
                            onChange={e => handleFieldChange(field.id, { placeholder: e.target.value || null })}
                            placeholder="bijv. Voer hier je antwoord in..."
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                      {(field.type === 'select' || field.type === 'radio') && (
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">
                            {T.forms.fieldOptions} <span className="font-normal text-slate-400">— één optie per regel</span>
                          </label>
                          <textarea
                            value={(options || []).join('\n')}
                            onChange={e => handleFieldChange(field.id, { options: e.target.value.split('\n') })}
                            rows={5}
                            placeholder={'XS\nS\nM\nL\nXL'}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            {(options || []).filter(Boolean).length} opties
                          </p>
                        </div>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={e => handleRequiredToggle(field.id, e.target.checked)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400">{T.forms.fieldRequired}</span>
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {canAdmin && (
            <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{T.forms.addField}</p>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_TYPES.map(opt => (
                  <button key={opt.type} onClick={() => handleAddField(opt.type)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <span className="font-bold">{opt.icon}</span> {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div className="w-64 shrink-0">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-3 bg-white dark:bg-slate-800">
            <button onClick={() => setSidebarTab('assign')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === 'assign' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              {T.forms.assignTo}
            </button>
            <button onClick={() => setSidebarTab('preview')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              Voorbeeld
            </button>
          </div>

          {sidebarTab === 'assign' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
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
          )}

          {sidebarTab === 'preview' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Voorbeeld</p>
              {fields.length === 0 ? (
                <p className="text-xs text-slate-300 dark:text-slate-600 italic">Voeg velden toe om een voorbeeld te zien.</p>
              ) : (
                <>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">{title || T.forms.untitled}</h3>
                  {description && <p className="text-xs text-slate-500 mb-4 leading-relaxed">{description}</p>}
                  {fields.map(f => <FieldPreview key={f.id} field={merged(f)} />)}
                  <button disabled className="mt-2 w-full py-2 text-sm bg-blue-600 text-white rounded-lg font-medium opacity-50 cursor-not-allowed">
                    Versturen
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
