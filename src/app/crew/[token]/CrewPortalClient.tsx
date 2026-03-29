'use client'

import { useState } from 'react'
import { portalAddCrewMember } from '@/lib/actions/crew.actions'
import { submitFormResponse } from '@/lib/actions/form.actions'

// ── Types ──────────────────────────────────────────────────────
interface CrewCompany  { id: string; name: string; target_count: number | null }
interface CrewProject  { id: string; name: string; start_date: string | null; end_date: string | null; show_days: string[] }
interface PlanningRow  { work_date: string; lunch: boolean; diner: boolean; night_snack: boolean; parking_card: boolean; walkie_talkie_type: string | null }
interface ExistingMember { id: string; first_name: string; last_name: string; email: string | null; crew_planning: Array<{ work_date: string; status: string }>; form_responses: Array<{ form_id: string }> }

interface BriefingBlock { type: string; text?: string; items?: string[]; rows?: Array<{ time: string; text: string }>; variant?: string }
interface Briefing { id: string; title: string; content: BriefingBlock[]; cover_image_url?: string | null }

interface FormField { id: string; type: string; label: string; placeholder: string | null; options: string[] | null; required: boolean; sort_order: number }
interface PortalForm { id: string; title: string; description: string | null; form_fields: FormField[] }

interface Props {
  token: string
  company: CrewCompany
  project: CrewProject
  initialMembers: ExistingMember[]
  briefings: Briefing[]
  forms: PortalForm[]
}

