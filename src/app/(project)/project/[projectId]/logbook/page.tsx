import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { LogFeed } from '@/components/logs/LogFeed'
import type { Profile, Log, MemberOption } from '@/types/app.types'
import { LogEntryNew } from '@/components/logs/LogEntryNew'
import { LogFilters } from '@/components/logs/LogFilters'
import { AssignedLogsBanner } from '@/components/logs/AssignedLogsBanner'
import { ProjectChat } from '@/components/chat/ProjectChat'
import { PWASetup } from '@/components/shared/PWASetup'

interface PageProps {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ [key: string]: string | undefined }>
}

export default async function LogbookPage({ params, searchParams }: PageProps) {
  const { projectId } = await params
  const filters = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects').select('*').eq('id', projectId).single()
  if (!project) notFound()

  const { data: currentMember } = await supabase
    .from('project_members').select('*, profiles(*)')
    .eq('project_id', projectId).eq('user_id', user.id).single()
  if (!currentMember) redirect('/dashboard')

  const canEdit = ['super_admin', 'company_admin', 'centralist', 'planner'].includes(currentMember.role)
  const canAdmin = ['super_admin', 'company_admin'].includes(currentMember.role)
  const displayMode = (currentMember.display_mode || 'dynamic') as 'dynamic' | 'fixed' | 'cp_org'

  const [subjectsRes, areasRes, membersRes, teamsRes, positionsRes] = await Promise.all([
    supabase.from('subjects').select('*').eq('project_id', projectId).eq('is_active', true).order('sort_order'),
    supabase.from('areas').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('project_members').select('user_id, custom_display_name, profiles(id, full_name, email)').eq('project_id', projectId),
    supabase.from('teams').select('*').eq('project_id', projectId).eq('is_active', true).order('number'),
    supabase.from('positions').select('*').eq('project_id', projectId).order('number'),
  ])

  const subjects = subjectsRes.data || []
  const areas = areasRes.data || []
  const teams = teamsRes.data || []
  const positions = positionsRes.data || []
  const members: MemberOption[] = (membersRes.data || [])
    .map((m) => {
      const pm = m as unknown as { user_id: string; custom_display_name: string | null; profiles: Profile | null }
      const profile = pm.profiles
      return {
        id: pm.user_id,
        display_name: pm.custom_display_name || profile?.full_name || profile?.email || pm.user_id,
      }
    })

  const PAGE_SIZE = 20
  const currentPage = Math.max(1, parseInt(filters.page || '1', 10))
  const rangeFrom = (currentPage - 1) * PAGE_SIZE
  const rangeTo = rangeFrom + PAGE_SIZE - 1

  let logQuery = supabase
    .from('logs')
    .select(`
      *,
      subject:subjects(*),
      area:areas(*),
      assigned_user:profiles!logs_assigned_user_id_fkey(*),
      logger:profiles!logs_logged_by_fkey(*),
      followups:log_followups(id,content,created_at,created_by,display_name_snapshot)
    `, { count: 'exact' })
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .range(rangeFrom, rangeTo)

  if (filters.my_logs === '1') logQuery = logQuery.eq('logged_by', user.id)
  if (filters.assigned === '1') logQuery = logQuery.or(`assigned_user_id.eq.${user.id},tagged_user_ids.cs.{${user.id}}`)
  if (filters.info === '1') logQuery = logQuery.eq('priority', 'info')
  if (filters.subject) logQuery = logQuery.eq('subject_id', filters.subject)
  if (filters.open === '1') logQuery = logQuery.eq('status', 'open')
  if (filters.photos === '1') logQuery = logQuery.not('image_urls', 'eq', '{}')

  const [{ data: logs, count: totalLogs }, { data: assignedLogs }] = await Promise.all([
    logQuery,
    supabase
      .from('logs')
      .select('id, incident_text, status, priority, created_at, subject_id, area_id, assigned_user_id, tagged_user_ids, log_number, subject:subjects(id,name,color), area:areas(id,name)')
      .eq('project_id', projectId)
      .or(`assigned_user_id.eq.${user.id},tagged_user_ids.cs.{${user.id}}`)
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
  ])

  return (
    <>
      <AssignedLogsBanner
        logs={(assignedLogs as unknown as Log[]) || []}
        allLogs={(logs as unknown as Log[]) || []}
        subjects={subjects}
        areas={areas}
        teams={teams}
        members={members}
        canEdit={canEdit}
        displayMode={displayMode}
      />
      <PWASetup userId={user.id} />
      <ProjectChat
        projectId={projectId}
        currentUserId={user.id}
        currentDisplayName={currentMember.custom_display_name || (currentMember.profiles as unknown as Profile | null)?.full_name || user.email || 'Onbekend'}
        members={members.filter(m => m.id !== user.id).map(m => ({ user_id: m.id, display_name: m.display_name }))}
      />

      <main className="flex-1 overflow-hidden flex gap-0">
        {canEdit && (
          <div className="w-1/3 shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-4">
            <LogEntryNew
              projectId={projectId}
              subjects={subjects}
              areas={areas}
              members={members}
              teams={teams}
              positions={positions}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3">
            <Suspense fallback={null}>
              <LogFilters subjects={subjects} />
            </Suspense>
          </div>

          <LogFeed
            projectId={projectId}
            initialLogs={(logs as Log[]) || []}
            subjects={subjects}
            areas={areas}
            teams={teams}
            members={members}
            canEdit={canEdit}
            displayMode={displayMode}
            currentPage={currentPage}
            totalCount={totalLogs ?? 0}
            pageSize={PAGE_SIZE}
          />
        </div>
      </main>
    </>
  )
}
