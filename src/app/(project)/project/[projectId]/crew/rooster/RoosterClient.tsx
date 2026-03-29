'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from '@/lib/i18n/LanguageContext'
import { createShift, updateShift, deleteShift, assignMemberToShift, removeMemberFromShift } from '@/lib/actions/shift.actions'

// ── Types ──────────────────────────────────────────────────────
interface ShiftMember {
  id: string; first_name: string; last_name: string
  crew_companies: { name: string } | null
}
interface ShiftAssignment { crew_member_id: string; crew_members: ShiftMember | null }
interface Shift {
  id: string; title: string; work_date: string
  start_time: string; end_time: string
  max_slots: number | null; notes: string | null
  crew_shift_assignments: ShiftAssignment[]
}
interface CrewMember {
  id: string; first_name: string; last_name: string
  crew_companies: { name: string } | null
}

interface Props {
  projectId: string
  initialShifts: Shift[]
  crewMembers: CrewMember[]
  canAdmin: boolean
}

const EMPTY_FORM = { title: '', work_date: '', start_time: '08:00', end_time: '17:00', max_slots: '', notes: '' }

export function RoosterClient({ projectId, initialShifts, crewMembers, canAdmin }: Props) {
  const T = useTranslations()
  const [, startTransition] = useTransition()

  const [shifts, setShifts]     = useState<Shift[]>(initialShifts)
  const [error, setError]       = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [openShiftId, setOpenShiftId] = useState<string | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Group shifts by date
  const byDate = shifts.reduce<Record<string, Shift[]>>((acc, s) => {
    if (!acc[s.work_date]) acc[s.work_date] = []
    acc[s.work_date].push(s)
    return acc
  }, {})
  const sortedDates = Object.keys(byDate).sort()

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  function formatTime(t: string) { return t.slice(0, 5) }

  async function handleCreateShift() {
    if (!form.title || !form.work_date || !form.start_time || !form.end_time) return
    setSaving(true)
    const res = await createShift(projectId, {
      title: form.title, work_date: form.work_date,
      start_time: form.start_time, end_time: form.end_time,
      max_slots: form.max_slots ? parseInt(form.max_slots) : null,
      notes: form.notes || null,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    const newShift: Shift = { id: res.id!, title: form.title, work_date: form.work_date, start_time: form.start_time, end_time: form.end_time, max_slots: form.max_slots ? parseInt(form.max_slots) : null, notes: form.notes || null, crew_shift_assignments: [] }
    setShifts(prev => [...prev, newShift].sort((a, b) => a.work_date.localeCompare(b.work_date) || a.start_time.localeCompare(b.start_time)))
    setForm(EMPTY_FORM); setShowCreate(false)
  }

  async function handleUpdateShift(shiftId: string) {
    setSaving(true)
    const res = await updateShift(projectId, shiftId, {
      title: form.title, work_date: form.work_date,
      start_time: form.start_time, end_time: form.end_time,
      max_slots: form.max_slots ? parseInt(form.max_slots) : null,
      notes: form.notes || null,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, title: form.title, work_date: form.work_date, start_time: form.start_time, end_time: form.end_time, max_slots: form.max_slots ? parseInt(form.max_slots) : null, notes: form.notes || null } : s))
    setEditingId(null); setForm(EMPTY_FORM)
  }

  function startEdit(shift: Shift) {
    setForm({ title: shift.title, work_date: shift.work_date, start_time: shift.start_time.slice(0, 5), end_time: shift.end_time.slice(0, 5), max_slots: shift.max_slots ? String(shift.max_slots) : '', notes: shift.notes || '' })
    setEditingId(shift.id)
  }

  function handleDeleteShift(shiftId: string) {
    if (!confirm(T.crew.rooster.confirmDelete)) return
    startTransition(async () => {
      const res = await deleteShift(projectId, shiftId)
      if (res.error) { setError(res.error); return }
      setShifts(prev => prev.filter(s => s.id !== shiftId))
    })
  }

  function toggleMember(shiftId: string, memberId: string, isAssigned: boolean) {
    startTransition(async () => {
      const res = isAssigned
        ? await removeMemberFromShift(projectId, shiftId, memberId)
        : await assignMemberToShift(projectId, shiftId, memberId)
      if (res.error) { setError(res.error); return }
      setShifts(prev => prev.map(s => {
        if (s.id !== shiftId) return s
        const member = crewMembers.find(m => m.id === memberId)
        if (isAssigned) {
          return { ...s, crew_shift_assignments: s.crew_shift_assignments.filter(a => a.crew_member_id !== memberId) }
        } else {
          return { ...s, crew_shift_assignments: [...s.crew_shift_assignments, { crew_member_id: memberId, crew_members: { id: memberId, first_name: member!.first_name, last_name: member!.last_name, crew_companies: member!.crew_companies } }] }
        }
      }))
    })
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="max-w-4xl w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.crew.rooster.title}</h1>
        {canAdmin && (
          <button onClick={() => { setShowCreate(v => !v); setEditingId(null) }}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            + {T.crew.rooster.newShift}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>
      )}

      {/* Create form */}
      {showCreate && canAdmin && (
        <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-white mb-4">{T.crew.rooster.newShift}</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.shiftTitle} *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} placeholder="bijv. Security" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.date} *</label>
              <input type="date" value={form.work_date} onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.startTime}</label>
                <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.endTime}</label>
                <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.maxSlots}</label>
              <input type="number" value={form.max_slots} onChange={e => setForm(f => ({ ...f, max_slots: e.target.value }))} placeholder={T.crew.rooster.maxSlotsPlaceholder} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.notes}</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateShift} disabled={saving || !form.title || !form.work_date}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              {saving ? T.common.saving : T.common.add}
            </button>
            <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM) }}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              {T.common.cancel}
            </button>
          </div>
        </div>
      )}

      {shifts.length === 0 && !showCreate ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-8 py-14 text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{T.crew.rooster.noShifts}</p>
          <p className="text-xs text-slate-400">{T.crew.rooster.noShiftsDesc}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">{formatDate(date)}</h2>
              <div className="space-y-3">
                {byDate[date].map(shift => {
                  const assignedIds = new Set(shift.crew_shift_assignments.map(a => a.crew_member_id))
                  const filledCount = assignedIds.size
                  const isOpen = openShiftId === shift.id
                  const isEditing = editingId === shift.id

                  if (isEditing) return (
                    <div key={shift.id} className="bg-white dark:bg-slate-800 rounded-xl border border-blue-300 dark:border-blue-600 p-5">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.shiftTitle}</label>
                          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.date}</label>
                          <input type="date" value={form.work_date} onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))} className={inputClass} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.startTime}</label>
                            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.endTime}</label>
                            <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={inputClass} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.maxSlots}</label>
                          <input type="number" value={form.max_slots} onChange={e => setForm(f => ({ ...f, max_slots: e.target.value }))} placeholder={T.crew.rooster.maxSlotsPlaceholder} className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">{T.crew.rooster.notes}</label>
                          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateShift(shift.id)} disabled={saving}
                          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">{saving ? T.common.saving : T.common.save ?? 'Opslaan'}</button>
                        <button onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}
                          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">{T.common.cancel}</button>
                      </div>
                    </div>
                  )

                  return (
                    <div key={shift.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {/* Shift header */}
                      <div className="flex items-center gap-3 px-5 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white">{shift.title}</span>
                            <span className="text-xs text-slate-400 font-mono">{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</span>
                            {shift.max_slots && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                filledCount >= shift.max_slots ? 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                              }`}>
                                {filledCount}/{shift.max_slots} {T.crew.rooster.slots}
                              </span>
                            )}
                            {!shift.max_slots && filledCount > 0 && (
                              <span className="text-xs text-slate-400">{filledCount} {T.crew.rooster.filled}</span>
                            )}
                          </div>
                          {shift.notes && <p className="text-xs text-slate-400 mt-0.5">{shift.notes}</p>}
                        </div>
                        {canAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => startEdit(shift)}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => setOpenShiftId(isOpen ? null : shift.id)}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                              title={T.crew.rooster.assignMembers}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                            </button>
                            <button onClick={() => handleDeleteShift(shift.id)}
                              className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Assigned members chips */}
                      {filledCount > 0 && (
                        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                          {shift.crew_shift_assignments.map(a => a.crew_members && (
                            <span key={a.crew_member_id} className="flex items-center gap-1 text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full">
                              {a.crew_members.first_name} {a.crew_members.last_name}
                              {canAdmin && (
                                <button onClick={() => toggleMember(shift.id, a.crew_member_id, true)}
                                  className="text-slate-400 hover:text-red-400 transition-colors ml-0.5">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Member picker */}
                      {isOpen && canAdmin && (
                        <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{T.crew.rooster.assignMembers}</p>
                          {crewMembers.length === 0 ? (
                            <p className="text-xs text-slate-400">{T.crew.rooster.noMembers}</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {crewMembers.map(m => {
                                const isAssigned = assignedIds.has(m.id)
                                return (
                                  <button key={m.id} onClick={() => toggleMember(shift.id, m.id, isAssigned)}
                                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                                      isAssigned
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-400'
                                    }`}>
                                    {m.first_name} {m.last_name}
                                    {m.crew_companies && <span className="opacity-60 ml-1">({m.crew_companies.name})</span>}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
