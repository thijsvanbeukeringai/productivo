'use client'

import { useState, useEffect, useRef } from 'react'
import { getReminders, createReminder, snoozeReminder, dismissReminder } from '@/lib/actions/reminder.actions'

interface Reminder {
  id: string
  title: string
  remind_at: string
  is_done: boolean
}

interface Props {
  projectId: string
}

export function ReminderManager({ projectId }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dueReminder, setDueReminder] = useState<Reminder | null>(null)
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [saving, setSaving] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Load reminders on mount
  useEffect(() => {
    getReminders(projectId).then(({ data }) => {
      if (data) setReminders(data as Reminder[])
    })
  }, [projectId])

  // Check every 30 seconds if any reminder is due
  useEffect(() => {
    function check() {
      const now = Date.now()
      const due = reminders.find(r => !r.is_done && new Date(r.remind_at).getTime() <= now)
      if (due && (!dueReminder || dueReminder.id !== due.id)) {
        setDueReminder(due)
      }
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [reminders, dueReminder])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !remindAt) return
    setSaving(true)
    const { data } = await createReminder(projectId, title.trim(), new Date(remindAt).toISOString())
    if (data) {
      setReminders(prev => [...prev, data as Reminder].sort(
        (a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
      ))
      setTitle('')
      setRemindAt('')
      setShowCreate(false)
    }
    setSaving(false)
  }

  async function handleSnooze() {
    if (!dueReminder) return
    const snoozeUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    await snoozeReminder(dueReminder.id)
    setReminders(prev =>
      prev.map(r => r.id === dueReminder.id ? { ...r, remind_at: snoozeUntil } : r)
    )
    setDueReminder(null)
  }

  async function handleDismiss() {
    if (!dueReminder) return
    await dismissReminder(dueReminder.id)
    setReminders(prev => prev.filter(r => r.id !== dueReminder.id))
    setDueReminder(null)
  }

  async function handleDismissFromList(id: string) {
    await dismissReminder(id)
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  const activeCount = reminders.length

  // Default remind_at to now+1h in local datetime-local format
  function defaultRemindAt() {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16)
  }

  return (
    <>
      {/* Due reminder popup */}
      {dueReminder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-80 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Herinnering</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">{dueReminder.title}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSnooze}
                className="flex-1 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
              >
                Sluimer 5 min
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Stoppen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bell icon button */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen(prev => !prev)}
          className="relative p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          title="Herinneringen"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Herinneringen</span>
              <button
                onClick={() => { setShowCreate(true); setRemindAt(defaultRemindAt()) }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                + Nieuwe
              </button>
            </div>

            {showCreate && (
              <form onSubmit={handleCreate} className="p-3 border-b border-slate-100 dark:border-slate-700 space-y-2">
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Omschrijving..."
                  required
                  className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="datetime-local"
                  value={remindAt}
                  onChange={e => setRemindAt(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg">
                    Annuleren
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50">
                    {saving ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </div>
              </form>
            )}

            {reminders.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Geen actieve herinneringen</p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700">
                {reminders.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2.5 gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{r.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(r.remind_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDismissFromList(r.id)}
                      className="shrink-0 text-slate-300 hover:text-red-500 transition-colors"
                      title="Verwijderen"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
