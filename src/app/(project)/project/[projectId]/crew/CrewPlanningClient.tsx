'use client'

import { useState, useTransition } from 'react'
import {
  inviteCrewCompany,
  updateProjectShowDays,
  adminUpdateCrewMember,
  adminSetWristband,
  adminApprovePlanningDay,
  adminApproveAllDays,
  adminRejectPlanningDay,
  adminDeleteCrewMember,
} from '@/lib/actions/crew.actions'
import { useTranslations } from '@/lib/i18n/LanguageContext'
import { CrewTicketModal } from '@/components/crew/CrewTicketModal'

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
}

interface Wristband {
  id: string
  name: string
  color: string
}

interface CrewMember {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  clothing_size: string | null
  notes: string | null
  parking_ticket: string | null
  created_at: string
  wristband_id: string | null
  wristbands: Wristband | null
  crew_planning: PlanningRow[]
}

interface CrewCompany {
  id: string
  name: string
  contact_name: string
  contact_email: string
  target_count: number | null
  invite_token: string
  created_at: string
  crew_members: CrewMember[]
}

interface Project {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  show_days: string[]
}

interface Props {
  projectId: string
  project: Project
  crewCompanies: CrewCompany[]
  wristbands: Wristband[]
  canAdmin: boolean
  baseUrl: string
}

