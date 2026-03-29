'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markNotificationsRead } from '@/lib/actions/notification.actions'
import { formatTimestamp } from '@/lib/utils/format-timestamp'

interface Notification {
  id: string
  message: string
  is_read: boolean
  created_at: string
  log_id: string | null
}

interface Props {
  projectId: string
  userId: string
}

export function NotificationBell({ projectId, userId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    supabase
      .from('notifications')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setNotifications(data as Notification[]) })
  }, [projectId, userId])

  useEffect(() => {
    const channel = supabase
      .channel(`notif:${userId}:${projectId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, projectId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0) {
      await markNotificationsRead(projectId)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
        title="Meldingen"
      >
        <svg className={`w-5 h-5${unreadCount > 0 ? ' bell-shake' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Meldingen</span>
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Geen meldingen</p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-3 py-2.5 ${!n.is_read ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                >
                  <p className="text-xs text-slate-800 dark:text-slate-200">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatTimestamp(n.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
