'use client'

import { useState } from 'react'
import { portalAddPerson, portalDeletePerson } from '@/lib/actions/accreditation.actions'

interface PersonItem { item_type_id: string; quantity: number; selected_variant?: string | null; day?: string | null }
interface Person {
  id: string; first_name: string; last_name: string; email: string | null
  role: string; status: string; valid_days: string[] | null; approved_days: string[] | null
  meal_selections?: Record<string, string[]> | null
  accreditation_person_items?: PersonItem[]
}
interface Zone { id: string; name: string; color: string }
interface ItemType { id: string; name: string; total_available: number | null; variants: string[] | null }
interface DayEntry { date: string; type: 'build' | 'show' }
interface BriefingBlock { type: string; content?: string; items?: string[]; level?: number }
interface Briefing { id: string; title: string; content: BriefingBlock[]; cover_image_url: string | null }
interface Props {
  token: string
  group: { id: string; name: string; type: string; item_limits: Record<string, number>; max_persons: number | null }
  project: { name: string }
  allDays: DayEntry[]
  dayMeals: Record<string, string[]>
  zones: Zone[]
  itemTypes: ItemType[]
  usedPerItem: Record<string, number>
  dayItems: Record<string, string[]>
  initialPersons: Person[]
  briefings: Briefing[]
}

const MEAL_OPTIONS = ['ontbijt', 'lunch', 'diner', 'nachtsnack'] as const
const MEAL_LABELS: Record<string, string> = { ontbijt: 'Breakfast', lunch: 'Lunch', diner: 'Dinner', nachtsnack: 'Night snack' }
const MEAL_SHORT: Record<string, string> = { ontbijt: 'B', lunch: 'L', diner: 'D', nachtsnack: 'N' }

const ROLE_LABELS: Record<string, string> = {
  crew: 'Crew', artist: 'Artist', guest: 'Guest', supplier: 'Supplier',
  press: 'Press', vip: 'VIP', other: 'Other'
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Pending approval', approved: 'Approved',
  checked_in: 'Checked in', checked_out: 'Checked out'
}
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  checked_in: 'bg-blue-100 text-blue-700',
  checked_out: 'bg-slate-100 text-slate-500',
}

function formatDay(date: string) {
  const d = new Date(date + 'T12:00:00')
  return {
    short: d.toLocaleDateString('nl-NL', { weekday: 'short' }),
    date: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'numeric' }),
  }
}

interface NewRow {
  id: string; firstName: string; lastName: string; email: string
  validDays: Set<string>; mealSelections: Record<string, string[]>; items: Record<string, number>; itemVariants: Record<string, string[]>; saving: boolean; error: string | null
}

function makeNewRow(): NewRow {
  return { id: crypto.randomUUID(), firstName: '', lastName: '', email: '', validDays: new Set(), mealSelections: {}, items: {}, itemVariants: {}, saving: false, error: null }
}

