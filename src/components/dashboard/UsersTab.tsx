'use client'

import { useState, useTransition } from 'react'
import { updateMemberRole, assignMemberToProject, removeMemberFromProject } from '@/lib/actions/company.actions'
import { InviteUserDialog } from './InviteUserDialog'

interface ProjectOption {
  id: string
  name: string
}

interface ProjectMembership {
  project_id: string
  role: string
  project_name: string
}

interface Member {
  user_id: string
  role: string
  email: string
  full_name: string | null
  projectMemberships: ProjectMembership[]
}

interface Props {
  companyId: string
  members: Member[]
  projects: ProjectOption[]
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  centralist: 'Centralist',
  planner: 'Planner',
  runner: 'Runner',
}

function AssignProjectRow({ member, projects, companyId }: { member: Member; projects: ProjectOption[]; companyId: string }) {
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedRole, setSelectedRole] = useState('centralist')
  const [, startTransition] = useTransition()

  const assignedIds = new Set(member.projectMemberships.map(m => m.project_id))
  const availableProjects = projects.filter(p => !assignedIds.has(p.id))

  function handleAssign() {
    if (!selectedProject) return
    startTransition(async () => {
      await assignMemberToProject(member.user_id, selectedProject, selectedRole)
      setSelectedProject('')
    })
  }

  return (
    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
      {/* Current project memberships */}
      {member.projectMemberships.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {member.projectMemberships.map(pm => (
            <ProjectBadge
              key={pm.project_id}
              userId={member.user_id}
              projectId={pm.project_id}
              projectName={pm.project_name}
              role={pm.role}
            />
          ))}
        </div>
      )}

      {/* Assign to new project */}
      {availableProjects.length > 0 && (
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="flex-1 min-w-0 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">+ Project toewijzen</option>
            {availableProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedProject && (
            <>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="centralist">Centralist</option>
                <option value="company_admin">Company Admin</option>
              </select>
              <button
                onClick={handleAssign}
                className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors shrink-0"
              >
                Toewijzen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ProjectBadge({ userId, projectId, projectName, role }: { userId: string; projectId: string; projectName: string; role: string }) {
  const [, startTransition] = useTransition()

  function handleRemove() {
    startTransition(async () => { await removeMemberFromProject(userId, projectId) })
  }

  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs">
      {projectName}
      <span className="text-slate-400 dark:text-slate-500">· {roleLabels[role] || role}</span>
      <button
        onClick={handleRemove}
        className="ml-0.5 w-4 h-4 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        title="Verwijderen uit project"
      >
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}

function MemberRow({ member, companyId, projects }: { member: Member; companyId: string; projects: ProjectOption[] }) {
  const [, startTransition] = useTransition()
  const initials = (member.full_name || member.email).slice(0, 2).toUpperCase()

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value
    startTransition(async () => { await updateMemberRole(member.user_id, companyId, role) })
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          {member.full_name && (
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{member.full_name}</p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</p>
        </div>
        <select
          value={member.role}
          onChange={handleRoleChange}
          className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 shrink-0"
        >
          <option value="centralist">Centralist</option>
          <option value="company_admin">Company Admin</option>
        </select>
      </div>
      <AssignProjectRow member={member} projects={projects} companyId={companyId} />
    </div>
  )
}

export function UsersTab({ companyId, members, projects }: Props) {
  return (
    <div className="space-y-3">
      <InviteUserDialog companyId={companyId} />

      {members.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">Geen gebruikers gevonden.</p>
      ) : (
        members.map(member => (
          <MemberRow key={member.user_id} member={member} companyId={companyId} projects={projects} />
        ))
      )}
    </div>
  )
}