// ── Helpers ────────────────────────────────────────────────────
function generateDays(start: string | null, end: string | null): string[] {
  if (!start || !end) return []
  const days: string[] = []; const cur = new Date(start); const last = new Date(end)
  while (cur <= last) { days.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
  return days
}
function formatDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

const DAY_OPTIONS: Record<string, string> = { lunch: 'Lunch', diner: 'Diner', night_snack: 'Nachtsnack' }
const WALKIE_OPTIONS = [
  { value: 'inear', label: 'Inear' },
  { value: 'spreeksleutel', label: 'Porto spreeksleutel' },
  { value: 'heavy_duty', label: 'Porto Heavy duty headset' },
]

// ── Briefing renderer ──────────────────────────────────────────
function BriefingView({ briefing }: { briefing: Briefing }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors">
        <span className="font-medium text-slate-800 text-sm">{briefing.title}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          {briefing.cover_image_url && (
            <img src={briefing.cover_image_url} alt="" className="w-full h-48 object-cover" />
          )}
        <div className="px-4 pb-4 pt-3 space-y-3">
          {briefing.content.map((block, i) => (
            <div key={i}>
              {block.type === 'heading'   && <h3 className="font-bold text-slate-800">{block.text}</h3>}
              {block.type === 'paragraph' && <p className="text-sm text-slate-600 whitespace-pre-wrap">{block.text}</p>}
              {block.type === 'list'      && <ul className="text-sm text-slate-600 list-disc pl-5 space-y-0.5">{(block.items || []).map((it, j) => <li key={j}>{it}</li>)}</ul>}
              {block.type === 'callout'   && (
                <div className={`rounded-lg border p-3 text-sm ${
                  block.variant === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                  block.variant === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                  'bg-blue-50 border-blue-200 text-blue-800'
                }`}>{block.text}</div>
              )}
              {block.type === 'timeline' && (
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {(block.rows || []).map((r, j) => (
                      <tr key={j} className="border-b border-slate-100">
                        <td className="py-1.5 pr-4 font-mono font-semibold text-slate-500 whitespace-nowrap w-16">{r.time}</td>
                        <td className="py-1.5 text-slate-700">{r.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
        </div>
      )}
    </div>
  )
}

// ── Inline form fields (used inside add-member flow) ───────────
function FormSection({
  form,
  values,
  onChange,
}: {
  form: PortalForm
  values: Record<string, unknown>
  onChange: (fieldId: string, value: unknown) => void
}) {
  return (
    <div className="space-y-4">
      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{form.title}</h3>
        {form.description && <p className="text-xs text-slate-500 mb-3">{form.description}</p>}
      </div>
      {form.form_fields.map(field => (
        <div key={field.id}>
          <label className="block text-xs text-slate-500 mb-1.5">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.type === 'text' && (
            <input type="text" value={(values[field.id] as string) || ''} onChange={e => onChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
          {field.type === 'textarea' && (
            <textarea value={(values[field.id] as string) || ''} onChange={e => onChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''} rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          )}
          {field.type === 'number' && (
            <input type="number" value={(values[field.id] as string) || ''} onChange={e => onChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
          {field.type === 'checkbox' && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={!!(values[field.id])} onChange={e => onChange(field.id, e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-slate-600">{field.label}</span>
            </label>
          )}
          {field.type === 'select' && field.options && (
            <select value={(values[field.id] as string) || ''} onChange={e => onChange(field.id, e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Kies een optie —</option>
              {field.options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
            </select>
          )}
          {field.type === 'radio' && field.options && (
            <div className="space-y-2">
              {field.options.map((opt, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <input type="radio" name={`${form.id}-${field.id}`} value={opt} checked={values[field.id] === opt} onChange={() => onChange(field.id, opt)}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main portal ────────────────────────────────────────────────
export function CrewPortalClient({ token, company, project, initialMembers, briefings, forms }: Props) {
  const allDays = generateDays(project.start_date, project.end_date)
  const showDaySet = new Set(project.show_days)

  const [members, setMembers]   = useState<ExistingMember[]>(initialMembers)
  const [tab, setTab]           = useState<'crew' | 'briefings'>('crew')
  const [step, setStep]         = useState<'list' | 'add'>('list')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [email, setEmail]         = useState('')
  const [planning, setPlanning]   = useState<Record<string, PlanningRow>>({})
  // formValues: { [formId]: { [fieldId]: value } }
  const [formValues, setFormValues] = useState<Record<string, Record<string, unknown>>>({})

  function toggleDay(date: string) {
    setPlanning(prev => {
      const next = { ...prev }
      if (next[date]) delete next[date]
      else next[date] = { work_date: date, lunch: false, diner: false, night_snack: false, parking_card: false, walkie_talkie_type: null }
      return next
    })
  }
  function toggleOption(date: string, key: keyof PlanningRow) {
    setPlanning(prev => ({ ...prev, [date]: { ...prev[date], [key]: !prev[date][key] } }))
  }
  function setWalkieType(date: string, value: string | null) {
    setPlanning(prev => ({ ...prev, [date]: { ...prev[date], walkie_talkie_type: value } }))
  }
  function setFormValue(formId: string, fieldId: string, value: unknown) {
    setFormValues(prev => ({ ...prev, [formId]: { ...(prev[formId] || {}), [fieldId]: value } }))
  }

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) { setError('Vul voornaam en achternaam in.'); return }

    // Validate required form fields
    for (const form of forms) {
      for (const field of form.form_fields) {
        if (field.required) {
          const val = formValues[form.id]?.[field.id]
          if (val === undefined || val === null || val === '') {
            setError(`Vul het verplichte veld "${field.label}" in.`)
            return
          }
        }
      }
    }

    setSaving(true); setError(null)
    const res = await portalAddCrewMember(token, { first_name: firstName, last_name: lastName, email }, Object.values(planning))
    if (res.error) { setSaving(false); setError(res.error); return }

    // Submit form responses per member
    if (res.memberId && forms.length > 0) {
      for (const form of forms) {
        const vals = formValues[form.id] || {}
        const res2 = await submitFormResponse(token, form.id, res.memberId, vals)
        if (res2.error) { setSaving(false); setError(res2.error); return }
      }
    }

    setSaving(false)
    const submittedFormIds = forms.map(f => f.id)
    setMembers(prev => [...prev, {
      id: res.memberId!,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      crew_planning: Object.values(planning).map(p => ({ work_date: p.work_date, status: 'pending_approval' })),
      form_responses: submittedFormIds.map(id => ({ form_id: id })),
    }])
    setSuccess(`${firstName} ${lastName} is aangemeld!`)
    setStep('list'); setFirstName(''); setLastName(''); setEmail(''); setPlanning({}); setFormValues({})
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
  const tabClass = (active: boolean) => `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-6 py-4">
        <p className="text-xs text-slate-400 mb-0.5">{project.name}</p>
        <h1 className="text-lg font-bold">{company.name}</h1>
        {project.start_date && project.end_date && (
          <p className="text-xs text-slate-400 mt-1">{formatDay(project.start_date)} t/m {formatDay(project.end_date)}</p>
        )}
      </header>

      {/* Tabs */}
      <div className="px-4 pt-4 pb-1 max-w-2xl mx-auto">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1">
          <button onClick={() => setTab('crew')} className={tabClass(tab === 'crew')}>
            Crew aanmelden
          </button>
          {briefings.length > 0 && (
            <button onClick={() => setTab('briefings')} className={tabClass(tab === 'briefings')}>
              Briefings <span className="ml-1 text-xs opacity-70">({briefings.length})</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {success && tab === 'crew' && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>
        )}

        {/* ── Crew tab ─────────────────────────────────────── */}
        {tab === 'crew' && step === 'list' && (
          <>
            {members.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-800 text-sm">
                    Aangemelde crew ({members.length}{company.target_count ? `/${company.target_count}` : ''})
                  </h2>
                </div>
                <ul className="divide-y divide-slate-100">
                  {members.map(m => {
                    const formsDone = forms.length > 0 && forms.every(f => m.form_responses?.some(r => r.form_id === f.id))
                    return (
                      <li key={m.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-sm font-medium text-slate-800">{m.first_name} {m.last_name}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {forms.length > 0 && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${formsDone ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-600'}`}>
                                {formsDone ? '✓ Formulier' : '○ Formulier'}
                              </span>
                            )}
                          </div>
                        </div>
                        {m.email && <p className="text-xs text-slate-400 mb-1.5">{m.email}</p>}
                        <div className="flex flex-wrap gap-1">
                          {m.crew_planning?.slice(0, 5).map(p => (
                            <span key={p.work_date} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.status === 'approved' ? 'bg-green-100 text-green-700' :
                              p.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                            }`}>{formatDay(p.work_date)}</span>
                          ))}
                          {(m.crew_planning?.length ?? 0) > 5 && <span className="text-xs text-slate-400">+{(m.crew_planning?.length ?? 0) - 5}</span>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {members.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 px-6 py-10 text-center mb-4">
                <p className="text-slate-400 text-sm">Nog geen crew aangemeld voor dit bedrijf.</p>
              </div>
            )}
            <button onClick={() => { setStep('add'); setSuccess(null) }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors">
              + Crewlid toevoegen
            </button>
          </>
        )}

        {tab === 'crew' && step === 'add' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Crewlid toevoegen</h2>
              <button onClick={() => { setStep('list'); setError(null) }} className="text-slate-400 hover:text-slate-600 text-sm">Annuleren</button>
            </div>
            <div className="p-5 space-y-5">
              {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}

              {/* Personal details */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Gegevens</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Voornaam *</label>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jan" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Achternaam *</label>
                    <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="de Vries" className={inputClass} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-slate-500 mb-1.5">E-mailadres</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jan@bedrijf.nl" className={inputClass} />
                </div>
              </section>

              {/* Work days */}
              {allDays.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Werkdagen selecteren</h3>
                  <div className="space-y-2">
                    {allDays.map(date => {
                      const isShow = showDaySet.has(date); const selected = !!planning[date]
                      return (
                        <div key={date} className={`rounded-xl border transition-colors ${selected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                          <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                            <input type="checkbox" checked={selected} onChange={() => toggleDay(date)} className="w-4 h-4 accent-blue-600" />
                            <span className="text-sm font-medium text-slate-800 flex-1">{formatDay(date)}</span>
                            {isShow && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">Show dag</span>}
                          </label>
                          {selected && (
                            <div className="px-4 pb-3 pt-1 border-t border-blue-100">
                              <div className="flex flex-wrap gap-2 mb-2">
                                {Object.entries(DAY_OPTIONS).map(([key, label]) => {
                                  const val = planning[date][key as keyof PlanningRow] as boolean
                                  return (
                                    <label key={key} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer border transition-colors ${val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                      <input type="checkbox" checked={val} onChange={() => toggleOption(date, key as keyof PlanningRow)} className="sr-only" />
                                      {label}
                                    </label>
                                  )
                                })}
                              </div>
                              {isShow && (
                                <div className="space-y-2 mt-1">
                                  <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer border transition-colors w-fit ${planning[date].parking_card ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                    <input type="checkbox" checked={planning[date].parking_card} onChange={() => toggleOption(date, 'parking_card')} className="sr-only" />
                                    Parkeerkaart
                                  </label>
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1.5">Porto</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      <button type="button" onClick={() => setWalkieType(date, null)}
                                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${planning[date].walkie_talkie_type === null ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                        Niet nodig
                                      </button>
                                      {WALKIE_OPTIONS.map(opt => (
                                        <button key={opt.value} type="button" onClick={() => setWalkieType(date, opt.value)}
                                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${planning[date].walkie_talkie_type === opt.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Inline form fields */}
              {forms.map(form => (
                <FormSection
                  key={form.id}
                  form={form}
                  values={formValues[form.id] || {}}
                  onChange={(fieldId, value) => setFormValue(form.id, fieldId, value)}
                />
              ))}

              <button onClick={handleSubmit} disabled={saving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors">
                {saving ? 'Opslaan...' : 'Aanmelden'}
              </button>
            </div>
          </div>
        )}

        {/* ── Briefings tab ─────────────────────────────────── */}
        {tab === 'briefings' && (
          <div className="space-y-3">
            {briefings.map(b => <BriefingView key={b.id} briefing={b} />)}
          </div>
        )}
      </div>
    </div>
  )
}
