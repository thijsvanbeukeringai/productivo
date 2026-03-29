'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  createZone, deleteZone,
  createItemType, deleteItemType, updateItemTypeVariants,
  createGroup, deleteGroup, updateGroupItemLimits, updateGroupMaxPersons,
  createPerson, updatePerson, deletePerson,
  approvePerson, approvePersonDays, approveAllDraftInGroup,
  setPersonZones, setPersonItems, markItemIssued,
  bulkCreatePersons, updateProjectShowDays, updateProjectBuildDays, updateProjectDayMeals, updateProjectDayItems,
} from '@/lib/actions/accreditation.actions'
import { assignBriefingToAccGroup, unassignBriefingFromAccGroup } from '@/lib/actions/briefing.actions'

// ── Types ─────────────────────────────────────────────────────
interface Zone { id: string; name: string; color: string; sort_order: number; capacity: number | null }
interface ItemType { id: string; name: string; total_available: number | null; sort_order?: number; variants: string[] | null }
interface Group { id: string; name: string; contact_name: string | null; contact_email: string | null; type: string; invite_token: string; item_limits: Record<string, number>; max_persons: number | null; meal_config: Record<string, string[]> }
interface PersonItem { id: string; item_type_id: string; quantity: number; issued: boolean; issued_at: string | null; selected_variant: string | null }
interface Person {
  id: string; first_name: string; last_name: string; email: string | null
  role: string; status: string; notes: string | null; qr_token: string
  checked_in_at: string | null; checked_out_at: string | null; created_at: string
  group_id: string | null
  valid_days: string[] | null
  approved_days: string[] | null
  meal_selections: Record<string, string[]> | null
  accreditation_groups: { id: string; name: string; type: string } | null
  accreditation_person_zones: Array<{ zone_id: string }>
  accreditation_person_items: PersonItem[]
}
interface Briefing { id: string; title: string; cover_image_url: string | null }
interface BriefingAssignment { briefing_id: string; accreditation_group_id: string }
interface Props {
  projectId: string
  initialPersons: Person[]
  initialGroups: Group[]
  initialZones: Zone[]
  initialItemTypes: ItemType[]
  initialBriefings: Briefing[]
  initialBriefingAssignments: BriefingAssignment[]
  canAdmin: boolean
  projectShowDays: string[]
  projectBuildDays: string[]
  projectDayMeals: Record<string, string[]>
  projectDayItems: Record<string, string[]>
  initialTab: string
}

const MEALS = ['ontbijt', 'lunch', 'diner', 'nachtsnack'] as const
const MEAL_LABELS: Record<string, string> = { ontbijt: 'Ontbijt', lunch: 'Lunch', diner: 'Diner', nachtsnack: 'Nachtsnack' }

const ROLES = ['crew','artist','guest','supplier','press','vip','other']
const ROLE_LABELS: Record<string, string> = {
  crew: 'Crew', artist: 'Artiest', guest: 'Gast', supplier: 'Leverancier',
  press: 'Pers', vip: 'VIP', other: 'Overig'
}
const ROLE_COLORS: Record<string, string> = {
  crew: 'bg-blue-100 text-blue-700', artist: 'bg-purple-100 text-purple-700',
  guest: 'bg-green-100 text-green-700', supplier: 'bg-orange-100 text-orange-700',
  press: 'bg-pink-100 text-pink-700', vip: 'bg-amber-100 text-amber-700',
  other: 'bg-slate-100 text-slate-600',
}
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  approved: 'bg-green-100 text-green-700',
  checked_in: 'bg-blue-100 text-blue-700',
  checked_out: 'bg-slate-200 text-slate-500',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Concept', approved: 'Goedgekeurd', checked_in: 'Ingecheckt', checked_out: 'Vertrokken'
}

function fullName(p: { first_name: string; last_name: string }) {
  return `${p.first_name} ${p.last_name}`
}

