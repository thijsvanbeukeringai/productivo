'use client'

import { useState, useTransition } from 'react'
import { updateProject } from '@/lib/actions/project.actions'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface EventDay {
  date: string
  open_time: string
  close_time: string
  visitors: string
  active: boolean
}

interface EventSchedule {
  night_security_start: string
  night_security_end: string
  days: EventDay[]
  camping: {
    start_date: string
    start_time: string
    end_date: string
    end_time: string
    visitors: string
  }
}

interface Invoice {
  company: string
  street: string
  postal_city: string
  po_number: string
  contact_person: string
  email: string
}

interface Props {
  projectId: string
  companyName: string
  project: {
    name: string
    location_name: string | null
    location_address: string | null
    project_leader: string | null
    start_date: string | null
    end_date: string | null
    show_days: string[]
    invoice_details: Record<string, unknown> | null
  }
}

const emptyDay = (): EventDay => ({ date: '', open_time: '', close_time: '', visitors: '', active: true })

function parseSchedule(raw: Record<string, unknown> | null): EventSchedule {
  const d = raw || {}
  const days = Array.isArray(d.days) ? (d.days as EventDay[]) : [emptyDay()]
  return {
    night_security_start: (d.night_security_start as string) || '',
    night_security_end: (d.night_security_end as string) || '',
    days: days.length ? days : [emptyDay()],
    camping: (d.camping as EventSchedule['camping']) || { start_date: '', start_time: '', end_date: '', end_time: '', visitors: '' },
  }
}

function parseInvoice(raw: Record<string, unknown> | null): Invoice {
  const d = raw || {}
  return {
    company:        (d.company as string) || '',
    street:         (d.street as string) || '',
    postal_city:    (d.postal_city as string) || '',
    po_number:      (d.po_number as string) || '',
    contact_person: (d.contact_person as string) || '',
    email:          (d.email as string) || '',
  }
}

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 min-w-36'

