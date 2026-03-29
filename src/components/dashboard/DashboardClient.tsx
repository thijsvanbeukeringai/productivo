'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NewProjectDialog } from './NewProjectDialog'
import { UsersTab } from './UsersTab'
import { DeleteProjectDialog } from './DeleteProjectDialog'
import { formatDate } from '@/lib/utils/format-timestamp'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Project {
  id: string
  name: string
  location_name: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  companies?: { name: string }
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
  isAdmin: boolean
  isSuperAdmin?: boolean
  projects: Project[]
  members: Member[]
  userProjects: Project[]
}

function ProjectCard({ project, isAdmin }: { project: Project; isAdmin: boolean }) {
  const [showDelete, setShowDelete] = useState(false)

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowDelete(true)
  }

  return (
    <>
      <Link
        href={`/project/${project.id}/info`}
        className="group relative block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 hover:shadow-sm transition-all"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              project.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            }`}>
              {project.is_active ? 'Actief' : 'Inactief'}
            </span>
            {isAdmin && (
              <button
                onClick={handleDeleteClick}
                className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Project verwijderen"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <h2 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm">
          {project.name}
        </h2>

        {project.location_name && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            📍 {project.location_name}
          </p>
        )}

        {project.start_date && (
          <p className="text-xs text-slate-400 mt-2">
            {formatDate(project.start_date)}
            {project.end_date && ` — ${formatDate(project.end_date)}`}
          </p>
        )}
      </Link>

      {showDelete && (
        <DeleteProjectDialog
          project={project}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  )
}

export function DashboardClient({ companyId, isAdmin, isSuperAdmin = false, projects, members, userProjects }: Props) {
  const T = useTranslations()
  const [activeTab, setActiveTab] = useState<'projecten' | 'users'>('projecten')

  const displayProjects = isAdmin ? projects : userProjects

  return (
    <div className="flex gap-6 min-h-0">
      {/* Sidebar */}
      <aside className="w-52 shrink-0">
        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('projecten')}
            className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'projecten'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {T.dashboard.title}
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Users
            </button>
          )}

          {isSuperAdmin && (
            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
              <Link
                href="/admin"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Super Admin
              </Link>
            </div>
          )}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {activeTab === 'projecten' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{T.dashboard.title}</h1>
              {isAdmin && companyId && (
                <NewProjectDialog companyId={companyId} />
              )}
            </div>

            {displayProjects.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="font-medium">{T.dashboard.noAccess}</p>
                <p className="text-sm mt-1">Vraag uw beheerder om toegang tot een project.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayProjects.map(project => (
                  <ProjectCard key={project.id} project={project} isAdmin={isAdmin} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <div>
            <div className="mb-5">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Users</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {members.length} gebruiker{members.length !== 1 ? 's' : ''} in uw bedrijf
              </p>
            </div>
            <UsersTab companyId={companyId} members={members} projects={projects} />
          </div>
        )}
      </div>
    </div>
  )
}