export function AccreditationPortalClient({ token, group, project, allDays, dayMeals, dayItems, zones, itemTypes, usedPerItem, initialPersons, briefings }: Props) {
  const [persons, setPersons] = useState<Person[]>(initialPersons)
  const [newRows, setNewRows] = useState<NewRow[]>([makeNewRow()])
  const [activeBriefing, setActiveBriefing] = useState<Briefing | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [localUsed, setLocalUsed] = useState<Record<string, number>>({})
  type EditDraft = { firstName: string; lastName: string; email: string; validDays: Set<string>; mealSelections: Record<string, string[]>; items: Record<string, number>; itemVariants: Record<string, string[]>; saving: boolean }

  const visibleItems = itemTypes.filter(it => group.item_limits[it.id] > 0)

  function personToEditDraft(p: Person): EditDraft {
    const items: Record<string, number> = {}
    const itemVariants: Record<string, string[]> = {}
    for (const i of (p.accreditation_person_items || [])) {
      if (i.selected_variant) {
        if (!itemVariants[i.item_type_id]) itemVariants[i.item_type_id] = []
        itemVariants[i.item_type_id].push(i.selected_variant)
      } else {
        items[i.item_type_id] = (items[i.item_type_id] || 0) + i.quantity
      }
    }
    return {
      firstName: p.first_name, lastName: p.last_name,
      email: p.email || '', validDays: new Set(p.valid_days || []),
      mealSelections: p.meal_selections || {},
      items,
      itemVariants,
      saving: false,
    }
  }

  // All draft persons auto-enter edit mode
  const [editingPersons, setEditingPersons] = useState<Record<string, EditDraft>>(() => {
    const init: Record<string, EditDraft> = {}
    for (const p of initialPersons) {
      if (p.status === 'draft') init[p.id] = personToEditDraft(p)
    }
    return init
  })

  function startEditing(p: Person) {
    setEditingPersons(prev => ({ ...prev, [p.id]: personToEditDraft(p) }))
  }

  function cancelEditing(personId: string) {
    const p = persons.find(x => x.id === personId)
    if (p) {
      // Restore to saved state
      setEditingPersons(prev => ({ ...prev, [personId]: personToEditDraft(p) }))
    }
  }

  function updateEditPerson(personId: string, patch: Partial<EditDraft>) {
    setEditingPersons(prev => prev[personId] ? { ...prev, [personId]: { ...prev[personId], ...patch } } : prev)
  }

  async function saveEditPerson(personId: string) {
    const draft = editingPersons[personId]
    if (!draft || !draft.firstName.trim() || !draft.lastName.trim()) return
    updateEditPerson(personId, { saving: true })
    const itemsArr: Array<{ item_type_id: string; quantity: number; selected_variant?: string }> = []
    for (const it of visibleItems) {
      if (it.variants && it.variants.length > 0) {
        for (const v of (draft.itemVariants?.[it.id] || [])) {
          itemsArr.push({ item_type_id: it.id, quantity: 1, selected_variant: v })
        }
      } else {
        const qty = (draft.items || {})[it.id] || 0
        if (qty > 0) itemsArr.push({ item_type_id: it.id, quantity: qty })
      }
    }
    const res = await (await import('@/lib/actions/accreditation.actions')).portalUpdatePerson(token, personId, {
      first_name: draft.firstName, last_name: draft.lastName, email: draft.email,
      valid_days: hasDays ? Array.from(draft.validDays) : undefined,
      meal_selections: Object.keys(draft.mealSelections).length > 0 ? draft.mealSelections : undefined,
      items: itemsArr,
    })
    if (res?.error) { updateEditPerson(personId, { saving: false }); return }
    setPersons(prev => prev.map(p => p.id === personId ? {
      ...p, first_name: draft.firstName, last_name: draft.lastName,
      email: draft.email || null, valid_days: hasDays ? Array.from(draft.validDays) : p.valid_days,
      meal_selections: draft.mealSelections,
      accreditation_person_items: itemsArr,
      status: 'draft',
    } : p))
    // Exit edit mode — row shows as read-only with "Pending approval" + "Aanpassen" button
    setEditingPersons(prev => {
      const next = { ...prev }
      delete next[personId]
      return next
    })
  }

  const hasDays = allDays.length > 0
  const maxPersons = group.max_persons
  const atLimit = maxPersons != null && persons.length >= maxPersons

  // Check if any items are visible for this group (for instructions banner)
  const hasItems = visibleItems.length > 0

  function updateRow(id: string, patch: Partial<NewRow>) {
    setNewRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function toggleDay(rowId: string, day: string) {
    setNewRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const next = new Set(r.validDays)
      const removing = next.has(day)
      removing ? next.delete(day) : next.add(day)
      // Only clear meal selections when unchecking — items are per-person, not per-day
      const meals = removing
        ? Object.fromEntries(Object.entries(r.mealSelections).filter(([d]) => d !== day))
        : r.mealSelections
      return { ...r, validDays: next, mealSelections: meals }
    }))
  }

  function toggleMealForDay(rowId: string, day: string, meal: string) {
    setNewRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const current = r.mealSelections[day] || []
      const next = current.includes(meal) ? current.filter(m => m !== meal) : [...current, meal]
      const meals = { ...r.mealSelections, [day]: next }
      if (next.length === 0) delete meals[day]
      return { ...r, mealSelections: meals }
    }))
  }

  async function submitRow(row: NewRow) {
    if (!row.firstName.trim() || !row.lastName.trim()) {
      updateRow(row.id, { error: 'First and last name are required.' }); return
    }
    if (maxPersons != null && persons.length >= maxPersons) {
      updateRow(row.id, { error: `Maximum of ${maxPersons} people reached.` }); return
    }
    const itemsArr: Array<{ item_type_id: string; quantity: number; selected_variant?: string }> = []
    for (const it of visibleItems) {
      if (it.variants && it.variants.length > 0) {
        for (const v of (row.itemVariants?.[it.id] || [])) {
          itemsArr.push({ item_type_id: it.id, quantity: 1, selected_variant: v })
        }
      } else {
        const qty = (row.items || {})[it.id] || 0
        if (qty > 0) itemsArr.push({ item_type_id: it.id, quantity: qty })
      }
    }
    // Validate limits for non-variant items
    for (const { item_type_id, quantity } of itemsArr.filter(i => !i.selected_variant)) {
      const limit = group.item_limits[item_type_id]
      if (limit != null) {
        const used = (usedPerItem[item_type_id] || 0) + (localUsed[item_type_id] || 0)
        if (used + quantity > limit) {
          const name = itemTypes.find(it => it.id === item_type_id)?.name || 'item'
          updateRow(row.id, { error: `Limit for "${name}" exceeded (max ${limit}).` }); return
        }
      }
    }

    updateRow(row.id, { saving: true, error: null })
    const res = await portalAddPerson(token, {
      first_name: row.firstName, last_name: row.lastName, email: row.email,
      role: group.type,
      valid_days: hasDays ? Array.from(row.validDays) : undefined,
      meal_selections: Object.keys(row.mealSelections).length > 0 ? row.mealSelections : undefined,
      items: itemsArr.length > 0 ? itemsArr : undefined,
    })
    if (res.error) { updateRow(row.id, { saving: false, error: res.error }); return }

    setLocalUsed(prev => {
      const next = { ...prev }
      for (const { item_type_id, quantity } of itemsArr) next[item_type_id] = (next[item_type_id] || 0) + quantity
      return next
    })
    const newPersonsLength = persons.length + 1
    setPersons(prev => [...prev, {
      id: res.id!, first_name: row.firstName, last_name: row.lastName,
      email: row.email || null, role: group.type, status: 'draft',
      valid_days: hasDays && row.validDays.size > 0 ? Array.from(row.validDays) : null,
      approved_days: null,
    }])
    // After submit: replace row with blank row (unless we'd be at limit)
    setNewRows(prev => {
      const filtered = prev.filter(r => r.id !== row.id)
      const willBeAtLimit = maxPersons != null && newPersonsLength >= maxPersons
      return filtered.length === 0 && !willBeAtLimit ? [makeNewRow()] : filtered
    })
    setSuccess(`${row.firstName} ${row.lastName} submitted for approval.`)
    setTimeout(() => setSuccess(null), 4000)
  }

  function renderBriefingBlock(block: BriefingBlock, i: number) {
    if (block.type === 'heading') return <h3 key={i} className="text-base font-bold text-slate-900 mt-4 mb-1">{block.content}</h3>
    if (block.type === 'paragraph') return <p key={i} className="text-sm text-slate-700 leading-relaxed">{block.content}</p>
    if (block.type === 'list') return (
      <ul key={i} className="list-disc list-inside space-y-1 text-sm text-slate-700">
        {(block.items || []).map((item, j) => <li key={j}>{item}</li>)}
      </ul>
    )
    if (block.type === 'callout') return (
      <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">{block.content}</div>
    )
    return null
  }

  if (activeBriefing) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-slate-900 text-white px-6 py-5">
          <button onClick={() => setActiveBriefing(null)} className="text-xs text-slate-400 hover:text-white transition-colors mb-1">← Back to accreditation</button>
          <h1 className="text-lg font-bold">{activeBriefing.title}</h1>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {activeBriefing.cover_image_url && (
            <img src={activeBriefing.cover_image_url} alt={activeBriefing.title} className="w-full h-48 object-cover rounded-xl mb-4" />
          )}
          <div className="space-y-3">
            {(activeBriefing.content || []).map((block, i) => renderBriefingBlock(block, i))}
          </div>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-6 py-5">
        <p className="text-xs text-slate-400 mb-0.5">{project.name}</p>
        <h1 className="text-xl font-bold">{group.name}</h1>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <p className="text-xs text-slate-400">Accreditation portal · {ROLE_LABELS[group.type] || group.type}</p>
          {maxPersons != null && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${atLimit ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
              {persons.length} / {maxPersons} people
            </span>
          )}
        </div>
      </header>

      <div className="w-full px-4 py-6 space-y-6">
        {success && (
          <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>
        )}
        {atLimit && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
            Maximum number of people ({maxPersons}) reached. No more submissions possible.
          </div>
        )}

        {/* Briefings */}
        {briefings.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Read briefings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {briefings.map(b => (
                <button key={b.id} onClick={() => setActiveBriefing(b)}
                  className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-blue-50 hover:border-blue-200 transition-colors">
                  {b.cover_image_url && <img src={b.cover_image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />}
                  <span className="flex-1 text-sm font-medium text-slate-800">{b.title}</span>
                  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Instructions */}
        {(hasDays || hasItems) && !atLimit && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">Fill in accreditation</p>
            <ul className="space-y-0.5 text-xs list-disc list-inside text-blue-700">
              <li>Enter first name, last name and email address for each person.</li>
              {hasDays && <li>Check the day(s) the person will be present (OB = build-up, SHOW = show day).</li>}
              {hasItems && <li>Enter the desired quantity for accreditation items.</li>}
              <li>Click <strong>Submit</strong> per row to save.</li>
            </ul>
          </div>
        )}

        {/* Spreadsheet */}
        <section>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              People ({persons.length}{maxPersons != null ? ` / ${maxPersons}` : ''})
            </h2>
            {hasDays && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-green-500 rounded text-white text-[10px]">✓</span>
                  Approved
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-blue-400/60 rounded text-white text-[10px]">✓</span>
                  Requested (pending)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-4 rounded border border-slate-200 bg-slate-50" />
                  Not requested
                </span>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">Lunch</span>
                  Meal approved day
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 text-[10px] font-medium">Lunch</span>
                  Meal pending day
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-6">#</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[130px]">First name</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[130px]">Last name</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[150px]">E-mail</th>
                  {allDays.length > 0 && (
                    <th colSpan={allDays.length} className="text-center px-2 py-1.5 text-xs font-semibold text-slate-500 border-l border-slate-200 bg-slate-100/60">
                      Present on
                    </th>
                  )}
                  {visibleItems.length > 0 && (
                    <th colSpan={visibleItems.length} className="text-center px-2 py-1.5 text-xs font-semibold text-slate-500 border-l border-slate-200 bg-amber-50/60">
                      Items
                    </th>
                  )}
                  <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-right">Status</th>
                </tr>
                {/* Sub-header */}
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th colSpan={4} />
                  {allDays.map(({ date, type }, idx) => {
                    const { short, date: d } = formatDay(date)
                    const isShow = type === 'show'
                    return (
                      <th key={date} className={`text-center px-2 py-1.5 min-w-[60px] ${idx === 0 ? 'border-l border-slate-200' : 'border-l border-slate-100'}`}>
                        <span className={`inline-block text-[9px] font-bold px-1 rounded mb-0.5 ${isShow ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                          {isShow ? 'SHOW' : 'OB'}
                        </span>
                        <span className="block text-slate-400 font-normal text-[10px]">{short}</span>
                        <span className="block text-xs font-semibold text-slate-600">{d}</span>
                      </th>
                    )
                  })}
                  {visibleItems.map((it, idx) => (
                    <th key={it.id} className={`text-center px-2 py-1.5 min-w-[80px] ${idx === 0 ? 'border-l border-slate-200' : 'border-l border-slate-100'}`}>
                      <span className="block text-xs font-semibold text-amber-700 leading-tight">{it.name}</span>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Existing persons */}
                {persons.map((p, i) => {
                  const editing = editingPersons[p.id]
                  // Draft persons are always in edit mode
                  if (p.status === 'draft' && editing) {
                    return (
                      <tr key={p.id} className="bg-amber-50/30">
                        <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-2 py-2"><input value={editing.firstName} onChange={e => updateEditPerson(p.id, { firstName: e.target.value })} placeholder="First name" className={inputCls} /></td>
                        <td className="px-2 py-2"><input value={editing.lastName} onChange={e => updateEditPerson(p.id, { lastName: e.target.value })} placeholder="Last name" className={inputCls} /></td>
                        <td className="px-2 py-2"><input type="email" value={editing.email} onChange={e => updateEditPerson(p.id, { email: e.target.value })} placeholder="Email" className={inputCls} /></td>
                        {allDays.map(({ date }, idx) => {
                          const checked = editing.validDays.has(date)
                          // Show configured meals, or all 4 by default
                          const mealsForDay = (dayMeals[date] || []).length > 0 ? dayMeals[date] : [...MEAL_OPTIONS]
                          const selectedMeals = editing.mealSelections[date] || []
                          return (
                            <td key={date} className={`px-1 py-1.5 text-center align-top ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                              <div className="flex flex-col items-center gap-1">
                                <input type="checkbox" checked={checked}
                                  onChange={() => {
                                    const next = new Set(editing.validDays)
                                    const removing = next.has(date)
                                    removing ? next.delete(date) : next.add(date)
                                    const meals = removing
                                      ? Object.fromEntries(Object.entries(editing.mealSelections).filter(([d]) => d !== date))
                                      : editing.mealSelections
                                    updateEditPerson(p.id, { validDays: next, mealSelections: meals })
                                  }}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-1" />
                                {checked && (
                                  <div className="flex flex-col gap-0.5 w-full">
                                    {mealsForDay.map(meal => {
                                      const active = selectedMeals.includes(meal)
                                      return (
                                        <button key={meal} type="button"
                                          onClick={() => {
                                            const cur = editing.mealSelections[date] || []
                                            const next = cur.includes(meal) ? cur.filter(m => m !== meal) : [...cur, meal]
                                            const meals = { ...editing.mealSelections, [date]: next }
                                            if (next.length === 0) delete meals[date]
                                            updateEditPerson(p.id, { mealSelections: meals })
                                          }}
                                          className={`w-full text-[10px] font-medium px-1 py-0.5 rounded transition-colors text-left ${active ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700'}`}>
                                          {MEAL_LABELS[meal]}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          )
                        })}
                        {visibleItems.map((it, idx) => {
                          if (it.variants && it.variants.length > 0) {
                            const selVars = editing.itemVariants?.[it.id] || []
                            return (
                              <td key={it.id} className={`px-2 py-1.5 align-top ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                                <div className="flex flex-col gap-0.5">
                                  {it.variants.map(v => {
                                    const active = selVars.includes(v)
                                    return (
                                      <button key={v} type="button"
                                        onClick={() => {
                                          const next = active ? [] : [v]
                                          updateEditPerson(p.id, { itemVariants: { ...(editing.itemVariants || {}), [it.id]: next } })
                                        }}
                                        className={`w-full text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors text-left ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-700'}`}>
                                        {v}
                                      </button>
                                    )
                                  })}
                                </div>
                              </td>
                            )
                          }
                          const current = (editing.items || {})[it.id] || 0
                          return (
                            <td key={it.id} className={`px-2 py-2 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                              <div className="flex items-center justify-center gap-1">
                                <button type="button" onClick={() => updateEditPerson(p.id, { items: { ...(editing.items || {}), [it.id]: Math.max(0, current - 1) } })}
                                  disabled={current === 0}
                                  className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-sm font-medium">−</button>
                                <span className="w-5 text-center text-sm font-medium text-slate-700">{current}</span>
                                <button type="button" onClick={() => updateEditPerson(p.id, { items: { ...(editing.items || {}), [it.id]: current + 1 } })}
                                  className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 text-sm font-medium">+</button>
                              </div>
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={async () => {
                              if (!confirm(`${editing.firstName} ${editing.lastName} verwijderen?`)) return
                              const res = await portalDeletePerson(token, p.id)
                              if (!res.error) setPersons(prev => prev.filter(x => x.id !== p.id))
                            }} className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded transition-colors">
                              Verwijderen
                            </button>
                            <button onClick={() => cancelEditing(p.id)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded transition-colors">Annuleren</button>
                            <button onClick={() => saveEditPerson(p.id)} disabled={editing.saving || !editing.firstName.trim() || !editing.lastName.trim()}
                              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
                              {editing.saving ? '...' : 'Goedkeuring aanvragen'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  // Approved / checked-in / checked-out: read-only
                  return (
                    <tr key={p.id} className="bg-white">
                      <td className="px-3 py-2.5 text-xs text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-800 font-medium">{p.first_name}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-800">{p.last_name}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{p.email || '—'}</td>
                      {allDays.map(({ date }, idx) => {
                        const isRequested = p.valid_days && p.valid_days.includes(date)
                        const isApproved = p.approved_days && p.approved_days.includes(date)
                        const selectedMeals = (p.meal_selections?.[date] || []) as string[]
                        return (
                          <td key={date} className={`px-2 py-2 text-center align-top ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                            <div className="flex flex-col items-center gap-1">
                              {isApproved ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded text-white text-xs mt-0.5">✓</span>
                              ) : isRequested ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-400/60 rounded text-white text-xs mt-0.5">✓</span>
                              ) : (
                                <span className="inline-block w-5 h-5 rounded border border-slate-200 bg-slate-50 mt-0.5" />
                              )}
                              {isRequested && selectedMeals.length > 0 && (
                                <div className="flex flex-col gap-0.5 w-full mt-0.5">
                                  {selectedMeals.map(meal => (
                                    <span key={meal} className={`w-full text-[10px] font-medium px-1.5 py-0.5 rounded text-left ${isApproved ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-500'}`}>
                                      {MEAL_LABELS[meal]}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                      {visibleItems.map((it, idx) => {
                        if (it.variants && it.variants.length > 0) {
                          const selectedVars = (p.accreditation_person_items || [])
                            .filter(i => i.item_type_id === it.id && i.selected_variant)
                            .map(i => i.selected_variant!)
                          return (
                            <td key={it.id} className={`px-2 py-2 align-top ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                              {selectedVars.length > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  {selectedVars.map(v => (
                                    <span key={v} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-left">{v}</span>
                                  ))}
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          )
                        }
                        const qty = (p.accreditation_person_items || []).find(i => i.item_type_id === it.id && !i.selected_variant)?.quantity
                        return (
                          <td key={it.id} className={`px-2 py-2.5 text-center text-sm text-slate-600 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                            {qty ? <span className="font-medium">{qty}</span> : <span className="text-slate-300">—</span>}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[p.status]}`}>
                            {STATUS_LABELS[p.status] || p.status}
                          </span>
                          {p.status === 'approved' && (p.valid_days || []).length > (p.approved_days || []).length && (
                            <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">
                              {(p.approved_days || []).length}/{(p.valid_days || []).length} days approved
                            </span>
                          )}
                          {p.status === 'draft' && (
                            <button onClick={() => startEditing(p)}
                              className="text-xs px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg font-medium transition-colors whitespace-nowrap">
                              ✎ Aanpassen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {/* Input rows */}
                {!atLimit && newRows.map((row, i) => (
                  <tr key={row.id} className="bg-blue-50/30">
                    <td className="px-3 py-2 text-xs text-slate-400">{persons.length + i + 1}</td>
                    <td className="px-2 py-2"><input value={row.firstName} onChange={e => updateRow(row.id, { firstName: e.target.value })} placeholder="First name" className={inputCls} /></td>
                    <td className="px-2 py-2"><input value={row.lastName} onChange={e => updateRow(row.id, { lastName: e.target.value })} placeholder="Last name" className={inputCls} /></td>
                    <td className="px-2 py-2"><input type="email" value={row.email} onChange={e => updateRow(row.id, { email: e.target.value })} placeholder="Email" className={inputCls} /></td>
                    {allDays.map(({ date }, idx) => {
                      const checked = row.validDays.has(date)
                      const mealsForDay = (dayMeals[date] || []).length > 0 ? dayMeals[date] : [...MEAL_OPTIONS]
                      const selectedMeals = row.mealSelections[date] || []
                      return (
                        <td key={date} className={`px-1 py-1.5 text-center align-top ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                          <div className="flex flex-col items-center gap-1">
                            <input type="checkbox" checked={checked} onChange={() => toggleDay(row.id, date)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-1" />
                            {checked && (
                              <div className="flex flex-col gap-0.5 w-full">
                                {mealsForDay.map(meal => {
                                  const active = selectedMeals.includes(meal)
                                  return (
                                    <button key={meal} type="button"
                                      onClick={() => toggleMealForDay(row.id, date, meal)}
                                      className={`w-full text-[10px] font-medium px-1 py-0.5 rounded transition-colors text-left ${active ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700'}`}>
                                      {MEAL_LABELS[meal]}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                    {visibleItems.map((it, idx) => {
                      if (it.variants && it.variants.length > 0) {
                        const selVars = row.itemVariants?.[it.id] || []
                        return (
                          <td key={it.id} className={`px-2 py-1.5 align-top ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                            <div className="flex flex-col gap-0.5">
                              {it.variants.map(v => {
                                const active = selVars.includes(v)
                                return (
                                  <button key={v} type="button"
                                    onClick={() => {
                                      setNewRows(prev => prev.map(r => {
                                        if (r.id !== row.id) return r
                                        const next = active ? [] : [v]
                                        return { ...r, itemVariants: { ...(r.itemVariants || {}), [it.id]: next } }
                                      }))
                                    }}
                                    className={`w-full text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors text-left ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-700'}`}>
                                    {v}
                                  </button>
                                )
                              })}
                            </div>
                          </td>
                        )
                      }
                      const current = (row.items || {})[it.id] || 0
                      return (
                        <td key={it.id} className={`px-2 py-2 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => setNewRows(prev => prev.map(r => r.id !== row.id ? r : { ...r, items: { ...(r.items || {}), [it.id]: Math.max(0, current - 1) } }))}
                              disabled={current === 0}
                              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-sm font-medium">−</button>
                            <span className="w-5 text-center text-sm font-medium text-slate-700">{current}</span>
                            <button type="button" onClick={() => setNewRows(prev => prev.map(r => r.id !== row.id ? r : { ...r, items: { ...(r.items || {}), [it.id]: current + 1 } }))}
                              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 text-sm font-medium">+</button>
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {row.error && <span className="text-xs text-red-500 max-w-[120px] text-right">{row.error}</span>}
                        {newRows.length > 1 && (
                          <button onClick={() => setNewRows(prev => prev.filter(r => r.id !== row.id))}
                            className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                        <button onClick={() => submitRow(row)} disabled={row.saving || !row.firstName.trim() || !row.lastName.trim()}
                          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
                          {row.saving ? '...' : 'Submit'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!atLimit && (
            <button
              onClick={() => setNewRows(prev => {
                if (maxPersons != null && persons.length + prev.length >= maxPersons) return prev
                return [...prev, makeNewRow()]
              })}
              disabled={maxPersons != null && persons.length + newRows.length >= maxPersons}
              className="mt-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors font-medium">
              + Add row{maxPersons != null ? ` (${maxPersons - persons.length - newRows.length} remaining)` : ''}
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
