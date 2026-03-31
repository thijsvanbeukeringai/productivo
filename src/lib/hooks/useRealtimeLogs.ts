'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Log } from '@/types/app.types'

export function useRealtimeLogs(projectId: string, initialLogs: Log[]) {
  const [logs, setLogs] = useState<Log[]>(initialLogs)

  const fetchFullLog = useCallback(async (logId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('logs')
      .select(`
        *,
        subject:subjects(*),
        area:areas(*),
        assigned_user:profiles!logs_assigned_user_id_fkey(*),
        logger:profiles!logs_logged_by_fkey(*),
        followups:log_followups(*)
      `)
      .eq('id', logId)
      .single()
    return data as Log | null
  }, [])

  useEffect(() => {
    setLogs(initialLogs)
  }, [initialLogs])

  // Immediate update when this browser creates or mutates a log (no realtime delay)
  useEffect(() => {
    function onLogCreated(e: Event) {
      const logId = (e as CustomEvent<{ logId: string }>).detail?.logId
      if (!logId) return
      fetchFullLog(logId).then(log => {
        if (log) setLogs(prev => prev.some(l => l.id === log.id) ? prev : [log, ...prev])
      })
    }
    function onLogMutated(e: Event) {
      const { logId, deleted } = (e as CustomEvent<{ logId: string; deleted?: boolean }>).detail || {}
      if (!logId) return
      if (deleted) {
        setLogs(prev => prev.filter(l => l.id !== logId))
        return
      }
      fetchFullLog(logId).then(log => {
        if (log) setLogs(prev => prev.map(l => l.id === logId ? log : l))
      })
    }
    window.addEventListener('log-created', onLogCreated)
    window.addEventListener('log-mutated', onLogMutated)
    return () => {
      window.removeEventListener('log-created', onLogCreated)
      window.removeEventListener('log-mutated', onLogMutated)
    }
  }, [fetchFullLog])

  // Cross-user realtime: listens to realtime_pings inserts (open RLS, reliable postgres_changes)
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`pings-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'realtime_pings', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          const { log_id: logId, action } = payload.new as { log_id: string; action: string }
          if (!logId) return
          if (action === 'delete') {
            setLogs(prev => prev.filter(l => l.id !== logId))
            return
          }
          const fullLog = await fetchFullLog(logId)
          if (!fullLog) return
          if (action === 'insert') {
            setLogs(prev => prev.some(l => l.id === fullLog.id) ? prev : [fullLog, ...prev])
          } else {
            setLogs(prev => prev.map(l => l.id === fullLog.id ? fullLog : l))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, fetchFullLog])

  return logs
}
