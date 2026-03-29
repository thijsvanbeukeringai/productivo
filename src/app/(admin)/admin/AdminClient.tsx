'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createCompany,
  adminUpdateCompany,
  adminUpdateProjectModules,
  sendTempPassword,
  adminCreateUser,
  adminUpdateUserName,
  adminAssignUserToCompany,
  adminRemoveUserFromCompany,
  adminAssignUserToProject,
  adminRemoveUserFromProject,
} from '@/lib/actions/super-admin.actions'
import { MODULE_CONFIG, TOGGLEABLE_MODULES, type ModuleKey } from '@/lib/utils/modules'
import { formatDate } from '@/lib/utils/format-timestamp'
import { roleLabels } from '@/lib/utils/priority-colors'

export interface AdminCompany {
  id: string
  name: string
  slug: string
  admin_name: string | null
  admin_email: string | null
  address: string | null
  kvk_number: string | null
  btw_number: string | null
  created_at: string
  project_count: number
}

export interface AdminProject {
  id: string
  name: string
  company_id: string
  company_name: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  active_modules: string[]
  member_count: number
}

export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  created_at: string
  company_members: Array<{ company_id: string; company_name: string; role: string }>
  project_members: Array<{ project_id: string; project_name: string; role: string }>
}

interface Props {
  companies: AdminCompany[]
  projects: AdminProject[]
  users: AdminUser[]
}

type Tab = 'companies' | 'projects' | 'users'

const NAV_ITEMS: { key: Tab; label: string; icon: React.ReactNode; countFn: (c: AdminCompany[], p: AdminProject[], u: AdminUser[]) => number }[] = [
  {
    key: 'companies',
    label: 'Bedrijven',
    countFn: (c) => c.length,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15l.75 18H3.75L4.5 3zM9 21V9m6 12V9M9 9h6M9 6h6" />
      </svg>
    ),
  },
  {
    key: 'projects',
    label: 'Projecten',
    countFn: (_, p) => p.length,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    ),
  },
  {
    key: 'users',
    label: 'Gebruikers',
    countFn: (_, __, u) => u.length,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
]

const ROLES = [
  { value: 'runner', label: 'Runner' },
  { value: 'planner', label: 'Planner' },
  { value: 'centralist', label: 'Centralist' },
  { value: 'company_admin', label: 'Bedrijf Admin' },
]

const PROTECTED_EMAIL = 'thijsvanbeukering@icloud.com'

