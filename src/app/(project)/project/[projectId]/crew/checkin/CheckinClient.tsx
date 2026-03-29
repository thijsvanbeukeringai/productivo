'use client'

import { useState, useTransition, useRef } from 'react'
import { adminToggleCheckin, adminCheckinByMemberId } from '@/lib/actions/crew.actions'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Wristband {
  id: string
  name: string
  color: string
}

interface PlanningRow {
  id: string
  work_date: string
  lunch: boolean
  diner: boolean
  night_snack: boolean
  parking_card: boolean
  walkie_talkie_type: string | null
  status: string
  checked_in: boolean
  checked_in_at: string | null
  crew_members: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    parking_ticket: string | null
    wristband_id: string | null
    wristbands: Wristband | null
    crew_companies: {
      id: string
      name: string
    } | null
  } | null
}

interface Props {
  projectId: string
  planningRows: PlanningRow[]
  wristbands: Wristband[]
  canAdmin: boolean
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

type ScanState = 'idle' | 'success' | 'already' | 'error'

export function CheckinClient({ projectId, planningRows: initial, wristbands, canAdmin }: Props) {
  const T = useTranslations()
  const [rows, setRows] = useState<PlanningRow[]>(initial)
  const [selectedDate, setSelectedDate] = useState<string>(todayDate())
  const [allDays, setAllDays] = useState(false)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // QR scan state
  const [scanValue, setScanValue] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scanMessage, setScanMessage] = useState('')
  const [scanPending, setScanPending] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)

  // All unique dates in the data
  const availableDates = Array.from(new Set(rows.map(r => r.work_date))).sort()

  const filtered = allDays
    ? rows
    : rows.filter(r => r.work_date === selectedDate)

  const checkedInCount = filtered.filter(r => r.checked_in).length

  function handleToggle(rowId: string, current: boolean) {
    if (!canAdmin) return
    startTransition(async () => {
      const res = await adminToggleCheckin(projectId, rowId, !current)
      if (res.error) { setError(res.error); return }
      const now = new Date().toISOString()
      setRows(prev => prev.map(r =>
        r.id !== rowId ? r : { ...r, checked_in: !current, checked_in_at: !current ? now : null }
      ))
    })
  }

  async function handleScan(value: string) {
    const memberId = value.trim()
    if (!memberId) return
    setScanPending(true)
    setScanState('idle')
    setScanMessage('')

    const dateToUse = allDays ? todayDate() : selectedDate
    const res = await adminCheckinByMemberId(projectId, memberId, dateToUse)
    setScanPending(false)

    if (res.error) {
      setScanState('error')
      setScanMessage(res.error)
    } else if (res.alreadyCheckedIn) {
      setScanState('already')
      // Find the member name
      const row = rows.find(r => r.crew_members?.id === memberId && r.work_date === dateToUse)
      const name = row ? `${row.crew_members?.first_name} ${row.crew_members?.last_name}` : memberId.slice(0, 8)
      setScanMessage(`${name} — ${T.crew.checkin.alreadyCheckedIn}`)
    } else if (res.success && res.planningId) {
      setScanState('success')
      const now = new Date().toISOString()
      setRows(prev => prev.map(r =>
        r.id !== res.planningId ? r : { ...r, checked_in: true, checked_in_at: now }
      ))
      const row = rows.find(r => r.id === res.planningId)
      const name = row ? `${row.crew_members?.first_name} ${row.crew_members?.last_name}` : ''
      setScanMessage(name ? `✓ ${name}` : '✓')
    }

    setScanValue('')
    // Reset feedback after 3 seconds
    setTimeout(() => { setScanState('idle'); setScanMessage('') }, 3000)
    scanInputRef.current?.focus()
  }

  // Group by company name for display
  const grouped = filtered.reduce<Record<string, PlanningRow[]>>((acc, row) => {
    const name = row.crew_members?.crew_companies?.name || T.common.unknown
    if (!acc[name]) acc[name] = []
    acc[name].push(row)
    return acc
  }, {})

  return (
    <div className="max-w-4xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.crew.checkin.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {checkedInCount} / {filtered.length} {T.crew.checkin.checkedIn}
          </p>
        </div>
      </div>

      {/* QR scan field */}
      {canAdmin && (
        <div className="mb-5">
          <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            scanState === 'success' ? 'border-green-400 bg-green-50 dark:bg-green-950/20' :
            scanState === 'already' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' :
            scanState === 'error' ? 'border-red-400 bg-red-50 dark:bg-red-950/20' :
            'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
          }`}>
            <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
            <input
              ref={scanInputRef}
              type="text"
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleScan(scanValue) }}
              placeholder={T.crew.checkin.scanPlaceholder}
              disabled={scanPending}
              className="flex-1 bg-transparent text-sm text-slate-800 dark:text-white placeholder-slate-400 outline-none"
              autoFocus
            />
            {scanPending && (
              <svg className="w-4 h-4 animate-spin text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {scanMessage && (
              <span className={`text-xs font-medium shrink-0 ${
                scanState === 'success' ? 'text-green-700 dark:text-green-400' :
                scanState === 'already' ? 'text-amber-700 dark:text-amber-400' :
                'text-red-700 dark:text-red-400'
              }`}>{scanMessage}</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Date filter */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => { setAllDays(false); setSelectedDate(todayDate()) }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !allDays && selectedDate === todayDate()
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {T.crew.checkin.today}
        </button>

        {availableDates.filter(d => d !== todayDate()).map(d => (
          <button
            key={d}
            onClick={() => { setAllDays(false); setSelectedDate(d) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !allDays && selectedDate === d
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </button>
        ))}

        <button
          onClick={() => setAllDays(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            allDays
              ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {T.crew.checkin.allDays}
        </button>
      </div>

      {!allDays && (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
          {formatDay(selectedDate)}
        </p>
      )}

      {filtered.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-10 text-center">
          <p className="text-slate-400 text-sm">{T.crew.checkin.noApproved}</p>
        </div>
      )}

      {/* Grouped by company */}
      {Object.entries(grouped).map(([companyName, companyRows]) => (
        <div key={companyName} className="mb-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{companyName}</h2>
            <span className="text-xs text-slate-400">
              {companyRows.filter(r => r.checked_in).length}/{companyRows.length} {T.crew.checkin.checkedIn}
            </span>
          </div>

          <ul className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {companyRows
              .sort((a, b) => {
                const nameA = `${a.crew_members?.last_name} ${a.crew_members?.first_name}`
                const nameB = `${b.crew_members?.last_name} ${b.crew_members?.first_name}`
                return nameA.localeCompare(nameB)
              })
              .map(row => {
                const m = row.crew_members
                if (!m) return null
                return (
                  <li key={row.id} className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                    row.checked_in ? 'bg-green-50/50 dark:bg-green-950/10' : ''
                  }`}>
                    {/* Check-in toggle */}
                    <button
                      onClick={() => handleToggle(row.id, row.checked_in)}
                      disabled={!canAdmin}
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        row.checked_in
                          ? 'bg-green-500 text-white'
                          : 'border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-green-400'
                      } ${!canAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                      title={row.checked_in ? T.crew.checkin.checkedInTooltip : T.crew.checkin.checkInTooltip}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>

                    {/* Name + info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${row.checked_in ? 'text-green-800 dark:text-green-300' : 'text-slate-800 dark:text-white'}`}>
                          {m.first_name} {m.last_name}
                        </p>
                        {/* Wristband badge */}
                        {m.wristbands && (
                          <span className="flex items-center gap-1">
                            <span
                              className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                              style={{ backgroundColor: m.wristbands.color }}
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400">{m.wristbands.name}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {m.phone && <span className="text-xs text-slate-400">{m.phone}</span>}
                        {m.parking_ticket && <span className="text-xs text-blue-500">P: {m.parking_ticket}</span>}
                        {row.checked_in && row.checked_in_at && (
                          <span className="text-xs text-green-600 dark:text-green-400">✓ {formatTime(row.checked_in_at)}</span>
                        )}
                      </div>
                    </div>

                    {/* Meal badges */}
                    <div className="flex flex-wrap gap-1 justify-end">
                      {allDays && (
                        <span className="text-xs text-slate-400 mr-1">
                          {new Date(row.work_date + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {row.lunch && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">L</span>}
                      {row.diner && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">D</span>}
                      {row.night_snack && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">N</span>}
                      {row.parking_card && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">P</span>}
                      {row.walkie_talkie_type && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded" title={
                        row.walkie_talkie_type === 'inear' ? T.crew.walkieInear :
                        row.walkie_talkie_type === 'spreeksleutel' ? T.crew.walkieSpreeksleutel :
                        T.crew.walkieHeavyDuty
                      }>W</span>}
                    </div>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </div>
  )
}
