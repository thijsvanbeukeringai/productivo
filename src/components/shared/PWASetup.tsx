'use client'

import { useEffect, useState } from 'react'
import { saveSubscription, removeSubscription } from '@/lib/actions/push.actions'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

interface Props {
  userId: string
}

export function PWASetup({ userId }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [swReady, setSwReady] = useState(false)

  // Register service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').then(reg => {
      setSwReady(true)
      // Check if already subscribed
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub)
      })
    })
    setPermission(Notification.permission)
  }, [])

  // Auto-subscribe if permission already granted
  useEffect(() => {
    if (permission === 'granted' && swReady && !subscribed) {
      subscribe()
    }
  }, [permission, swReady])

  async function subscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const json = sub.toJSON()
      if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
        await saveSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } })
        setSubscribed(true)
      }
    } catch {
      // Silently fail
    }
    setLoading(false)
  }

  async function requestAndSubscribe() {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') await subscribe()
  }

  async function unsubscribe() {
    setLoading(true)
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await removeSubscription(sub.endpoint)
      await sub.unsubscribe()
    }
    setSubscribed(false)
    setLoading(false)
  }

  if (!swReady || !('Notification' in window)) return null

  // Already subscribed — show nothing (silent)
  if (subscribed) return null

  // Permission denied — nothing we can do
  if (permission === 'denied') return null

  // Not yet asked — show subtle prompt
  return (
    <div className="fixed bottom-20 left-4 z-40 max-w-xs bg-slate-900 dark:bg-slate-700 text-white rounded-xl shadow-xl p-3 flex items-start gap-3">
      <span className="text-xl shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">Pushmeldingen inschakelen</p>
        <p className="text-[11px] text-slate-300 mt-0.5">Ontvang een melding als je getagd of toegewezen wordt.</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={requestAndSubscribe}
            disabled={loading}
            className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            Inschakelen
          </button>
          <button
            onClick={() => setPermission('denied')}
            className="px-2.5 py-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Niet nu
          </button>
        </div>
      </div>
    </div>
  )
}