export function AdminClient({ companies, projects, users }: Props) {
  const [tab, setTab] = useState<Tab>('companies')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<AdminCompany | null>(null)
  const [showCreateCompany, setShowCreateCompany] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ name: string; password: string } | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(null)
  const router = useRouter()

  // Sync selectedUser with fresh data after router.refresh()
  useEffect(() => {
    if (selectedUser) {
      const fresh = users.find(u => u.id === selectedUser.id)
      if (fresh) setSelectedUser(fresh)
    }
  }, [users])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-48 bg-slate-900 flex flex-col shrink-0">
        <div className="px-3 py-4 border-b border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2">Beheer</p>
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map(item => {
            const count = item.countFn(companies, projects, users)
            const active = tab === item.key
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className={active ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${active ? 'bg-slate-600 text-slate-200' : 'bg-slate-800 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Action button */}
          <div className="flex justify-end mb-6">
            {tab === 'companies' && (
              <button
                onClick={() => setShowCreateCompany(true)}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                + Nieuw bedrijf
              </button>
            )}
            {tab === 'users' && (
              <button
                onClick={() => setShowCreateUser(true)}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                + Nieuwe gebruiker
              </button>
            )}
          </div>

      {/* Companies tab */}
      {tab === 'companies' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Bedrijfsnaam</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Beheerder</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">E-mail</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Projecten</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {companies.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{c.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {c.admin_name || <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.admin_email
                      ? <a href={`mailto:${c.admin_email}`} className="text-blue-500 hover:text-blue-700 text-sm">{c.admin_email}</a>
                      : <span className="text-slate-300 dark:text-slate-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                    {c.project_count}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => { setCompanyFilter(c.id); setTab('projects') }}
                        className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors whitespace-nowrap"
                      >
                        Projecten →
                      </button>
                      <button
                        onClick={() => setSelectedCompany(c)}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        Bewerken
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Projects tab */}
      {tab === 'projects' && (
        <div>
          {companyFilter && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Gefilterd op: <span className="font-medium text-slate-700 dark:text-slate-200">{companies.find(c => c.id === companyFilter)?.name}</span>
              </span>
              <button onClick={() => setCompanyFilter(null)} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                × Wis filter
              </button>
            </div>
          )}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Project</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Bedrijf</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Periode</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Leden</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {projects.filter(p => !companyFilter || p.company_id === companyFilter).map(p => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.company_name}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {p.start_date ? formatDate(p.start_date) : '—'}
                    {p.end_date ? ` → ${formatDate(p.end_date)}` : ''}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">{p.member_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      p.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {p.is_active ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/project/${p.id}`}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors">
                      Openen →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Naam</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Bedrijven</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Projecten</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedUser(u)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-white">{u.full_name || '—'}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.company_members.map(cm => (
                        <span key={cm.company_id} className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                          {cm.company_name}
                        </span>
                      ))}
                      {u.company_members.length === 0 && <span className="text-xs text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-400">{u.project_members.length} project{u.project_members.length !== 1 ? 'en' : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-blue-500">Beheren →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Company edit panel */}
      {selectedCompany && (
        <CompanyEditPanel
          company={selectedCompany}
          companyProjects={projects.filter(p => p.company_id === selectedCompany.id)}
          onClose={() => setSelectedCompany(null)}
        />
      )}

      {/* User detail panel */}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          companies={companies}
          projects={projects}
          onClose={() => setSelectedUser(null)}
          onTempPassword={(name, password) => {
            setSelectedUser(null)
            setTempPasswordInfo({ name, password })
          }}
        />
      )}

      {/* Create company dialog */}
      {showCreateCompany && (
        <CreateCompanyDialog
          onClose={() => setShowCreateCompany(false)}
        />
      )}

      {/* Create user dialog */}
      {showCreateUser && (
        <CreateUserDialog
          onClose={() => setShowCreateUser(false)}
          onCreated={(name, password) => {
            setShowCreateUser(false)
            setTempPasswordInfo({ name, password })
          }}
        />
      )}

      {/* Temp password display */}
      {tempPasswordInfo && (
        <TempPasswordDialog
          name={tempPasswordInfo.name}
          password={tempPasswordInfo.password}
          onClose={() => setTempPasswordInfo(null)}
        />
      )}
        </div>
      </div>
    </div>
  )
}

/* ── User Detail Panel ── */
function UserDetailPanel({
  user,
  companies,
  projects,
  onClose,
  onTempPassword,
}: {
  user: AdminUser
  companies: AdminCompany[]
  projects: AdminProject[]
  onClose: () => void
  onTempPassword: (name: string, password: string) => void
}) {
  const router = useRouter()
  const [assignCompanyId, setAssignCompanyId] = useState('')
  const [assignCompanyRole, setAssignCompanyRole] = useState('runner')
  const [assignProjectId, setAssignProjectId] = useState('')
  const [assignProjectRole, setAssignProjectRole] = useState('runner')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sendingPassword, setSendingPassword] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(user.full_name || '')
  const [savingName, setSavingName] = useState(false)

  const isProtected = user.email === PROTECTED_EMAIL

  async function run(fn: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null)
    setLoading(true)
    const res = await fn()
    setLoading(false)
    if (res.error) { setError(res.error); return false }
    router.refresh()
    return true
  }

  async function handleSaveName() {
    if (!nameValue.trim()) return
    setSavingName(true)
    const res = await adminUpdateUserName(user.id, nameValue)
    setSavingName(false)
    if (res.error) { setError(res.error); return }
    setEditingName(false)
    router.refresh()
  }

  async function handleSendTempPassword() {
    setSendingPassword(true)
    const res = await sendTempPassword(user.id)
    setSendingPassword(false)
    if (res.error) { setError(res.error); return }
    if (res.password) onTempPassword(user.full_name || user.email, res.password)
  }

  async function handleAssignCompany() {
    if (!assignCompanyId) return
    const ok = await run(() => adminAssignUserToCompany(user.id, assignCompanyId, assignCompanyRole))
    if (ok) setAssignCompanyId('')
  }

  async function handleRemoveCompany(companyId: string) {
    await run(() => adminRemoveUserFromCompany(user.id, companyId))
  }

  async function handleAssignProject() {
    if (!assignProjectId) return
    const ok = await run(() => adminAssignUserToProject(user.id, assignProjectId, assignProjectRole))
    if (ok) setAssignProjectId('')
  }

  async function handleRemoveProject(projectId: string) {
    await run(() => adminRemoveUserFromProject(user.id, projectId))
  }

  const unassignedCompanies = companies.filter(c => !user.company_members.find(m => m.company_id === c.id))
  const unassignedProjects = projects.filter(p => !user.project_members.find(m => m.project_id === p.id))

  const inputClass = 'px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-sm shrink-0">
            {(user.full_name || user.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900 dark:text-white truncate">{user.full_name || '—'}</p>
              {isProtected && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                  Super Admin
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-4 py-3 rounded-lg border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          {/* Name */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Naam</h3>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingName ? '...' : 'Opslaan'}
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameValue(user.full_name || '') }}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-sm text-slate-800 dark:text-slate-200">{user.full_name || <span className="text-slate-400 italic">Geen naam</span>}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                >
                  Bewerken
                </button>
              </div>
            )}
          </section>

          {/* Company memberships */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Bedrijven</h3>
            <div className="space-y-2 mb-3">
              {user.company_members.length === 0 && (
                <p className="text-xs text-slate-400">Nog niet gekoppeld aan een bedrijf.</p>
              )}
              {user.company_members.map(cm => (
                <div key={cm.company_id} className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{cm.company_name}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                      {roleLabels[cm.role] || cm.role}
                    </span>
                  </div>
                  {!isProtected && (
                    <button
                      onClick={() => handleRemoveCompany(cm.company_id)}
                      disabled={loading}
                      className="text-red-400 hover:text-red-600 text-xs transition-colors disabled:opacity-40"
                    >
                      {loading ? '...' : 'Verwijderen'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {unassignedCompanies.length > 0 && !isProtected && (
              <div className="flex items-center gap-2">
                <select value={assignCompanyId} onChange={e => setAssignCompanyId(e.target.value)} className={inputClass + ' flex-1'}>
                  <option value="">— Kies bedrijf —</option>
                  {unassignedCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select value={assignCompanyRole} onChange={e => setAssignCompanyRole(e.target.value)} className={inputClass}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button
                  onClick={handleAssignCompany}
                  disabled={!assignCompanyId || loading}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40"
                >
                  Toevoegen
                </button>
              </div>
            )}
          </section>

          {/* Project memberships */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Projecten</h3>
            <div className="space-y-2 mb-3">
              {user.project_members.length === 0 && (
                <p className="text-xs text-slate-400">Nog niet toegewezen aan een project.</p>
              )}
              {user.project_members.map(pm => (
                <div key={pm.project_id} className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{pm.project_name}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                      {roleLabels[pm.role] || pm.role}
                    </span>
                  </div>
                  {!isProtected && (
                    <button
                      onClick={() => handleRemoveProject(pm.project_id)}
                      disabled={loading}
                      className="text-red-400 hover:text-red-600 text-xs transition-colors disabled:opacity-40"
                    >
                      {loading ? '...' : 'Verwijderen'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {unassignedProjects.length > 0 && !isProtected && (
              <div className="flex items-center gap-2 flex-wrap">
                <select value={assignProjectId} onChange={e => setAssignProjectId(e.target.value)} className={inputClass + ' flex-1 min-w-0'}>
                  <option value="">— Kies project —</option>
                  {unassignedProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.company_name})</option>
                  ))}
                </select>
                <select value={assignProjectRole} onChange={e => setAssignProjectRole(e.target.value)} className={inputClass}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button
                  onClick={handleAssignProject}
                  disabled={!assignProjectId || loading}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40"
                >
                  Toevoegen
                </button>
              </div>
            )}
          </section>

          {/* Security */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Beveiliging</h3>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                Genereer een tijdelijk wachtwoord. De gebruiker moet dit na het inloggen direct wijzigen.
              </p>
              <button
                onClick={handleSendTempPassword}
                disabled={sendingPassword}
                className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {sendingPassword ? 'Genereren...' : 'Tijdelijk wachtwoord genereren'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/* ── Create Company Dialog ── */
function CreateCompanyDialog({
  onClose,
}: {
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = await createCompany(formData)
    setLoading(false)
    if (res.error) { setError(res.error); return }
    onClose()
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-slate-900 dark:text-white mb-5">Nieuw bedrijf aanmaken</h2>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Naam</label>
            <input name="name" required placeholder="Bedrijfsnaam" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Slug <span className="text-slate-400">(unieke ID, bijv. mijn-bedrijf)</span></label>
            <input name="slug" required placeholder="mijn-bedrijf" className={inputClass} />
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              Annuleren
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              {loading ? 'Aanmaken...' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Create User Dialog ── */
function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (name: string, password: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = await adminCreateUser(formData)
    setLoading(false)
    if (res.error) { setError(res.error); return }
    if (res.password) {
      const name = (formData.get('full_name') as string) || (formData.get('email') as string)
      onCreated(name, res.password)
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-slate-900 dark:text-white mb-5">Nieuwe gebruiker aanmaken</h2>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Volledige naam</label>
            <input name="full_name" placeholder="Jan de Vries" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">E-mailadres</label>
            <input name="email" type="email" required placeholder="jan@bedrijf.nl" className={inputClass} />
          </div>
          <p className="text-xs text-slate-400">Er wordt automatisch een tijdelijk wachtwoord gegenereerd.</p>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              Annuleren
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              {loading ? 'Aanmaken...' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Temp Password Dialog ── */
function TempPasswordDialog({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copyPassword() {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Tijdelijk wachtwoord</p>
            <p className="text-xs text-slate-400">{name}</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-4">
          <p className="text-xs text-slate-400 mb-1.5">Tijdelijk wachtwoord (éénmalig zichtbaar)</p>
          <p className="font-mono text-lg font-bold text-slate-900 dark:text-white tracking-wider">{password}</p>
        </div>

        <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
          De gebruiker moet dit wachtwoord na het eerste inloggen direct wijzigen.
        </p>

        <div className="flex gap-2">
          <button
            onClick={copyPassword}
            className="flex-1 px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            {copied ? '✓ Gekopieerd' : 'Kopiëren'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Company Edit Panel ── */
function CompanyEditPanel({ company, companyProjects, onClose }: {
  company: AdminCompany
  companyProjects: AdminProject[]
  onClose: () => void
}) {
  const [values, setValues] = useState({
    name: company.name,
    slug: company.slug,
    admin_name: company.admin_name || '',
    admin_email: company.admin_email || '',
    address: company.address || '',
    kvk_number: company.kvk_number || '',
    btw_number: company.btw_number || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Company-wide module state: derive union of active modules across all projects
  // (all projects get the same module set)
  const deriveCompanyModules = (): Set<ModuleKey> => {
    if (companyProjects.length === 0) return new Set<ModuleKey>(['logbook', 'map'])
    const first = companyProjects[0]
    const mods = first.active_modules.length > 0 ? first.active_modules : ['logbook', 'map']
    return new Set(mods as ModuleKey[])
  }
  const [companyModules, setCompanyModules] = useState<Set<ModuleKey>>(deriveCompanyModules)

  function handleToggleModule(mod: ModuleKey) {
    setCompanyModules(prev => {
      const next = new Set(prev)
      if (next.has(mod)) next.delete(mod)
      else next.add(mod)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    // Save company info + modules in parallel
    const mods = Array.from(companyModules)
    const [companyRes] = await Promise.all([
      adminUpdateCompany(company.id, {
        name: values.name.trim(),
        slug: values.slug.trim(),
        admin_name: values.admin_name.trim() || undefined,
        admin_email: values.admin_email.trim() || undefined,
        address: values.address.trim() || undefined,
        kvk_number: values.kvk_number.trim() || undefined,
        btw_number: values.btw_number.trim() || undefined,
      }),
      ...companyProjects.map(p => adminUpdateProjectModules(p.id, mods)),
    ])
    setSaving(false)
    if (companyRes.error) { setError(companyRes.error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
  const field = (label: string, key: keyof typeof values, placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      <input
        value={values[key]}
        onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center gap-4 rounded-t-2xl">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center text-sm shrink-0">
            {company.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate">{company.name}</p>
            <p className="text-xs text-slate-400">{company.project_count} project{company.project_count !== 1 ? 'en' : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-4 py-3 rounded-lg border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          {/* Two-column grid for fields */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Algemeen</h3>
                <div className="space-y-3">
                  {field('Bedrijfsnaam', 'name', 'Bedrijfsnaam')}
                  {field('Slug', 'slug', 'mijn-bedrijf')}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contactpersoon</h3>
                <div className="space-y-3">
                  {field('Naam beheerder', 'admin_name', 'Jan de Vries')}
                  {field('E-mail beheerder', 'admin_email', 'jan@bedrijf.nl')}
                </div>
              </section>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Adres</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Adresgegevens</label>
                  <textarea
                    value={values.address}
                    onChange={e => setValues(prev => ({ ...prev, address: e.target.value }))}
                    placeholder={'Straat 1\n1234 AB Amsterdam'}
                    rows={3}
                    className={inputClass + ' resize-none'}
                  />
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Bedrijfsgegevens</h3>
                <div className="space-y-3">
                  {field('KvK-nummer', 'kvk_number', '12345678')}
                  {field('BTW-nummer', 'btw_number', 'NL123456789B01')}
                </div>
              </section>
            </div>
          </div>

          {/* Module permissions — company-wide */}
          <section>
            <div className="mb-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Modules (bedrijfsbreed)</h3>
              <p className="text-xs text-slate-400 mt-1">
                Geldt voor alle {companyProjects.length} project{companyProjects.length !== 1 ? 'en' : ''} van dit bedrijf. Klik modules aan/uit en sla op.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TOGGLEABLE_MODULES.map(mod => {
                const active = companyModules.has(mod)
                return (
                  <button
                    key={mod}
                    onClick={() => handleToggleModule(mod)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {MODULE_CONFIG[mod].label}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
              }`}
            >
              {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Alles opslaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