export function ProjectInfoForm({ projectId, companyName, project }: Props) {
  const T = useTranslations()
  const [saving, startSave] = useTransition()
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState(project.name)
  const [locationName, setLocationName] = useState(project.location_name || '')
  const [locationAddress, setLocationAddress] = useState(project.location_address || '')
  const [projectLeader, setProjectLeader] = useState(project.project_leader || '')
  const [startDate, setStartDate] = useState(project.start_date || '')
  const [endDate, setEndDate] = useState(project.end_date || '')
  const [showDays, setShowDays] = useState<Set<string>>(new Set(project.show_days))

  const [invoice, setInvoice] = useState<Invoice>(() => parseInvoice(project.invoice_details))
  const [schedule, setSchedule] = useState<EventSchedule>(() => parseSchedule(project.invoice_details))

  // Generate all days between start and end date
  function generateDays(start: string, end: string): string[] {
    if (!start || !end) return []
    const days: string[] = []
    const cur = new Date(start)
    const last = new Date(end)
    while (cur <= last) {
      days.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }

  function toggleShowDay(date: string) {
    setShowDays(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const allDays = generateDays(startDate, endDate)

  function setDay(i: number, field: keyof EventDay, value: string | boolean) {
    setSchedule(s => {
      const days = s.days.map((d, idx) => idx === i ? { ...d, [field]: value } : d)
      return { ...s, days }
    })
  }

  function addDay() {
    setSchedule(s => ({ ...s, days: [...s.days, emptyDay()] }))
  }

  function removeDay(i: number) {
    setSchedule(s => ({ ...s, days: s.days.filter((_, idx) => idx !== i) }))
  }

  function handleSave() {
    startSave(async () => {
      await updateProject(projectId, {
        name,
        location_name: locationName || undefined,
        location_address: locationAddress || undefined,
        project_leader: projectLeader || undefined,
        start_date: startDate || null,
        end_date: endDate || null,
        show_days: Array.from(showDays),
        invoice_details: { ...invoice, ...schedule },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-6">

      {/* Project informatie + Factuur gegevens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Project informatie */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-5">{T.projectInfo.title}</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={labelCls}>{T.projectInfo.company}</span>
              <input value={companyName} readOnly
                className={`${inputCls} bg-slate-50 dark:bg-slate-900 text-slate-400 cursor-not-allowed`} />
            </div>
            <div className="flex items-center gap-3">
              <span className={labelCls}>{T.projectInfo.name}</span>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-center gap-3">
              <span className={labelCls}>{T.projectInfo.location}</span>
              <input value={locationName} onChange={e => setLocationName(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-center gap-3">
              <span className={labelCls}>{T.projectInfo.address}</span>
              <input value={locationAddress} onChange={e => setLocationAddress(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-center gap-3">
              <span className={labelCls}>{T.projectInfo.projectLeader}</span>
              <input value={projectLeader} onChange={e => setProjectLeader(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Factuur gegevens */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-5">{T.projectInfo.invoice}</h2>
          <div className="space-y-3">
            {([
              ['company',        'Factuur bedrijfsnaam'],
              ['street',         'Straat en huisnummer'],
              ['postal_city',    'Postcode / Plaats'],
              ['po_number',      'P.O. nummer'],
              ['contact_person', 'Contactpersoon'],
              ['email',          'E-mail'],
            ] as [keyof Invoice, string][]).map(([field, label]) => (
              <div key={field} className="flex items-center gap-3">
                <span className={labelCls}>{label}</span>
                <input
                  type={field === 'email' ? 'email' : 'text'}
                  value={invoice[field]}
                  onChange={e => setInvoice(inv => ({ ...inv, [field]: e.target.value }))}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Datum en tijden */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="font-semibold text-slate-800 dark:text-white mb-5">Datum en tijden</h2>

        <div className="space-y-4">
          {/* Opbouw / Afbouw */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div>
              <label className={labelCls}>{T.projectInfo.startBuild}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={`${inputCls} max-w-48`}
              />
            </div>
            <div>
              <label className={labelCls}>{T.projectInfo.endBuild}</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={`${inputCls} max-w-48`}
              />
            </div>
          </div>

          {/* Show dagen */}
          {allDays.length > 0 && (
            <div className="pb-4 border-b border-slate-100 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                {T.projectInfo.showDays} <span className="text-xs text-slate-400 font-normal ml-1">(selecteer welke dagen show zijn)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {allDays.map(date => {
                  const isShow = showDays.has(date)
                  const d = new Date(date + 'T12:00:00')
                  const label = d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => toggleShowDay(date)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isShow
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-purple-400'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {showDays.size} van {allDays.length} dag{allDays.length !== 1 ? 'en' : ''} is show dag
              </p>
            </div>
          )}

          {allDays.length === 0 && startDate && endDate && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Start afbouw moet na start opbouw liggen om dagen te genereren.
            </p>
          )}

        <div className="space-y-3">
          {/* Night security */}
          <div className="flex items-center gap-3">
            <span className={labelCls}>Nachtbeveiliging start</span>
            <input type="date" value={schedule.night_security_start}
              onChange={e => setSchedule(s => ({ ...s, night_security_start: e.target.value }))}
              className={`${inputCls} max-w-48`} />
          </div>
          <div className="flex items-center gap-3">
            <span className={labelCls}>
              Nachtbeveiliging einde
              <span className="block text-xs text-red-500 font-normal">Voer deze datum in + 1 dag!</span>
            </span>
            <input type="date" value={schedule.night_security_end}
              onChange={e => setSchedule(s => ({ ...s, night_security_end: e.target.value }))}
              className={`${inputCls} max-w-48`} />
          </div>

          {/* Days */}
          <div className="mt-2 space-y-2">
            {schedule.days.map((day, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 min-w-12">Dag {i + 1}</span>
                <input type="date" value={day.date}
                  onChange={e => setDay(i, 'date', e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="time" value={day.open_time} placeholder="Openingstijd"
                  onChange={e => setDay(i, 'open_time', e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
                <input type="time" value={day.close_time} placeholder="Sluitijd"
                  onChange={e => setDay(i, 'close_time', e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
                <input type="number" value={day.visitors} placeholder="Bezoekersaantal"
                  onChange={e => setDay(i, 'visitors', e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" />
                <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={day.active}
                    onChange={e => setDay(i, 'active', e.target.checked)}
                    className="rounded border-slate-300" />
                  Actief
                </label>
                {schedule.days.length > 1 && (
                  <button type="button" onClick={() => removeDay(i)}
                    className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded border border-red-200 hover:border-red-400 transition-colors">
                    {T.common.delete}
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addDay}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1 mt-1">
              + Dag toevoegen
            </button>
          </div>

          {/* Camping */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 min-w-12">Camping</span>
            <input type="date" value={schedule.camping.start_date}
              onChange={e => setSchedule(s => ({ ...s, camping: { ...s.camping, start_date: e.target.value } }))}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="time" value={schedule.camping.start_time}
              onChange={e => setSchedule(s => ({ ...s, camping: { ...s.camping, start_time: e.target.value } }))}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
            <input type="date" value={schedule.camping.end_date}
              onChange={e => setSchedule(s => ({ ...s, camping: { ...s.camping, end_date: e.target.value } }))}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="time" value={schedule.camping.end_time}
              onChange={e => setSchedule(s => ({ ...s, camping: { ...s.camping, end_time: e.target.value } }))}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
            <input type="number" value={schedule.camping.visitors} placeholder="Bezoekersaantal"
              onChange={e => setSchedule(s => ({ ...s, camping: { ...s.camping, visitors: e.target.value } }))}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" />
          </div>
        </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {saved ? T.projectInfo.saved : saving ? T.projectInfo.saving : T.projectInfo.save}
        </button>
      </div>
    </div>
  )
}