// ── Person panel ──────────────────────────────────────────────
function PersonPanel({
  person, zones, itemTypes, groups, projectId, projectShowDays, projectBuildDays, dayMeals, dayItems, onClose, onUpdate,
}: {
  person: Person; zones: Zone[]; itemTypes: ItemType[]; groups: Group[]
  projectId: string; projectShowDays: string[]; projectBuildDays: string[]
  dayMeals: Record<string, string[]>
  dayItems: Record<string, string[]>
  onClose: () => void; onUpdate: (p: Person) => void
}) {
  const [, startT] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'info' | 'meals'>('info')

  // Editable fields
  const [firstName, setFirstName] = useState(person.first_name)
  const [lastName, setLastName]   = useState(person.last_name)
  const [email, setEmail]         = useState(person.email || '')
  const [role, setRole]           = useState(person.role)
  const [groupId, setGroupId]     = useState(person.group_id || '')
  const [notes, setNotes]         = useState(person.notes || '')

  // Zone toggles
  const [selectedZones, setSelectedZones] = useState<Set<string>>(
    new Set(person.accreditation_person_zones.map(z => z.zone_id))
  )
  // Per-person item quantities
  const [itemQtys, setItemQtys] = useState<Record<string, number>>(
    Object.fromEntries(person.accreditation_person_items.filter(i => !i.selected_variant).map(i => [i.item_type_id, i.quantity]))
  )
  // Per-person item variants
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string[]>>(
    (() => {
      const result: Record<string, string[]> = {}
      for (const item of person.accreditation_person_items) {
        if (item.selected_variant) {
          if (!result[item.item_type_id]) result[item.item_type_id] = []
          result[item.item_type_id].push(item.selected_variant)
        }
      }
      return result
    })()
  )

  // Valid days state
  const [validDays, setValidDays] = useState<string[]>(person.valid_days || [])
  // Meal selections per day (editable)
  const [mealSelections, setMealSelections] = useState<Record<string, string[]>>(person.meal_selections || {})
  // Per-day approval
  const [approvedDays, setApprovedDays] = useState<Set<string>>(new Set(person.approved_days || []))
  const [savingApproval, setSavingApproval] = useState(false)

  const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const qrUrl = `${appBaseUrl}/accreditation-qr/${person.qr_token}`
  const ticketUrl = `${appBaseUrl}/accreditation/ticket/${person.qr_token}`

  async function handleSave() {
    setSaving(true); setError(null)
    const cleanedMeals: Record<string, string[]> = {}
    for (const day of validDays) {
      if (mealSelections[day]?.length > 0) cleanedMeals[day] = mealSelections[day]
    }
    const savedMeals = Object.keys(cleanedMeals).length > 0 ? cleanedMeals : null
    const approvedDaysArr = Array.from(approvedDays)

    // Build items array per person (not per day)
    const itemsArray: Array<{ item_type_id: string; quantity: number; selected_variant?: string | null }> = []
    for (const it of itemTypes) {
      if (it.variants && it.variants.length > 0) {
        for (const v of (selectedVariants[it.id] || [])) {
          itemsArray.push({ item_type_id: it.id, quantity: 1, selected_variant: v })
        }
      } else {
        const qty = itemQtys[it.id] || 0
        if (qty > 0) itemsArray.push({ item_type_id: it.id, quantity: qty, selected_variant: null })
      }
    }

    // Save data first, then approval (sequential to avoid status race)
    const [r1, r2, r3] = await Promise.all([
      updatePerson(projectId, person.id, {
        first_name: firstName, last_name: lastName,
        email: email || null, role,
        group_id: groupId || null, notes: notes || null,
        valid_days: validDays.length > 0 ? validDays : null,
        meal_selections: savedMeals,
      }),
      setPersonZones(projectId, person.id, Array.from(selectedZones)),
      setPersonItems(projectId, person.id, itemsArray),
    ])
    const err = r1.error || r2.error || r3.error
    if (err) { setSaving(false); setError(err); return }

    // Then save approval days (determines final status)
    const r4 = await approvePersonDays(projectId, person.id, approvedDaysArr)
    setSaving(false)
    if (r4.error) { setError(r4.error); return }

    onUpdate({
      ...person,
      status: r4.status as string,
      first_name: firstName, last_name: lastName, email: email || null, role,
      group_id: groupId || null, notes: notes || null,
      valid_days: validDays.length > 0 ? validDays : null,
      meal_selections: savedMeals,
      approved_days: approvedDaysArr.length > 0 ? approvedDaysArr : null,
      accreditation_person_zones: Array.from(selectedZones).map(zone_id => ({ zone_id })),
      accreditation_person_items: itemsArray.map(i => ({
        id: person.accreditation_person_items.find(x => x.item_type_id === i.item_type_id && x.selected_variant === (i.selected_variant || null))?.id || '',
        item_type_id: i.item_type_id, quantity: i.quantity, issued: false, issued_at: null, selected_variant: i.selected_variant || null,
      })),
    })
  }

  async function handleDelete() {
    if (!confirm(`${fullName(person)} verwijderen?`)) return
    const res = await deletePerson(projectId, person.id)
    if (res.error) { setError(res.error); return }
    onClose()
  }

  const toggleZone = (zoneId: string) => {
    setSelectedZones(prev => { const n = new Set(prev); n.has(zoneId) ? n.delete(zoneId) : n.add(zoneId); return n })
  }

  const allProjectDays = [...new Set([...projectBuildDays, ...projectShowDays])].sort()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-800 rounded-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white text-lg">{fullName(person)}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[person.role]}`}>{ROLE_LABELS[person.role]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[person.status]}`}>{STATUS_LABELS[person.status]}</span>
              {person.accreditation_groups && <span className="text-xs text-slate-400">{person.accreditation_groups.name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(person.status === 'approved' || person.status === 'checked_in') && (
              <a href={`/accreditation/ticket/${person.qr_token}`} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors">
                Ticket ↗
              </a>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700 min-h-0">
          {/* LEFT: person details */}
          <div className="overflow-y-auto p-6 space-y-5">
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Voornaam</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Achternaam</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Rol</label>
                <select value={role} onChange={e => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Groep</label>
                <select value={groupId} onChange={e => setGroupId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Geen groep —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>

            {/* Zones */}
            {zones.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Toegangszones</p>
                <div className="flex flex-wrap gap-2">
                  {zones.map(z => {
                    const active = selectedZones.has(z.id)
                    return (
                      <button key={z.id} type="button" onClick={() => toggleZone(z.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'border-transparent text-white' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700'}`}
                        style={active ? { backgroundColor: z.color, borderColor: z.color } : {}}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color }} />
                        {z.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Items */}
            {itemTypes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-2">
                  {itemTypes.map(it => {
                    if (it.variants && it.variants.length > 0) {
                      return (
                        <div key={it.id}>
                          <p className="text-xs text-slate-500 mb-1">{it.name}</p>
                          <div className="flex flex-wrap gap-1">
                            {it.variants.map(v => {
                              const active = (selectedVariants[it.id] || []).includes(v)
                              return (
                                <button key={v} type="button"
                                  onClick={() => setSelectedVariants(prev => {
                                    const next = active ? [] : [v]
                                    return { ...prev, [it.id]: next }
                                  })}
                                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-blue-100 hover:text-blue-700'}`}>
                                  {v}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }
                    const qty = itemQtys[it.id] || 0
                    return (
                      <div key={it.id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-300 flex-1">{it.name}</span>
                        <button type="button" onClick={() => setItemQtys(prev => ({ ...prev, [it.id]: Math.max(0, qty - 1) }))}
                          disabled={qty === 0}
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-sm">−</button>
                        <span className="w-5 text-center text-sm font-medium text-slate-700 dark:text-slate-200">{qty}</span>
                        <button type="button" onClick={() => setItemQtys(prev => ({ ...prev, [it.id]: qty + 1 }))}
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 text-sm">+</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Interne notitie</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {/* QR token */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <p className="text-xs font-medium text-slate-400 mb-0.5">QR Token</p>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300 break-all">{person.qr_token}</p>
            </div>
          </div>

          {/* RIGHT: days & meals */}
          <div className="overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dagen &amp; maaltijden</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setValidDays(allProjectDays); setApprovedDays(new Set(allProjectDays)) }} className="text-xs text-green-600 hover:text-green-800 font-medium">Alles</button>
                <span className="text-slate-300">·</span>
                <button type="button" onClick={() => { setValidDays([]); setApprovedDays(new Set()) }} className="text-xs text-slate-400 hover:text-slate-600">Geen</button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {allProjectDays.map((day, idx) => {
                const isSelected = validDays.includes(day)
                const isApproved = approvedDays.has(day)
                const isBuild = projectBuildDays.includes(day)
                const selectedMeals = mealSelections[day] || []

                async function toggleMeal(meal: string) {
                  const cur = mealSelections[day] || []
                  const next = cur.includes(meal) ? cur.filter(m => m !== meal) : [...cur, meal]
                  const updated = { ...mealSelections, [day]: next }
                  if (next.length === 0) delete updated[day]
                  setMealSelections(updated)
                  const cleanedMeals: Record<string, string[]> = {}
                  for (const d of validDays) { if (updated[d]?.length > 0) cleanedMeals[d] = updated[d] }
                  const saved = Object.keys(cleanedMeals).length > 0 ? cleanedMeals : null
                  await updatePerson(projectId, person.id, { meal_selections: saved })
                  onUpdate({ ...person, meal_selections: saved })
                }

                return (
                  <div key={day} className={`${idx > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''} ${isApproved ? 'bg-green-50/40 dark:bg-green-900/10' : isSelected ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}>
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <input type="checkbox" checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setValidDays(prev => prev.filter(d => d !== day))
                            setApprovedDays(prev => { const n = new Set(prev); n.delete(day); return n })
                          } else {
                            setValidDays(prev => [...prev, day].sort())
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0" />
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <span className={`text-sm font-medium ${isSelected ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                          {new Date(day + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </span>
                        <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${isBuild ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-600'}`}>
                          {isBuild ? 'OB' : 'SHOW'}
                        </span>
                      </div>
                      {isSelected && (
                        <button type="button"
                          onClick={() => setApprovedDays(prev => { const n = new Set(prev); isApproved ? n.delete(day) : n.add(day); return n })}
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors shrink-0 ${isApproved ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 hover:bg-green-100 hover:text-green-700'}`}>
                          {isApproved ? '✓ Goedgekeurd' : 'Keuren'}
                        </button>
                      )}
                    </div>
                    {isSelected && (() => {
                      const availableMeals = dayMeals[day] || []
                      const availableItemIds = dayItems[day] || []
                      if (availableMeals.length === 0 && availableItemIds.length === 0) return null
                      return (
                        <div className="flex flex-col gap-1 px-11 pb-2.5">
                          {availableMeals.map(meal => {
                            const active = selectedMeals.includes(meal)
                            return (
                              <button key={meal} type="button" onClick={() => toggleMeal(meal)}
                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-left w-full ${active ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-green-100 hover:text-green-700'}`}>
                                {MEAL_LABELS[meal]}
                              </button>
                            )
                          })}
                          {availableItemIds.map(itemTypeId => {
                            const it = itemTypes.find(x => x.id === itemTypeId)
                            if (!it || !it.variants?.length) return null
                            return (
                              <div key={it.id} className="mt-0.5">
                                <p className="text-[10px] text-slate-400 mb-0.5">{it.name}</p>
                                {it.variants.map(v => {
                                  const active = (selectedVariants[it.id] || []).includes(v)
                                  return (
                                    <button key={v} type="button"
                                      onClick={async () => {
                                        const next = active ? [] : [v]
                                        const newVariants = { ...selectedVariants, [it.id]: next }
                                        setSelectedVariants(newVariants)
                                        const itemsArray: Array<{ item_type_id: string; quantity: number; selected_variant?: string | null }> = []
                                        for (const itype of itemTypes) {
                                          if (itype.variants && itype.variants.length > 0) {
                                            for (const variant of (newVariants[itype.id] || [])) {
                                              itemsArray.push({ item_type_id: itype.id, quantity: 1, selected_variant: variant })
                                            }
                                          } else {
                                            const qty = itemQtys[itype.id] || 0
                                            if (qty > 0) itemsArray.push({ item_type_id: itype.id, quantity: qty, selected_variant: null })
                                          }
                                        }
                                        const res = await setPersonItems(projectId, person.id, itemsArray)
                                        if (!res.error) onUpdate({ ...person, accreditation_person_items: itemsArray.map(i => ({ id: '', item_type_id: i.item_type_id, quantity: i.quantity, issued: false, issued_at: null, selected_variant: i.selected_variant || null })) })
                                      }}
                                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-left w-full mt-0.5 ${active ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-green-100 hover:text-green-700'}`}>
                                      {v}
                                    </button>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer — single save button */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3 shrink-0">
          <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition-colors mr-auto">Verwijderen</button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Annuleren</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors min-w-[140px]">
            {saving ? 'Opslaan...' : approvedDays.size > 0 ? `Opslaan & goedkeuren (${approvedDays.size} dag${approvedDays.size !== 1 ? 'en' : ''})` : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CSV Import Modal ──────────────────────────────────────────
interface CsvRow { first_name: string; last_name: string; email: string; role: string; group_name: string }

function CsvImportModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [rows, setRows] = useState<CsvRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importDone, setImportDone] = useState(false)

  function parseCSV(text: string) {
    // Remove BOM
    const clean = text.replace(/^\uFEFF/, '')
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) { setRows([]); return }
    const dataLines = lines.slice(1) // skip header
    const parsed: CsvRow[] = dataLines.map(line => {
      const parts = line.split(',').map(p => p.trim().replace(/^"(.*)"$/, '$1'))
      return {
        first_name: parts[0] || '',
        last_name: parts[1] || '',
        email: parts[2] || '',
        role: parts[3] || 'crew',
        group_name: parts[4] || '',
      }
    }).filter(r => r.first_name || r.last_name)
    setRows(parsed)
  }

  async function handleImport() {
    if (rows.length === 0) return
    setImporting(true); setImportError(null)
    const res = await bulkCreatePersons(projectId, rows)
    setImporting(false)
    if (res.error) { setImportError(res.error); return }
    setImportDone(true)
    setTimeout(() => { window.location.reload() }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">CSV importeren</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
            <p className="text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">Voornaam,Achternaam,Email,Rol,Groepsnaam</p>
            <p className="text-xs text-slate-400">(eerste rij = header, wordt overgeslagen)</p>
            <button
              onClick={() => {
                const csv = 'Voornaam,Achternaam,Email,Rol,Groepsnaam\nJan,de Vries,jan@bedrijf.nl,crew,Catering\nSophia,Hendriks,sophia@bedrijf.nl,artist,Artiesten'
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = 'accreditatie-template.csv'; a.click()
                URL.revokeObjectURL(url)
              }}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 underline"
            >
              Download template CSV →
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">CSV-bestand selecteren</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => parseCSV(ev.target?.result as string)
                reader.readAsText(file, 'utf-8')
              }}
              className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 cursor-pointer"
            />
          </div>
          {rows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{rows.length} personen gevonden</p>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                      {['Voornaam','Achternaam','Email','Rol','Groep'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.first_name}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.last_name}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs">{r.email}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.role}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.group_name}</td>
                      </tr>
                    ))}
                    {rows.length > 20 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-xs text-slate-400 text-center">… en {rows.length - 20} meer</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {importError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{importError}</p>}
          {importDone && <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Importeren geslaagd! Pagina wordt herladen…</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Annuleren
          </button>
          <button onClick={handleImport} disabled={rows.length === 0 || importing || importDone}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {importing ? 'Importeren...' : `${rows.length} personen importeren`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
type TabKey = 'persons' | 'groups' | 'briefings' | 'setup' | 'dashboard' | 'orders'

export function AccreditationClient({ projectId, initialPersons, initialGroups, initialZones, initialItemTypes, initialBriefings, initialBriefingAssignments, canAdmin, projectShowDays, projectBuildDays, projectDayMeals, projectDayItems, initialTab }: Props) {
  const [tab, setTabState] = useState<TabKey>((initialTab as TabKey) || 'persons')

  useEffect(() => {
    setTabState((initialTab as TabKey) || 'persons')
  }, [initialTab])

  function setTab(newTab: TabKey) {
    setTabState(newTab)
    const url = newTab === 'persons'
      ? `/project/${projectId}/accreditation`
      : `/project/${projectId}/accreditation?tab=${newTab}`
    window.history.replaceState(null, '', url)
  }
  const [persons, setPersons] = useState<Person[]>(initialPersons)
  const [groups, setGroups]   = useState<Group[]>(initialGroups)
  const [zones, setZones]     = useState<Zone[]>(initialZones)
  const [itemTypes, setItemTypes] = useState<ItemType[]>(initialItemTypes)
  const [briefings] = useState<Briefing[]>(initialBriefings)
  const [assignments, setAssignments] = useState<BriefingAssignment[]>(initialBriefingAssignments)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startT] = useTransition()
  const [showCsvImport, setShowCsvImport] = useState(false)

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRole, setFilterRole]     = useState('all')
  const [search, setSearch]             = useState('')

  // Add person form
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [newFirstName, setNewFirstName]   = useState('')
  const [newLastName, setNewLastName]     = useState('')
  const [newEmail, setNewEmail]           = useState('')
  const [newRole, setNewRole]             = useState('crew')
  const [newGroupId, setNewGroupId]       = useState('')
  const [addingPerson, setAddingPerson]   = useState(false)

  // Add group form
  const [showAddGroup, setShowAddGroup]     = useState(false)
  const [newGroupName, setNewGroupName]     = useState('')
  const [newGroupContact, setNewGroupContact] = useState('')
  const [newGroupEmail2, setNewGroupEmail2]   = useState('')
  const [newGroupType, setNewGroupType]       = useState('supplier')
  const [addingGroup, setAddingGroup]         = useState(false)
  const [copiedToken, setCopiedToken]         = useState<string | null>(null)
  // Limits editing per group: groupId → draft limits/max_persons
  const [groupLimitDraft, setGroupLimitDraft] = useState<Record<string, { limits: Record<string, number>; maxPersons: string }>>({})
  const [savingLimits, setSavingLimits]       = useState<Record<string, boolean>>({})
  // Meal config per day (project level, optimistic)
  const [dayMeals, setDayMeals] = useState<Record<string, string[]>>(projectDayMeals)
  useEffect(() => { setDayMeals(projectDayMeals) }, [projectDayMeals])
  // Item config per day (project level, optimistic)
  const [dayItems, setDayItems] = useState<Record<string, string[]>>(projectDayItems)
  useEffect(() => { setDayItems(projectDayItems) }, [projectDayItems])

  // Add zone form
  const [newZoneName, setNewZoneName]       = useState('')
  const [newZoneColor, setNewZoneColor]     = useState('#6366f1')
  const [newZoneCapacity, setNewZoneCapacity] = useState('')

  // Add item form
  const [newItemName, setNewItemName]   = useState('')
  const [newItemTotal, setNewItemTotal] = useState('')
  // Variant input per item type (item_type_id -> new variant text being typed)
  const [variantDraft, setVariantDraft] = useState<Record<string, string>>({})

  // Show days editor
  const [showDays, setShowDays] = useState<string[]>([...new Set(projectShowDays)].sort())
  useEffect(() => { setShowDays([...new Set(projectShowDays)].sort()) }, [projectShowDays])
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [savingDays, setSavingDays] = useState(false)
  // Build days editor
  const [buildDays, setBuildDays] = useState<string[]>([...new Set(projectBuildDays)].sort())
  useEffect(() => { setBuildDays([...new Set(projectBuildDays)].sort()) }, [projectBuildDays])
  const [buildRangeFrom, setBuildRangeFrom] = useState('')
  const [buildRangeTo, setBuildRangeTo] = useState('')
  const [savingBuildDays, setSavingBuildDays] = useState(false)

  const filtered = persons.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterRole !== 'all' && p.role !== filterRole) return false
    if (search && !`${p.first_name} ${p.last_name} ${p.email || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function handleAddPerson() {
    if (!newFirstName.trim() || !newLastName.trim()) { setError('Voornaam en achternaam zijn verplicht.'); return }
    setAddingPerson(true); setError(null)
    const res = await createPerson(projectId, { first_name: newFirstName, last_name: newLastName, email: newEmail, role: newRole, group_id: newGroupId || null, notes: '' })
    setAddingPerson(false)
    if (res.error) { setError(res.error); return }
    setPersons(prev => [{
      id: res.id!, first_name: newFirstName, last_name: newLastName, email: newEmail || null,
      role: newRole, status: 'draft', notes: null, qr_token: '', checked_in_at: null, checked_out_at: null,
      created_at: new Date().toISOString(), group_id: newGroupId || null,
      valid_days: null, approved_days: null, meal_selections: null,
      accreditation_groups: groups.find(g => g.id === newGroupId) ? { id: newGroupId, name: groups.find(g => g.id === newGroupId)!.name, type: groups.find(g => g.id === newGroupId)!.type } : null,
      accreditation_person_zones: [], accreditation_person_items: [],
    }, ...prev])
    setShowAddPerson(false); setNewFirstName(''); setNewLastName(''); setNewEmail(''); setNewRole('crew'); setNewGroupId('')
  }

  async function handleAddGroup() {
    if (!newGroupName.trim()) { setError('Groepsnaam is verplicht.'); return }
    setAddingGroup(true); setError(null)
    const res = await createGroup(projectId, { name: newGroupName, contact_name: newGroupContact, contact_email: newGroupEmail2, type: newGroupType })
    setAddingGroup(false)
    if (res.error) { setError(res.error); return }
    setGroups(prev => [{ id: res.id!, name: newGroupName, contact_name: newGroupContact, contact_email: newGroupEmail2, type: newGroupType, invite_token: res.token!, item_limits: {}, max_persons: null, meal_config: {} }, ...prev])
    setShowAddGroup(false); setNewGroupName(''); setNewGroupContact(''); setNewGroupEmail2(''); setNewGroupType('supplier')
  }

  async function handleAddZone() {
    if (!newZoneName.trim()) return
    const cap = newZoneCapacity ? parseInt(newZoneCapacity) : null
    const res = await createZone(projectId, newZoneName, newZoneColor, cap)
    if (res.error) { setError(res.error); return }
    setZones(prev => [...prev, { id: res.id!, name: newZoneName, color: newZoneColor, sort_order: res.sort_order ?? prev.length, capacity: cap }])
    setNewZoneName(''); setNewZoneColor('#6366f1'); setNewZoneCapacity('')
  }

  async function handleAddItem() {
    if (!newItemName.trim()) return
    const total = newItemTotal ? parseInt(newItemTotal) : null
    const res = await createItemType(projectId, newItemName, total)
    if (res.error) { setError(res.error); return }
    setItemTypes(prev => [...prev, { id: res.id!, name: newItemName, total_available: total, variants: null }])
    setNewItemName(''); setNewItemTotal('')
  }

  async function handleSaveShowDays(days: string[]) {
    const unique = [...new Set(days)].sort()
    setSavingDays(true)
    await updateProjectShowDays(projectId, unique)
    setShowDays(unique)
    setSavingDays(false)
  }

  async function handleSaveBuildDays(days: string[]) {
    const unique = [...new Set(days)].sort()
    setSavingBuildDays(true)
    await updateProjectBuildDays(projectId, unique)
    setBuildDays(unique)
    setSavingBuildDays(false)
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/accreditation/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const tabClass = (t: string) => `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-slate-900 dark:bg-slate-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`

  // Dashboard stats
  const stats = {
    total: persons.length,
    draft: persons.filter(p => p.status === 'draft').length,
    approved: persons.filter(p => p.status === 'approved').length,
    checkedIn: persons.filter(p => p.status === 'checked_in').length,
    checkedOut: persons.filter(p => p.status === 'checked_out').length,
  }

  return (
    <div className="max-w-6xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Accreditatie</h1>
        <div className="flex items-center gap-2">
          <Link href={`/project/${projectId}/accreditation/checkin`}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Check-in →
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Totaal', value: stats.total, color: 'text-slate-700 dark:text-slate-200' },
          { label: 'Concept', value: stats.draft, color: 'text-slate-500' },
          { label: 'Goedgekeurd', value: stats.approved, color: 'text-green-600 dark:text-green-400' },
          { label: 'Ingecheckt', value: stats.checkedIn, color: 'text-blue-600 dark:text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      {/* ── Persons tab ─────────────────────────────────────── */}
      {tab === 'persons' && (
        <div>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken op naam..."
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none">
              <option value="all">Alle statussen</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none">
              <option value="all">Alle rollen</option>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <span className="text-sm text-slate-400">{filtered.length} personen</span>
            {canAdmin && (
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setShowCsvImport(true)}
                  className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors border border-slate-200 dark:border-slate-600">
                  CSV importeren
                </button>
                <button onClick={() => setShowAddPerson(true)}
                  className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  + Persoon toevoegen
                </button>
              </div>
            )}
          </div>

          {/* Add person form */}
          {showAddPerson && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-300 dark:border-blue-600 p-5 mb-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">Persoon toevoegen</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Voornaam *</label>
                  <input value={newFirstName} onChange={e => setNewFirstName(e.target.value)} placeholder="Jan"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Achternaam *</label>
                  <input value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="de Vries"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">E-mail</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Rol</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none">
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Groep</label>
                  <select value={newGroupId} onChange={e => setNewGroupId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none">
                    <option value="">— Geen groep —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddPerson} disabled={addingPerson}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  {addingPerson ? 'Toevoegen...' : 'Toevoegen'}
                </button>
                <button onClick={() => { setShowAddPerson(false); setError(null) }}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors">
                  Annuleren
                </button>
              </div>
            </div>
          )}

          {/* Person list */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-slate-400">Geen personen gevonden.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map(p => {
                  const personZones = zones.filter(z => p.accreditation_person_zones.some(pz => pz.zone_id === z.id))
                  return (
                    <li key={p.id}>
                      <button onClick={() => setSelectedPerson(p)}
                        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-slate-800 dark:text-white">{fullName(p)}</span>
                            {p.accreditation_groups && (
                              <span className="text-xs text-slate-400">{p.accreditation_groups.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {personZones.map(z => (
                              <span key={z.id} className="text-xs px-1.5 py-0.5 rounded font-medium text-white" style={{ backgroundColor: z.color }}>{z.name}</span>
                            ))}
                            {p.accreditation_person_items.length > 0 && (
                              <span className="text-xs text-slate-400">{p.accreditation_person_items.length} items</span>
                            )}
                            {p.valid_days && p.valid_days.length > 0 && (
                              <span className="text-xs text-amber-600 dark:text-amber-400">{p.valid_days.length} dag{p.valid_days.length !== 1 ? 'en' : ''}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[p.role]}`}>{ROLE_LABELS[p.role]}</span>
                          {(() => {
                            const validCount = (p.valid_days || []).length
                            const approvedCount = (p.approved_days || []).length
                            const hasPartial = p.status === 'approved' && validCount > 0 && approvedCount < validCount
                            if (hasPartial) {
                              return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Actie vereist</span>
                            }
                            return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                          })()}
                          {canAdmin && p.status === 'draft' && (
                            <button onClick={async e => {
                              e.stopPropagation()
                              const res = await approvePerson(projectId, p.id)
                              if (!res.error) setPersons(prev => prev.map(x => x.id === p.id ? { ...x, status: 'approved' } : x))
                            }}
                              className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-lg font-medium transition-colors">
                              ✓ Keuren
                            </button>
                          )}
                          {(p.status === 'approved' || p.status === 'checked_in') && p.qr_token && (
                            <a
                              href={`/accreditation/ticket/${p.qr_token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="p-1 text-slate-300 hover:text-blue-500 transition-colors"
                              title="Ticket bekijken"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                              </svg>
                            </a>
                          )}
                          <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Groups tab ───────────────────────────────────────── */}
      {tab === 'groups' && (
        <div>
          {canAdmin && (
            <div className="mb-4">
              {!showAddGroup ? (
                <button onClick={() => setShowAddGroup(true)}
                  className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  + Bedrijf toevoegen
                </button>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-300 dark:border-blue-600 p-5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">Bedrijf toevoegen</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Naam *</label>
                      <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="bijv. Catering Visser"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Contactpersoon</label>
                      <input value={newGroupContact} onChange={e => setNewGroupContact(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">E-mail contact</label>
                      <input type="email" value={newGroupEmail2} onChange={e => setNewGroupEmail2(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Type</label>
                      <select value={newGroupType} onChange={e => setNewGroupType(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none">
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddGroup} disabled={addingGroup}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                      {addingGroup ? 'Aanmaken...' : 'Aanmaken + link genereren'}
                    </button>
                    <button onClick={() => { setShowAddGroup(false); setError(null) }}
                      className="px-4 py-2 text-sm text-slate-500 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      Annuleren
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {groups.length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-12 text-center">
                <p className="text-sm text-slate-400">Nog geen bedrijven aangemaakt.</p>
              </div>
            )}
            {groups.map(g => {
              const gPersons = persons.filter(p => p.group_id === g.id)
              const draftCount = gPersons.filter(p => p.status === 'draft').length
              const draft = groupLimitDraft[g.id] || { limits: g.item_limits || {}, maxPersons: g.max_persons?.toString() ?? '' }
              const isSaving = savingLimits[g.id] || false

              function setDraft(patch: Partial<typeof draft>) {
                setGroupLimitDraft(prev => ({ ...prev, [g.id]: { ...draft, ...patch } }))
              }

              async function saveLimits() {
                setSavingLimits(prev => ({ ...prev, [g.id]: true }))
                const mp = draft.maxPersons ? parseInt(draft.maxPersons) : null
                await Promise.all([
                  updateGroupItemLimits(projectId, g.id, draft.limits),
                  updateGroupMaxPersons(projectId, g.id, mp),
                ])
                setGroups(prev => prev.map(gr => gr.id === g.id ? { ...gr, item_limits: draft.limits, max_persons: mp } : gr))
                setSavingLimits(prev => ({ ...prev, [g.id]: false }))
              }

              // Compute item usage for this group
              const itemUsage: Record<string, number> = {}
              for (const p of gPersons) {
                for (const pi of (p as any).accreditation_person_items || []) {
                  itemUsage[pi.item_type_id] = (itemUsage[pi.item_type_id] || 0) + (pi.quantity || 0)
                }
              }

              return (
                <div key={g.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-start justify-between px-5 pt-4 pb-3 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800 dark:text-white text-sm">{g.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[g.type] || ROLE_COLORS.other}`}>{ROLE_LABELS[g.type] || g.type}</span>
                      </div>
                      {g.contact_name && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {g.contact_name}
                          {g.contact_email && (
                            <span> · <a href={`mailto:${g.contact_email}`} className="hover:underline">{g.contact_email}</a></span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {draftCount > 0 && canAdmin && (
                        <button onClick={async () => {
                          const res = await approveAllDraftInGroup(projectId, g.id)
                          if (!res.error) setPersons(prev => prev.map(p => p.group_id === g.id && p.status === 'draft' ? { ...p, status: 'approved' } : p))
                        }} className="text-xs px-2.5 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-medium transition-colors">
                          ✓ Alles goedkeuren ({draftCount})
                        </button>
                      )}
                      <button onClick={() => copyLink(g.invite_token)}
                        className="text-xs px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-colors">
                        {copiedToken === g.invite_token ? '✓ Gekopieerd' : 'Kopieer link'}
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 px-5 pb-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">👥</span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {gPersons.length}{g.max_persons != null ? ` / ${g.max_persons}` : ''} persoon{gPersons.length !== 1 ? 'en' : ''}
                      </span>
                      {draftCount > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-medium">
                          {draftCount} wacht{draftCount !== 1 ? 'en' : ''}
                        </span>
                      )}
                    </div>
                    {itemTypes.filter(it => g.item_limits[it.id] != null || itemUsage[it.id]).map(it => (
                      <div key={it.id} className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">{it.name}:</span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {itemUsage[it.id] || 0}{g.item_limits[it.id] != null ? `/${g.item_limits[it.id]}` : ''}
                        </span>
                        {g.item_limits[it.id] != null && (
                          <div className="w-16 h-1 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full transition-all"
                              style={{ width: `${Math.min(100, ((itemUsage[it.id] || 0) / g.item_limits[it.id]!) * 100)}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Limits editor */}
                  {canAdmin && (
                    <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-end gap-4 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400 font-medium">Max. personen</label>
                        <input
                          type="number" min={0} value={draft.maxPersons}
                          onChange={e => setDraft({ maxPersons: e.target.value })}
                          placeholder="∞"
                          className="w-20 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      {itemTypes.map(it => (
                        <div key={it.id} className="flex flex-col gap-1">
                          <label className="text-xs text-slate-400 font-medium">Max. {it.name}</label>
                          <input
                            type="number" min={0} value={draft.limits[it.id] ?? ''}
                            onChange={e => setDraft({ limits: { ...draft.limits, [it.id]: e.target.value ? parseInt(e.target.value) : 0 } })}
                            placeholder="∞"
                            className="w-20 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                      <button onClick={saveLimits} disabled={isSaving}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors self-end">
                        {isSaving ? 'Opslaan...' : 'Opslaan'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Orders tab ───────────────────────────────────────── */}
      {tab === 'orders' && (() => {
        const allDays = [...new Set([...buildDays, ...showDays])].sort()
        const hasMeals = persons.some(p => p.meal_selections && Object.keys(p.meal_selections).length > 0)

        function exportCSV() {
          const itemHeaders = itemTypes.flatMap(it =>
            it.variants && it.variants.length > 0
              ? it.variants.map(v => `${it.name}: ${v}`)
              : [it.name]
          )
          const header = ['Datum', 'Type', ...itemHeaders, ...MEALS.map(m => MEAL_LABELS[m]), 'Personen'].join(',')
          const rows = allDays.map(day => {
            const isBuild = buildDays.includes(day)
            const approvedPersons = persons.filter(p => ['approved', 'checked_in', 'checked_out'].includes(p.status))
            const dayPersons = approvedPersons.filter(p => (p.approved_days || []).includes(day))
            const itemCols = itemTypes.flatMap(it => {
              if (it.variants && it.variants.length > 0) {
                return it.variants.map(v =>
                  dayPersons.filter(p => p.accreditation_person_items.some(i => i.item_type_id === it.id && i.selected_variant === v)).length
                )
              }
              return [dayPersons.reduce((s, p) => s + (p.accreditation_person_items.find(i => i.item_type_id === it.id && !i.selected_variant)?.quantity || 0), 0)]
            })
            const mealCols = MEALS.map(meal => persons.filter(p => (p.meal_selections || {})[day]?.includes(meal)).length)
            return [day, isBuild ? 'Opbouw' : 'Show', ...itemCols, ...mealCols, dayPersons.length].join(',')
          })
          const csv = [header, ...rows].join('\n')
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = 'bestellingen.csv'; a.click()
          URL.revokeObjectURL(url)
        }

        return (
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-white">Bestellingen</h2>
                <p className="text-xs text-slate-400 mt-0.5">Totalen per dag, op basis van aangevraagde dagen</p>
              </div>
              <button onClick={exportCSV} className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                CSV ↓
              </button>
            </div>

            {allDays.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-12 text-center">
                <p className="text-sm text-slate-400">Geen projectdagen ingesteld. Voeg opbouw- of showdagen toe via Configuratie.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Datum</th>
                      {itemTypes.flatMap(it => {
                        if (it.variants && it.variants.length > 0) {
                          return it.variants.map(v => (
                            <th key={`${it.id}:${v}`} className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{it.name}: {v}</th>
                          ))
                        }
                        return [<th key={it.id} className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{it.name}</th>]
                      })}
                      {hasMeals && MEALS.map(meal => (
                        <th key={meal} className="text-right px-4 py-3 text-xs font-semibold text-orange-400 uppercase tracking-wider whitespace-nowrap">{MEAL_LABELS[meal]}</th>
                      ))}
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Personen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {allDays.map(day => {
                      const isBuild = buildDays.includes(day)
                      const approvedPersons = persons.filter(p => ['approved', 'checked_in', 'checked_out'].includes(p.status))
                      const dayPersons = approvedPersons.filter(p => (p.approved_days || []).includes(day))
                      // Also include draft (pending) persons for meal counts — they use valid_days
                      const dayDraftPersons = persons.filter(p => p.status === 'draft' && (p.valid_days || []).includes(day))
                      const hasAny = dayPersons.length > 0 || dayDraftPersons.length > 0

                      return (
                        <tr key={day} className={`${!hasAny ? 'opacity-40' : ''} hover:bg-slate-50/60 dark:hover:bg-slate-700/20`}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 dark:text-white tabular-nums">
                              {new Date(day + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                            <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${isBuild ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-600'}`}>
                              {isBuild ? 'OB' : 'SHOW'}
                            </span>
                          </td>
                          {itemTypes.flatMap(it => {
                            if (it.variants && it.variants.length > 0) {
                              return it.variants.map(v => {
                                const count = dayPersons.filter(p =>
                                  p.accreditation_person_items.some(i => i.item_type_id === it.id && i.selected_variant === v)
                                ).length
                                return (
                                  <td key={`${it.id}:${v}`} className="px-4 py-3 text-right tabular-nums">
                                    <span className={count > 0 ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-300 dark:text-slate-600'}>{count}</span>
                                  </td>
                                )
                              })
                            }
                            const qty = dayPersons.reduce((s, p) => s + (p.accreditation_person_items.find(i => i.item_type_id === it.id && !i.selected_variant)?.quantity || 0), 0)
                            return [<td key={it.id} className="px-4 py-3 text-right tabular-nums">
                              <span className={qty > 0 ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-300 dark:text-slate-600'}>{qty}</span>
                            </td>]
                          })}
                          {hasMeals && MEALS.map(meal => {
                            const approvedCount = dayPersons.filter(p => (p.meal_selections || {})[day]?.includes(meal)).length
                            const pendingCount = dayDraftPersons.filter(p => (p.meal_selections || {})[day]?.includes(meal)).length
                            const total = approvedCount + pendingCount
                            return (
                              <td key={meal} className="px-4 py-3 text-right tabular-nums">
                                {total > 0 ? (
                                  <span>
                                    <span className={approvedCount > 0 ? 'font-bold text-orange-600 dark:text-orange-400' : 'text-slate-300 dark:text-slate-600'}>{approvedCount}</span>
                                    {pendingCount > 0 && <span className="text-amber-500 font-medium text-xs"> +{pendingCount}</span>}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">0</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className={dayPersons.length > 0 ? 'font-semibold text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'}>{dayPersons.length}</span>
                            {dayDraftPersons.length > 0 && <span className="text-amber-500 text-xs font-medium"> +{dayDraftPersons.length}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Totals row */}
                  <tfoot>
                    {(() => {
                      const approvedPersons = persons.filter(p => ['approved', 'checked_in', 'checked_out'].includes(p.status))
                      return (
                        <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30">
                          <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Totaal</td>
                          {itemTypes.flatMap(it => {
                            if (it.variants && it.variants.length > 0) {
                              return it.variants.map(v => {
                                const total = allDays.reduce((sum, day) => {
                                  const dp = approvedPersons.filter(p => (p.approved_days || []).includes(day))
                                  return sum + dp.filter(p => p.accreditation_person_items.some(i => i.item_type_id === it.id && i.selected_variant === v)).length
                                }, 0)
                                return <td key={`${it.id}:${v}`} className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300 tabular-nums">{total}</td>
                              })
                            }
                            const total = allDays.reduce((sum, day) => {
                              const dp = approvedPersons.filter(p => (p.approved_days || []).includes(day))
                              return sum + dp.reduce((s, p) => s + (p.accreditation_person_items.find(i => i.item_type_id === it.id && !i.selected_variant)?.quantity || 0), 0)
                            }, 0)
                            return [<td key={it.id} className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300 tabular-nums">{total}</td>]
                          })}
                          {hasMeals && MEALS.map(meal => {
                            const total = allDays.reduce((sum, day) => {
                              const dp = approvedPersons.filter(p => (p.approved_days || []).includes(day))
                              return sum + dp.filter(p => (p.meal_selections || {})[day]?.includes(meal)).length
                            }, 0)
                            return <td key={meal} className="px-4 py-3 text-right font-bold text-orange-600 dark:text-orange-400 tabular-nums">{total}</td>
                          })}
                          <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                            {allDays.reduce((sum, day) => sum + approvedPersons.filter(p => (p.approved_days || []).includes(day)).length, 0)}
                          </td>
                        </tr>
                      )
                    })()}
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Briefings tab ────────────────────────────────────── */}
      {tab === 'briefings' && (
        <div>
          {briefings.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-12 text-center">
              <p className="text-sm text-slate-400 mb-2">Geen briefings in dit project.</p>
              <Link href={`/project/${projectId}/briefings`}
                className="text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                Ga naar Briefings →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Wijs briefings toe aan accreditatiebedrijven. Leden zien de briefing in hun portaal.</p>
              {briefings.map(b => {
                const assignedGroupIds = assignments
                  .filter(a => a.briefing_id === b.id)
                  .map(a => a.accreditation_group_id)
                return (
                  <div key={b.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Briefing header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
                      {b.cover_image_url && (
                        <img src={b.cover_image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">{b.title}</p>
                        <p className="text-xs text-slate-400">{assignedGroupIds.length} groep{assignedGroupIds.length !== 1 ? 'en' : ''} toegewezen</p>
                      </div>
                      <Link href={`/project/${projectId}/briefings/${b.id}`}
                        className="text-xs text-slate-400 hover:text-blue-500 transition-colors shrink-0">
                        Bewerken →
                      </Link>
                    </div>
                    {/* Group toggles */}
                    {groups.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-slate-400">Nog geen accreditatiebedrijven.</p>
                    ) : (
                      <div className="px-4 py-3 flex flex-wrap gap-2">
                        {groups.map(g => {
                          const assigned = assignedGroupIds.includes(g.id)
                          return (
                            <button
                              key={g.id}
                              disabled={!canAdmin}
                              onClick={async () => {
                                if (assigned) {
                                  const res = await unassignBriefingFromAccGroup(projectId, b.id, g.id)
                                  if (!res.error) setAssignments(prev => prev.filter(a => !(a.briefing_id === b.id && a.accreditation_group_id === g.id)))
                                } else {
                                  const res = await assignBriefingToAccGroup(projectId, b.id, g.id)
                                  if (!res.error) setAssignments(prev => [...prev, { briefing_id: b.id, accreditation_group_id: g.id }])
                                }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                assigned
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-500'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {assigned && <span>✓</span>}
                              {g.name}
                              <span className={`text-xs ${assigned ? 'text-blue-200' : 'text-slate-400'}`}>
                                ({ROLE_LABELS[g.type] || g.type})
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Setup tab ────────────────────────────────────────── */}
      {tab === 'setup' && (
        <div className="grid grid-cols-2 gap-6 items-start">
          {/* Zones */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Toegangszones</h3>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-3">
              {zones.length === 0 ? (
                <p className="text-xs text-slate-400 px-4 py-4">Geen zones aangemaakt.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {zones.map(z => (
                    <li key={z.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
                      <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{z.name}</span>
                      {z.capacity !== null && (
                        <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">max {z.capacity}</span>
                      )}
                      {canAdmin && (
                        <button onClick={async () => {
                          const res = await deleteZone(projectId, z.id)
                          if (!res.error) setZones(prev => prev.filter(x => x.id !== z.id))
                        }} className="text-slate-300 hover:text-red-400 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canAdmin && (
              <div className="flex gap-2">
                <input value={newZoneName} onChange={e => setNewZoneName(e.target.value)} placeholder="Zone naam"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="color" value={newZoneColor} onChange={e => setNewZoneColor(e.target.value)}
                  className="w-10 h-9 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-700" />
                <input type="number" value={newZoneCapacity} onChange={e => setNewZoneCapacity(e.target.value)} placeholder="∞"
                  className="w-16 px-2 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none" title="Capaciteit (optioneel)" />
                <button onClick={handleAddZone}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                  +
                </button>
              </div>
            )}
          </div>

          {/* Item types */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Accreditatie-items</h3>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-3">
              {itemTypes.length === 0 ? (
                <p className="text-xs text-slate-400 px-4 py-4">Geen items aangemaakt.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {itemTypes.map(it => (
                    <li key={it.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{it.name}</span>
                        {it.total_available !== null && !it.variants?.length && (
                          <span className="text-xs text-slate-400">max {it.total_available}</span>
                        )}
                        {canAdmin && (
                          <button onClick={async () => {
                            const res = await deleteItemType(projectId, it.id)
                            if (!res.error) setItemTypes(prev => prev.filter(x => x.id !== it.id))
                          }} className="text-slate-300 hover:text-red-400 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                      {/* Variant management */}
                      {canAdmin && (
                        <div className="mt-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Varianten</p>
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {(it.variants || []).map(v => (
                              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-full border border-blue-200 dark:border-blue-800">
                                {v}
                                <button type="button" onClick={async () => {
                                  const next = (it.variants || []).filter(x => x !== v)
                                  const res = await updateItemTypeVariants(projectId, it.id, next)
                                  if (!res.error) setItemTypes(prev => prev.map(x => x.id === it.id ? { ...x, variants: next.length > 0 ? next : null } : x))
                                }} className="text-blue-400 hover:text-red-500 transition-colors leading-none">
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </span>
                            ))}
                            {(!it.variants || it.variants.length === 0) && (
                              <span className="text-xs text-slate-400 italic">Geen varianten (hoeveelheid-modus)</span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <input
                              value={variantDraft[it.id] || ''}
                              onChange={e => setVariantDraft(prev => ({ ...prev, [it.id]: e.target.value }))}
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  const val = (variantDraft[it.id] || '').trim()
                                  if (!val) return
                                  const next = [...(it.variants || []), val]
                                  const res = await updateItemTypeVariants(projectId, it.id, next)
                                  if (!res.error) {
                                    setItemTypes(prev => prev.map(x => x.id === it.id ? { ...x, variants: next } : x))
                                    setVariantDraft(prev => ({ ...prev, [it.id]: '' }))
                                  }
                                }
                              }}
                              placeholder="Nieuwe variant..."
                              className="flex-1 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            <button type="button" onClick={async () => {
                              const val = (variantDraft[it.id] || '').trim()
                              if (!val) return
                              const next = [...(it.variants || []), val]
                              const res = await updateItemTypeVariants(projectId, it.id, next)
                              if (!res.error) {
                                setItemTypes(prev => prev.map(x => x.id === it.id ? { ...x, variants: next } : x))
                                setVariantDraft(prev => ({ ...prev, [it.id]: '' }))
                              }
                            }} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors">
                              Toevoegen
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canAdmin && (
              <div className="flex gap-2">
                <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Item naam"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={newItemTotal} onChange={e => setNewItemTotal(e.target.value)} placeholder="Max"
                  className="w-16 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none" />
                <button onClick={handleAddItem}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                  +
                </button>
              </div>
            )}
          </div>

          {/* Build days */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">OB</span>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Opbouwdagen</h3>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Dagen waarop opbouw plaatsvindt. Zichtbaar als "OB" in het portaal.</p>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-3">
              {buildDays.length === 0 ? (
                <p className="text-xs text-slate-400 px-4 py-4">Geen opbouwdagen ingesteld.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {buildDays.map(day => (
                    <li key={day} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-56 text-sm text-slate-700 dark:text-slate-300 shrink-0">
                        {new Date(day + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      {canAdmin && (
                        <div className="flex items-center gap-3 flex-1 flex-wrap">
                          {MEALS.map(meal => {
                            const active = (dayMeals[day] || []).includes(meal)
                            return (
                              <button key={meal} onClick={async () => {
                                const current = dayMeals[day] || []
                                const next = active ? current.filter(m => m !== meal) : [...current, meal]
                                const updated = { ...dayMeals, [day]: next }
                                if (next.length === 0) delete updated[day]
                                setDayMeals(updated)
                                // Optimistically clean up persons whose meal selections contain removed meals
                                setPersons(prev => prev.map(p => {
                                  const sel = p.meal_selections
                                  if (!sel) return p
                                  const cleaned: Record<string, string[]> = {}
                                  for (const [d, meals] of Object.entries(sel)) {
                                    const allowed = updated[d] || []
                                    if (allowed.length === 0) continue
                                    const filtered = meals.filter(m => allowed.includes(m))
                                    if (filtered.length > 0) cleaned[d] = filtered
                                  }
                                  const newSel = Object.keys(cleaned).length > 0 ? cleaned : null
                                  return { ...p, meal_selections: newSel }
                                }))
                                await updateProjectDayMeals(projectId, updated)
                              }} className={`text-xs px-2 py-0.5 rounded border transition-colors ${active ? 'bg-green-500 border-green-500 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:border-green-400 hover:text-green-600'}`}>
                                {MEAL_LABELS[meal]}
                              </button>
                            )
                          })}
                          {itemTypes.length > 0 && itemTypes.map(it => {
                            const active = (dayItems[day] || []).includes(it.id)
                            return (
                              <button key={it.id} onClick={async () => {
                                const current = dayItems[day] || []
                                const next = active ? current.filter(id => id !== it.id) : [...current, it.id]
                                const updated = { ...dayItems, [day]: next }
                                if (next.length === 0) delete updated[day]
                                setDayItems(updated)
                                await updateProjectDayItems(projectId, updated)
                              }} className={`text-xs px-2 py-0.5 rounded border transition-colors ${active ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:border-blue-400 hover:text-blue-600'}`}>
                                {it.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      <span className="text-xs font-mono text-slate-400">{day}</span>
                      {canAdmin && (
                        <button onClick={async () => {
                          const updated = buildDays.filter(d => d !== day)
                          setBuildDays(updated)
                          await handleSaveBuildDays(updated)
                        }} className="text-slate-300 hover:text-red-400 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canAdmin && (
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Van</label>
                  <input type="date" value={buildRangeFrom} onChange={e => setBuildRangeFrom(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Tot en met</label>
                  <input type="date" value={buildRangeTo} onChange={e => setBuildRangeTo(e.target.value)} min={buildRangeFrom || undefined}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button
                  onClick={async () => {
                    if (!buildRangeFrom || !buildRangeTo || buildRangeTo < buildRangeFrom) return
                    const days: string[] = []
                    const cur = new Date(buildRangeFrom + 'T12:00:00')
                    const end = new Date(buildRangeTo + 'T12:00:00')
                    while (cur <= end) { days.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
                    const updated = [...new Set([...buildDays, ...days])].sort()
                    setBuildDays(updated); setBuildRangeFrom(''); setBuildRangeTo('')
                    await handleSaveBuildDays(updated)
                  }}
                  disabled={!buildRangeFrom || !buildRangeTo || buildRangeTo < buildRangeFrom || savingBuildDays}
                  className="px-3 py-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors self-end">
                  {savingBuildDays ? '...' : '+ Opbouwdagen toevoegen'}
                </button>
              </div>
            )}
          </div>

          {/* Show days */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">SHOW</span>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Showdagen</h3>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">De daadwerkelijke showdagen. Zichtbaar als "SHOW" in het portaal.</p>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-3">
              {showDays.length === 0 ? (
                <p className="text-xs text-slate-400 px-4 py-4">Geen showdagen ingesteld.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {showDays.map(day => (
                    <li key={day} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-56 text-sm text-slate-700 dark:text-slate-300 shrink-0">
                        {new Date(day + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      {canAdmin && (
                        <div className="flex items-center gap-3 flex-1 flex-wrap">
                          {MEALS.map(meal => {
                            const active = (dayMeals[day] || []).includes(meal)
                            return (
                              <button key={meal} onClick={async () => {
                                const current = dayMeals[day] || []
                                const next = active ? current.filter(m => m !== meal) : [...current, meal]
                                const updated = { ...dayMeals, [day]: next }
                                if (next.length === 0) delete updated[day]
                                setDayMeals(updated)
                                // Optimistically clean up persons whose meal selections contain removed meals
                                setPersons(prev => prev.map(p => {
                                  const sel = p.meal_selections
                                  if (!sel) return p
                                  const cleaned: Record<string, string[]> = {}
                                  for (const [d, meals] of Object.entries(sel)) {
                                    const allowed = updated[d] || []
                                    if (allowed.length === 0) continue
                                    const filtered = meals.filter(m => allowed.includes(m))
                                    if (filtered.length > 0) cleaned[d] = filtered
                                  }
                                  const newSel = Object.keys(cleaned).length > 0 ? cleaned : null
                                  return { ...p, meal_selections: newSel }
                                }))
                                await updateProjectDayMeals(projectId, updated)
                              }} className={`text-xs px-2 py-0.5 rounded border transition-colors ${active ? 'bg-green-500 border-green-500 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:border-green-400 hover:text-green-600'}`}>
                                {MEAL_LABELS[meal]}
                              </button>
                            )
                          })}
                          {itemTypes.length > 0 && itemTypes.map(it => {
                            const active = (dayItems[day] || []).includes(it.id)
                            return (
                              <button key={it.id} onClick={async () => {
                                const current = dayItems[day] || []
                                const next = active ? current.filter(id => id !== it.id) : [...current, it.id]
                                const updated = { ...dayItems, [day]: next }
                                if (next.length === 0) delete updated[day]
                                setDayItems(updated)
                                await updateProjectDayItems(projectId, updated)
                              }} className={`text-xs px-2 py-0.5 rounded border transition-colors ${active ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:border-blue-400 hover:text-blue-600'}`}>
                                {it.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      <span className="text-xs font-mono text-slate-400">{day}</span>
                      {canAdmin && (
                        <button onClick={async () => {
                          const updated = showDays.filter(d => d !== day)
                          setShowDays(updated)
                          await handleSaveShowDays(updated)
                        }} className="text-slate-300 hover:text-red-400 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canAdmin && (
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Van</label>
                  <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Tot en met</label>
                  <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} min={rangeFrom || undefined}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button
                  onClick={async () => {
                    if (!rangeFrom || !rangeTo || rangeTo < rangeFrom) return
                    const days: string[] = []
                    const cur = new Date(rangeFrom + 'T12:00:00')
                    const end = new Date(rangeTo + 'T12:00:00')
                    while (cur <= end) { days.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
                    const updated = [...new Set([...showDays, ...days])].sort()
                    setShowDays(updated); setRangeFrom(''); setRangeTo('')
                    await handleSaveShowDays(updated)
                  }}
                  disabled={!rangeFrom || !rangeTo || rangeTo < rangeFrom || savingDays}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors self-end">
                  {savingDays ? '...' : '+ Showdagen toevoegen'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dashboard tab ────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Role breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Per rol</h3>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Concept</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Goedgekeurd</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingecheckt</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Totaal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {ROLES.map(role => {
                    const rp = persons.filter(p => p.role === role)
                    if (rp.length === 0) return null
                    return (
                      <tr key={role}>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span></td>
                        <td className="px-4 py-3 text-right text-slate-500">{rp.filter(p => p.status === 'draft').length}</td>
                        <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{rp.filter(p => p.status === 'approved').length}</td>
                        <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">{rp.filter(p => p.status === 'checked_in').length}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{rp.length}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Item tracker */}
          {itemTypes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Item tracker</h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Item</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Toegewezen</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Uitgegeven</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Beschikbaar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {itemTypes.map(it => {
                      const allItems = persons.flatMap(p => p.accreditation_person_items.filter(i => i.item_type_id === it.id))
                      const assigned = allItems.reduce((s, i) => s + i.quantity, 0)
                      const issued = allItems.filter(i => i.issued).reduce((s, i) => s + i.quantity, 0)
                      const remaining = it.total_available !== null ? it.total_available - assigned : null
                      return (
                        <tr key={it.id}>
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{it.name}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{assigned}{it.total_available !== null ? ` / ${it.total_available}` : ''}</td>
                          <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{issued}</td>
                          <td className={`px-4 py-3 text-right font-medium ${remaining !== null && remaining < 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                            {remaining !== null ? remaining : '∞'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Person modal */}
      {selectedPerson && (
        <PersonPanel
          person={selectedPerson}
          zones={zones}
          itemTypes={itemTypes}
          groups={groups}
          projectId={projectId}
          projectShowDays={showDays}
          projectBuildDays={buildDays}
          dayMeals={dayMeals}
          dayItems={dayItems}
          onClose={() => setSelectedPerson(null)}
          onUpdate={updated => {
            setPersons(prev => prev.map(p => p.id === updated.id ? updated : p))
            setSelectedPerson(updated)
          }}
        />
      )}

      {/* CSV Import modal */}
      {showCsvImport && (
        <CsvImportModal projectId={projectId} onClose={() => setShowCsvImport(false)} />
      )}
    </div>
  )
}