function generateDays(start: string | null, end: string | null): string[] {
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

function formatDay(dateStr: string, short = false): string {
  const d = new Date(dateStr + 'T12:00:00')
  if (short) return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-500',
}

interface TicketState {
  member: CrewMember
  companyName: string
}

export function CrewPlanningClient({ projectId, project, crewCompanies: initial, wristbands, canAdmin, baseUrl }: Props) {
  const T = useTranslations()
  const [companies, setCompanies] = useState<CrewCompany[]>(initial)
  const [showInvite, setShowInvite] = useState(false)
  const [showDaysEditor, setShowDaysEditor] = useState(false)
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null)
  const [selectedMemberCompanyName, setSelectedMemberCompanyName] = useState('')
  const [ticketState, setTicketState] = useState<TicketState | null>(null)
  const [newInviteToken, setNewInviteToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const allDays = generateDays(project.start_date, project.end_date)
  const [showDays, setShowDays] = useState<Set<string>>(new Set(project.show_days))
  const [inviteSaving, setInviteSaving] = useState(false)

  const totalMembers = companies.reduce((s, c) => s + c.crew_members.length, 0)
  const totalApproved = companies.reduce((s, c) =>
    s + c.crew_members.reduce((ms, m) =>
      ms + m.crew_planning.filter(p => p.status === 'approved').length, 0), 0)

  const STATUS_LABELS: Record<string, string> = {
    pending_approval: T.crew.pending,
    approved: T.crew.approved,
    rejected: T.crew.rejected,
  }

  async function handleInvite(formData: FormData) {
    setInviteSaving(true)
    setError(null)
    const res = await inviteCrewCompany(projectId, formData)
    setInviteSaving(false)
    if (res.error) { setError(res.error); return }
    setNewInviteToken(res.token!)
    setShowInvite(false)
  }

  function copyLink(token: string) {
    const url = `${baseUrl || window.location.origin}/crew/${token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSaveShowDays() {
    const res = await updateProjectShowDays(projectId, Array.from(showDays))
    if (res.error) setError(res.error)
    else setShowDaysEditor(false)
  }

  function handleApproveDay(companyId: string, memberId: string, planningId: string) {
    startTransition(async () => {
      const res = await adminApprovePlanningDay(projectId, planningId)
      if (res.error) { setError(res.error); return }
      setCompanies(prev => prev.map(c => c.id !== companyId ? c : {
        ...c,
        crew_members: c.crew_members.map(m => m.id !== memberId ? m : {
          ...m,
          crew_planning: m.crew_planning.map(p => p.id !== planningId ? p : { ...p, status: 'approved' })
        })
      }))
    })
  }

  function handleRejectDay(companyId: string, memberId: string, planningId: string) {
    startTransition(async () => {
      const res = await adminRejectPlanningDay(projectId, planningId)
      if (res.error) { setError(res.error); return }
      setCompanies(prev => prev.map(c => c.id !== companyId ? c : {
        ...c,
        crew_members: c.crew_members.map(m => m.id !== memberId ? m : {
          ...m,
          crew_planning: m.crew_planning.map(p => p.id !== planningId ? p : { ...p, status: 'rejected' })
        })
      }))
    })
  }

  function handleApproveAll(companyId: string, memberId: string) {
    startTransition(async () => {
      const res = await adminApproveAllDays(projectId, memberId)
      if (res.error) { setError(res.error); return }
      setCompanies(prev => prev.map(c => c.id !== companyId ? c : {
        ...c,
        crew_members: c.crew_members.map(m => m.id !== memberId ? m : {
          ...m,
          crew_planning: m.crew_planning.map(p =>
            p.status === 'pending_approval' ? { ...p, status: 'approved' } : p
          )
        })
      }))
      // Auto-show ticket after approve all
      const company = companies.find(c => c.id === companyId)
      const member = company?.crew_members.find(m => m.id === memberId)
      if (member && company) {
        const updatedMember = {
          ...member,
          crew_planning: member.crew_planning.map(p =>
            p.status === 'pending_approval' ? { ...p, status: 'approved' } : p
          )
        }
        setTicketState({ member: updatedMember, companyName: company.name })
      }
    })
  }

  function handleDeleteMember(companyId: string, memberId: string) {
    if (!confirm(T.crew.delete)) return
    setCompanies(prev => prev.map(c => c.id !== companyId ? c : {
      ...c, crew_members: c.crew_members.filter(m => m.id !== memberId)
    }))
    if (selectedMember?.id === memberId) setSelectedMember(null)
    startTransition(async () => {
      const res = await adminDeleteCrewMember(projectId, memberId)
      if (res.error) setError(res.error)
    })
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="max-w-6xl w-full mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{T.crew.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {totalMembers} {T.crew.members} · {totalApproved} {T.crew.approvedCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAdmin && (
            <>
              <button
                onClick={() => setShowDaysEditor(true)}
                className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {T.crew.showDays}
              </button>
              <button
                onClick={() => { setShowInvite(true); setNewInviteToken(null) }}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {T.crew.addCompany}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {newInviteToken && (
        <div className="mb-4 px-4 py-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">{T.crew.companyCreated}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 font-mono break-all">
              {(baseUrl || (typeof window !== 'undefined' ? window.location.origin : ''))}/crew/{newInviteToken}
            </p>
          </div>
          <button
            onClick={() => copyLink(newInviteToken)}
            className="px-3 py-1.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium shrink-0"
          >
            {copied ? T.crew.linkCopied : T.crew.copyLink}
          </button>
        </div>
      )}

      {companies.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-12 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm">{T.crew.noCompanies}</p>
        </div>
      )}

      {companies.map(company => (
        <div key={company.id} className="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-white text-sm">{company.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {company.contact_name} · {company.contact_email}
                {company.target_count
                  ? ` · ${T.crew.goal} ${company.crew_members.length}/${company.target_count}`
                  : ` · ${company.crew_members.length} ${T.crew.registeredCount}`}
              </p>
            </div>
            <button
              onClick={() => copyLink(company.invite_token)}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium"
            >
              {T.crew.copyLink}
            </button>
          </div>

          {company.crew_members.length === 0 && (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-slate-400">{T.crew.noMembers}</p>
            </div>
          )}

          {company.crew_members.length > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500">{T.common.name}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{T.crew.colDays}</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 text-right">{T.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {company.crew_members.map(member => {
                  const pending = member.crew_planning.filter(p => p.status === 'pending_approval').length
                  return (
                    <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800 dark:text-white">
                          {member.first_name} {member.last_name}
                        </p>
                        {member.email && <p className="text-xs text-slate-400">{member.email}</p>}
                        {member.wristbands && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-black/10"
                              style={{ backgroundColor: member.wristbands.color }}
                            />
                            <span className="text-xs text-slate-500">{member.wristbands.name}</span>
                          </div>
                        )}
                        {member.parking_ticket && (
                          <p className="text-xs text-blue-500 mt-0.5">P: {member.parking_ticket}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {member.crew_planning
                            .sort((a, b) => a.work_date.localeCompare(b.work_date))
                            .map(p => (
                              <span
                                key={p.id}
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-slate-100 text-slate-500'}`}
                              >
                                {formatDay(p.work_date, true)}
                              </span>
                            ))}
                          {member.crew_planning.length === 0 && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                        {pending > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            {pending} {T.crew.pendingDays}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {canAdmin && pending > 0 && (
                            <button
                              onClick={() => handleApproveAll(company.id, member.id)}
                              className="text-xs px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                              {T.crew.approveAll}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedMember(member)
                              setSelectedMemberCompanyName(company.name)
                            }}
                            className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                          >
                            {T.crew.edit}
                          </button>
                          <button
                            onClick={() => setTicketState({ member, companyName: company.name })}
                            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            title={T.crew.ticket}
                          >
                            🎫
                          </button>
                          {canAdmin && (
                            <button
                              onClick={() => handleDeleteMember(company.id, member.id)}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors"
                            >
                              {T.common.delete}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {/* Member edit modal */}
      {selectedMember && (
        <MemberEditModal
          member={selectedMember}
          projectId={projectId}
          showDays={project.show_days}
          wristbands={wristbands}
          canAdmin={canAdmin}
          onClose={() => setSelectedMember(null)}
          onApproveDay={(planningId) => {
            const company = companies.find(c => c.crew_members.some(m => m.id === selectedMember.id))
            if (company) handleApproveDay(company.id, selectedMember.id, planningId)
          }}
          onRejectDay={(planningId) => {
            const company = companies.find(c => c.crew_members.some(m => m.id === selectedMember.id))
            if (company) handleRejectDay(company.id, selectedMember.id, planningId)
          }}
          onSaved={(fields) => {
            setCompanies(prev => prev.map(c => ({
              ...c,
              crew_members: c.crew_members.map(m => {
                if (m.id !== selectedMember.id) return m
                const wb = fields.wristband_id
                  ? (wristbands.find(w => w.id === fields.wristband_id) ?? m.wristbands)
                  : fields.wristband_id === null ? null : m.wristbands
                return { ...m, ...fields, wristbands: wb ?? null }
              }),
            })))
            setSelectedMember(prev => prev ? { ...prev, ...fields } : null)
          }}
          onShowTicket={() => {
            const company = companies.find(c => c.crew_members.some(m => m.id === selectedMember.id))
            setTicketState({ member: selectedMember, companyName: company?.name ?? selectedMemberCompanyName })
          }}
        />
      )}

      {/* Ticket modal */}
      {ticketState && (
        <CrewTicketModal
          memberId={ticketState.member.id}
          firstName={ticketState.member.first_name}
          lastName={ticketState.member.last_name}
          companyName={ticketState.companyName}
          projectName={project.name}
          approvedDays={ticketState.member.crew_planning.filter(p => p.status === 'approved')}
          wristband={ticketState.member.wristbands}
          onClose={() => setTicketState(null)}
        />
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">{T.crew.inviteCompany}</h2>
              <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form action={handleInvite} className="p-6 space-y-4">
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">{T.crew.companyName} *</label>
                <input name="name" required placeholder="Security BV" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">{T.crew.contactPerson} *</label>
                <input name="contact_name" required placeholder="Jan de Vries" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">{T.crew.contactEmail} *</label>
                <input name="contact_email" type="email" required placeholder="jan@security.nl" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">{T.crew.targetCount}</label>
                <input name="target_count" type="number" min="1" placeholder="25" className={inputClass} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  {T.common.cancel}
                </button>
                <button type="submit" disabled={inviteSaving}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                  {inviteSaving ? T.crew.creating : T.crew.createLink}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Show days editor */}
      {showDaysEditor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowDaysEditor(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">{T.crew.showDaysTitle}</h2>
              <button onClick={() => setShowDaysEditor(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {allDays.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">{T.crew.noDateSet}</p>
              )}
              <div className="space-y-2 mb-5">
                {allDays.map(date => {
                  const isShow = showDays.has(date)
                  return (
                    <label key={date} className="flex items-center gap-3 cursor-pointer py-1.5">
                      <input
                        type="checkbox"
                        checked={isShow}
                        onChange={() => {
                          setShowDays(prev => {
                            const next = new Set(prev)
                            if (next.has(date)) next.delete(date)
                            else next.add(date)
                            return next
                          })
                        }}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{formatDay(date)}</span>
                      {isShow && <span className="ml-auto text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Show</span>}
                    </label>
                  )
                })}
              </div>
              <button
                onClick={handleSaveShowDays}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {T.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Member edit modal ── */
function MemberEditModal({
  member,
  projectId,
  showDays,
  wristbands,
  canAdmin,
  onClose,
  onApproveDay,
  onRejectDay,
  onSaved,
  onShowTicket,
}: {
  member: CrewMember
  projectId: string
  showDays: string[]
  wristbands: Wristband[]
  canAdmin: boolean
  onClose: () => void
  onApproveDay: (id: string) => void
  onRejectDay: (id: string) => void
  onSaved: (fields: Partial<CrewMember>) => void
  onShowTicket: () => void
}) {
  const T = useTranslations()
  const [values, setValues] = useState({
    phone: member.phone || '',
    clothing_size: member.clothing_size || '',
    notes: member.notes || '',
    parking_ticket: member.parking_ticket || '',
  })
  const [selectedWristband, setSelectedWristband] = useState<string>(member.wristband_id || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showDaySet = new Set(showDays)

  const STATUS_LABELS: Record<string, string> = {
    pending_approval: T.crew.pending,
    approved: T.crew.approved,
    rejected: T.crew.rejected,
  }

  async function handleSave() {
    setSaving(true)
    const wristbandId = selectedWristband || null

    const [infoRes, wbRes] = await Promise.all([
      adminUpdateCrewMember(projectId, member.id, values),
      adminSetWristband(projectId, member.id, wristbandId),
    ])
    setSaving(false)
    if (infoRes.error || wbRes.error) { setError(infoRes.error || wbRes.error || null); return }
    onSaved({ ...values, wristband_id: wristbandId })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl shrink-0">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{member.first_name} {member.last_name}</p>
            <p className="text-xs text-slate-400">{member.email || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onShowTicket}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              🎫 {T.crew.ticket}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: extra fields */}
          <div className="w-72 shrink-0 border-r border-slate-100 dark:border-slate-700 p-5 overflow-y-auto flex flex-col">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{T.crew.additionalInfo}</h3>
            {error && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>}
            {canAdmin ? (
              <>
                <div className="space-y-3 flex-1">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">{T.crew.phone}</label>
                    <input value={values.phone} onChange={e => setValues(p => ({ ...p, phone: e.target.value }))} placeholder="+31 6 12345678" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">{T.crew.clothingSize}</label>
                    <input value={values.clothing_size} onChange={e => setValues(p => ({ ...p, clothing_size: e.target.value }))} placeholder="M / L / XL" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">{T.crew.parkingTicketId}</label>
                    <input value={values.parking_ticket} onChange={e => setValues(p => ({ ...p, parking_ticket: e.target.value }))} placeholder="PT-001" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">{T.crew.notes}</label>
                    <textarea value={values.notes} onChange={e => setValues(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="..." className={inputClass + ' resize-none'} />
                  </div>

                  {/* Wristband selector */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">{T.crew.wristband}</label>
                    {wristbands.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">{T.crew.noWristband}</p>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2.5 cursor-pointer py-1">
                          <input
                            type="radio"
                            name="wristband"
                            value=""
                            checked={selectedWristband === ''}
                            onChange={() => setSelectedWristband('')}
                            className="accent-blue-600"
                          />
                          <span className="text-sm text-slate-500 dark:text-slate-400">{T.crew.noWristband}</span>
                        </label>
                        {wristbands.map(wb => (
                          <label key={wb.id} className="flex items-center gap-2.5 cursor-pointer py-1">
                            <input
                              type="radio"
                              name="wristband"
                              value={wb.id}
                              checked={selectedWristband === wb.id}
                              onChange={() => setSelectedWristband(wb.id)}
                              className="accent-blue-600"
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                              style={{ backgroundColor: wb.color }}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">{wb.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`mt-4 w-full py-2 text-sm font-semibold rounded-lg transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'}`}
                >
                  {saving ? T.common.saving : saved ? T.common.saved : T.common.save}
                </button>
              </>
            ) : (
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {member.phone && <p><span className="text-xs text-slate-400">{T.crew.telLabel}</span> {member.phone}</p>}
                {member.clothing_size && <p><span className="text-xs text-slate-400">{T.crew.sizeLabel}</span> {member.clothing_size}</p>}
                {member.parking_ticket && <p><span className="text-xs text-slate-400">{T.crew.parkingTicketLabel}</span> {member.parking_ticket}</p>}
                {member.notes && <p><span className="text-xs text-slate-400">{T.crew.notesLabel}</span> {member.notes}</p>}
                {member.wristbands && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: member.wristbands.color }} />
                    <span className="text-xs">{member.wristbands.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: planning per day */}
          <div className="flex-1 p-5 overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{T.crew.planningPerDay}</h3>
            {member.crew_planning.length === 0 && (
              <p className="text-xs text-slate-400">{T.crew.noWorkdays}</p>
            )}
            <div className="space-y-2">
              {member.crew_planning
                .sort((a, b) => a.work_date.localeCompare(b.work_date))
                .map(p => {
                  const isShow = showDaySet.has(p.work_date)
                  const statusColor =
                    p.status === 'approved' ? 'bg-green-500' :
                    p.status === 'rejected' ? 'bg-red-400' :
                    'bg-amber-400'
                  return (
                    <div key={p.id} className={`rounded-xl border transition-colors ${
                      p.status === 'approved'
                        ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10'
                        : p.status === 'rejected'
                        ? 'border-red-100 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800 dark:text-white">{formatDay(p.work_date)}</span>
                            {isShow && (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full font-medium">Show</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.lunch && <span className="text-xs px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">{T.crew.portal.lunch}</span>}
                            {p.diner && <span className="text-xs px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">{T.crew.portal.dinner}</span>}
                            {p.night_snack && <span className="text-xs px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">{T.crew.portal.nightSnack}</span>}
                            {p.parking_card && <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">{T.crew.portal.parkingCard}</span>}
                            {p.walkie_talkie_type && <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">{
                              p.walkie_talkie_type === 'inear' ? T.crew.walkieInear :
                              p.walkie_talkie_type === 'spreeksleutel' ? T.crew.walkieSpreeksleutel :
                              p.walkie_talkie_type === 'heavy_duty' ? T.crew.walkieHeavyDuty :
                              T.crew.walkiePorto
                            }</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.status !== 'pending_approval' && (
                            <span className={`text-xs font-medium ${p.status === 'approved' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                              {STATUS_LABELS[p.status]}
                            </span>
                          )}
                          {canAdmin && p.status === 'pending_approval' && (
                            <>
                              <button onClick={() => onApproveDay(p.id)} className="text-xs px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">✓</button>
                              <button onClick={() => onRejectDay(p.id)} className="text-xs px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors">✗</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
