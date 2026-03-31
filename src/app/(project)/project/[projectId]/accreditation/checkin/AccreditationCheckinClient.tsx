'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { checkInByQrToken, checkOutPerson, markItemIssued } from '@/lib/actions/accreditation.actions'
import { createClient } from '@/lib/supabase/client'

interface Zone { id: string; name: string; color: string; capacity: number | null }
interface PersonZone { zone_id: string; accreditation_zones: { name: string; color: string } | null }
interface ItemType { name: string }
interface PersonItem { id: string; quantity: number; issued: boolean; accreditation_item_types: ItemType | null }
interface Person {
  id: string; first_name: string; last_name: string; email: string | null
  role: string; status: string; qr_token: string; checked_in_at: string | null; checked_out_at: string | null
  accreditation_groups: { name: string } | null
  accreditation_person_zones: PersonZone[]
  accreditation_person_items: PersonItem[]
}

interface CheckinItem {
  id: string
  item_type_id: string
  quantity: number
  issued: boolean
  issued_at: string | null
  accreditation_item_types: { name: string } | null
}

interface ScanLogEntry {
  id: string
  qr_token: string
  success: boolean
  action: string
  message: string | null
  scanned_at: string
  person_id: string | null
  accreditation_persons: { first_name: string; last_name: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  crew: 'Crew', artist: 'Artiest', guest: 'Gast', supplier: 'Leverancier',
  press: 'Pers', vip: 'VIP', other: 'Overig'
}

type ScanState = 'idle' | 'success' | 'already' | 'error' | 'notapproved'

export function AccreditationCheckinClient({
  projectId, initialPersons, initialZones, initialScanLog,
}: {
  projectId: string
  initialPersons: Person[]
  initialZones: Zone[]
  initialScanLog: ScanLogEntry[]
}) {
  const [persons, setPersons] = useState<Person[]>(initialPersons)

  // Realtime: pick up check-in/out changes from other devices
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`accreditation-persons-${projectId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'accreditation_persons',
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        setPersons(prev => prev.map(p =>
          p.id === payload.new.id
            ? { ...p, status: payload.new.status, checked_in_at: payload.new.checked_in_at, checked_out_at: payload.new.checked_out_at }
            : p
        ))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  const [scanInput, setScanInput] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scanResult, setScanResult] = useState<Person | null>(null)
  const [scanMsg, setScanMsg] = useState('')
  const [search, setSearch] = useState('')
  const [scanItems, setScanItems] = useState<CheckinItem[]>([])
  const [issuedState, setIssuedState] = useState<Record<string, boolean>>({})
  const scanRef = useRef<HTMLInputElement>(null)
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>(initialScanLog)
  const [showScanLog, setShowScanLog] = useState(false)

  const filtered = persons.filter(p =>
    `${p.first_name} ${p.last_name} ${p.email || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  // Zone occupancy
  const zoneOccupancy: Record<string, number> = {}
  for (const p of persons) {
    if (p.status === 'checked_in') {
      for (const pz of p.accreditation_person_zones) {
        zoneOccupancy[pz.zone_id] = (zoneOccupancy[pz.zone_id] || 0) + 1
      }
    }
  }
  const zonesWithCapacity = initialZones.filter(z => z.capacity !== null)

  async function handleScan(value: string) {
    const token = value.trim()
    if (!token) return
    setScanInput(''); setScanMsg('')
    setScanItems([]); setIssuedState({})
    const res = await checkInByQrToken(projectId, token)
    if (res.error) {
      setScanState(res.error.includes('goedgekeurd') ? 'notapproved' : 'error')
      setScanMsg(res.error); setScanResult(null)
      // add to log optimistically
      setScanLog(prev => [{
        id: crypto.randomUUID(),
        qr_token: token,
        success: false,
        action: 'checkin',
        message: res.error ?? null,
        scanned_at: new Date().toISOString(),
        person_id: null,
        accreditation_persons: null,
      }, ...prev].slice(0, 50))
      return
    }
    const items = (res.items || []) as CheckinItem[]
    setScanItems(items)
    setIssuedState(Object.fromEntries(items.map(i => [i.id, i.issued])))

    if (res.alreadyCheckedIn) {
      const p = persons.find(x => x.qr_token === token) || null
      setScanState('already'); setScanResult(p)
      setScanMsg(`Al ingecheckt${res.person?.checked_in_at ? ' om ' + new Date(res.person.checked_in_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''}`)
      setScanLog(prev => [{
        id: crypto.randomUUID(),
        qr_token: token,
        success: true,
        action: 'checkin',
        message: 'Al ingecheckt.',
        scanned_at: new Date().toISOString(),
        person_id: res.person?.id ?? null,
        accreditation_persons: res.person ? { first_name: res.person.first_name, last_name: res.person.last_name } : null,
      }, ...prev].slice(0, 50))
      return
    }
    const p = persons.find(x => x.qr_token === token) || null
    setScanState('success'); setScanResult(p)
    setScanMsg('Ingecheckt!')
    setPersons(prev => prev.map(x => x.qr_token === token ? { ...x, status: 'checked_in', checked_in_at: new Date().toISOString() } : x))
    setScanLog(prev => [{
      id: crypto.randomUUID(),
      qr_token: token,
      success: true,
      action: 'checkin',
      message: 'Ingecheckt.',
      scanned_at: new Date().toISOString(),
      person_id: res.person?.id ?? null,
      accreditation_persons: res.person ? { first_name: res.person.first_name, last_name: res.person.last_name } : null,
    }, ...prev].slice(0, 50))
  }

  async function handleCheckout(personId: string) {
    const res = await checkOutPerson(projectId, personId)
    if (!res.error) {
      setPersons(prev => prev.map(p => p.id === personId ? { ...p, status: 'checked_out', checked_out_at: new Date().toISOString() } : p))
      if (scanResult?.id === personId) setScanResult(prev => prev ? { ...prev, status: 'checked_out' } : null)
      const person = persons.find(p => p.id === personId)
      setScanLog(prev => [{
        id: crypto.randomUUID(),
        qr_token: person?.qr_token || '',
        success: true,
        action: 'checkout',
        message: 'Uitgecheckt.',
        scanned_at: new Date().toISOString(),
        person_id: personId,
        accreditation_persons: person ? { first_name: person.first_name, last_name: person.last_name } : null,
      }, ...prev].slice(0, 50))
    }
  }

  async function handleMarkIssued(itemId: string, issued: boolean) {
    setIssuedState(prev => ({ ...prev, [itemId]: issued }))
    await markItemIssued(projectId, itemId, issued)
  }

  const checkedInCount = persons.filter(p => p.status === 'checked_in').length

  return (
    <div className="max-w-4xl w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/project/${projectId}/accreditation`} className="text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">← Accreditatie</Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">Check-in</h1>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{checkedInCount}</p>
          <p className="text-xs text-slate-400">Ingecheckt</p>
        </div>
      </div>

      {/* Zone capacity status bar */}
      {zonesWithCapacity.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Zonebezetting</p>
          <div className="flex flex-wrap gap-3">
            {zonesWithCapacity.map(z => {
              const count = zoneOccupancy[z.id] || 0
              const cap = z.capacity!
              const over = count >= cap
              return (
                <div key={z.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${over ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30'}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
                  <span className={`text-xs font-medium ${over ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {z.name}
                  </span>
                  <span className={`text-xs font-bold ${over ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {count} / {cap}
                  </span>
                  {over && <span className="text-xs text-red-500">⚠ Vol</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* QR scanner input */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">QR Scanner</p>
        <p className="text-xs text-slate-400 mb-3">Klik in het veld en scan de QR-code. De scanner stuurt automatisch een Enter.</p>
        <input
          ref={scanRef}
          value={scanInput}
          onChange={e => setScanInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleScan(scanInput) }}
          placeholder="Scan QR-code of voer token in..."
          autoFocus
          className="w-full px-4 py-3 text-sm rounded-lg border-2 border-blue-400 bg-blue-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />

        {/* Scan result */}
        {scanState !== 'idle' && (
          <div className={`mt-4 rounded-xl p-4 ${
            scanState === 'success' ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' :
            scanState === 'already' ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' :
            'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className={`font-semibold text-sm ${
                  scanState === 'success' ? 'text-green-700 dark:text-green-400' :
                  scanState === 'already' ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
                }`}>
                  {scanState === 'success' ? '✓ ' : scanState === 'already' ? '⚠ ' : '✗ '}{scanMsg}
                </p>
                {scanResult && (
                  <div className="mt-2">
                    <p className="text-base font-bold text-slate-800 dark:text-white">{scanResult.first_name} {scanResult.last_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{ROLE_LABELS[scanResult.role]}{scanResult.accreditation_groups ? ` · ${scanResult.accreditation_groups.name}` : ''}</p>
                    {/* Zones */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {scanResult.accreditation_person_zones.map((pz, i) => pz.accreditation_zones && (
                        <span key={i} className="text-xs px-2 py-0.5 rounded font-semibold text-white" style={{ backgroundColor: pz.accreditation_zones.color }}>{pz.accreditation_zones.name}</span>
                      ))}
                    </div>
                    {/* Items */}
                    {scanResult.accreditation_person_items.filter(i => i.quantity > 0).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {scanResult.accreditation_person_items.filter(i => i.quantity > 0).map((item, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {item.accreditation_item_types?.name} ×{item.quantity}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => { setScanState('idle'); setScanResult(null); setScanMsg(''); setScanItems([]); setIssuedState({}); scanRef.current?.focus() }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {scanResult && scanResult.status === 'checked_in' && (
              <button onClick={() => handleCheckout(scanResult.id)}
                className="mt-3 px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors">
                Uitchecken
              </button>
            )}
          </div>
        )}

        {/* Items uitgifte panel */}
        {(scanState === 'success' || scanState === 'already') && scanItems.filter(i => i.quantity > 0).length > 0 && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-3">Items uitgeven</p>
            <div className="space-y-2">
              {scanItems.filter(i => i.quantity > 0).map(item => (
                <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={issuedState[item.id] ?? item.issued}
                    onChange={e => handleMarkIssued(item.id, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {item.accreditation_item_types?.name} ×{item.quantity}
                  </span>
                  {(issuedState[item.id] ?? item.issued) && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Uitgegeven</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual list */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken op naam..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-400">Geen personen gevonden.</li>
          )}
          {filtered.map(p => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.status === 'checked_in' ? 'bg-blue-500' : p.status === 'checked_out' ? 'bg-slate-300' : 'bg-green-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-white">{p.first_name} {p.last_name}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="text-xs text-slate-400">{ROLE_LABELS[p.role]}</span>
                  {p.accreditation_groups && <span className="text-xs text-slate-400">· {p.accreditation_groups.name}</span>}
                  {p.accreditation_person_zones.map((pz, i) => pz.accreditation_zones && (
                    <span key={i} className="text-xs px-1.5 py-0.5 rounded font-medium text-white" style={{ backgroundColor: pz.accreditation_zones.color }}>{pz.accreditation_zones.name}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.checked_in_at && (
                  <span className="text-xs text-slate-400">{new Date(p.checked_in_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
                {p.status === 'approved' && (
                  <button onClick={() => handleScan(p.qr_token)}
                    className="text-xs px-2.5 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-medium transition-colors">
                    Inchecken
                  </button>
                )}
                {p.status === 'checked_in' && (
                  <button onClick={() => handleCheckout(p.id)}
                    className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-colors">
                    Uitchecken
                  </button>
                )}
                {p.status === 'checked_out' && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">Vertrokken</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Scan log */}
      <div className="mt-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setShowScanLog(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors rounded-xl"
        >
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Scangeschiedenis ({scanLog.length})
          </span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${showScanLog ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showScanLog && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            {scanLog.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Nog geen scans geregistreerd.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-80 overflow-y-auto">
                {scanLog.map(entry => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`text-base shrink-0 ${entry.success ? 'text-green-500' : 'text-red-500'}`}>
                      {entry.success ? '✓' : '✗'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {entry.accreditation_persons
                            ? `${entry.accreditation_persons.first_name} ${entry.accreditation_persons.last_name}`
                            : <span className="font-mono text-xs text-slate-400">{entry.qr_token}</span>
                          }
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${entry.action === 'checkout' ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                          {entry.action === 'checkout' ? 'Uitcheck' : 'Check-in'}
                        </span>
                      </div>
                      {entry.message && !entry.success && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{entry.message}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(entry.scanned_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
