import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember, getCachedStaticData } from '@/lib/supabase/session'
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

  // getSession() = local JWT decode, no network (middleware already validated)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const PAGE_SIZE = 20
  const currentPage = Math.max(1, parseInt(filters.page || '1', 10))
  const rangeFrom = (currentPage - 1) * PAGE_SIZE
  const rangeTo = rangeFrom + PAGE_SIZE - 1

  // Build log query
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

  if (filters.my_logs === '1') logQuery = logQuery.eq('logged_by', userId)
  if (filters.assigned === '1') logQuery = logQuery.or(`assigned_user_id.eq.${userId},tagged_user_ids.cs.{${userId}}`)
  if (filters.info === '1') logQuery = logQuery.eq('priority', 'info')
  if (filters.subject) logQuery = logQuery.eq('subject_id', filters.subject)
  if (filters.open === '1') logQuery = logQuery.eq('status', 'open')
  if (filters.photos === '1') logQuery = logQuery.not('image_urls', 'eq', '{}')

  // All queries in parallel — member + static data (cached) + logs + assigned logs
  const [currentMember, staticData, { data: logs, count: totalLogs }, { data: assignedLogs }] = await Promise.all([
    getCachedMember(projectId, userId),
    getCachedStaticData(projectId),
    logQuery,
    supabase
      .from('logs')
      .select('id, incident_text, status, priority, created_at, subject_id, area_id, assigned_user_id, tagged_user_ids, log_number, subject:subjects(id,name,color), area:areas(id,name)')
      .eq('project_id', projectId)
      .or(`assigned_user_id.eq.${userId},tagged_user_ids.cs.{${userId}}`)
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
  ])

  if (!currentMember) redirect('/dashboard')

  const canEdit = ['super_admin', 'company_admin', 'centralist', 'planner'].includes(currentMember.role)
  const canAdmin = ['super_admin', 'company_admin'].includes(currentMember.role)
  const displayMode = (currentMember.display_mode || 'dynamic') as 'dynamic' | 'fixed' | 'cp_org'

  const { subjects, areas, teams, positions, rawMembers } = staticData
  const members: MemberOption[] = (rawMembers as any[]).map((m) => {
    const profile = m.profiles as Profile | null
    return {
      id: m.user_id,
      display_name: m.custom_display_name || profile?.full_name || profile?.email || m.user_id,
    }
  })

  if (!logs) notFound()

  return (
    <>
      <AssignedLogsBanner
        initialLogs={(assignedLogs as unknown as Log[]) || []}
        allLogs={(logs as unknown as Log[]) || []}
        projectId={projectId}
        userId={userId}
        subjects={subjects}
        areas={areas}
        teams={teams}
        members={members}
        canEdit={canEdit}
        displayMode={displayMode}
      />
      <PWASetup userId={userId} />
      <ProjectChat
        projectId={projectId}
        currentUserId={userId}
        currentDisplayName={currentMember.custom_display_name || (currentMember.profiles as unknown as Profile | null)?.full_name || session.user.email || 'Onbekend'}
        members={members.filter(m => m.id !== userId).map(m => ({ user_id: m.id, display_name: m.display_name }))}
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
