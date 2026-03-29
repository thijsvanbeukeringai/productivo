'use server'

import { createClient } from '@/lib/supabase/server'

export async function getReminders(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data } = await supabase
    .from('reminders')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('is_done', false)
    .order('remind_at', { ascending: true })

  return { data: data || [] }
}

export async function createReminder(projectId: string, title: string, remindAt: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const { data, error } = await supabase.from('reminders').insert({
    project_id: projectId,
    user_id: user.id,
    title,
    remind_at: remindAt,
    is_done: false,
  }).select().single()

  if (error) return { error: error.message }
  return { data }
}

export async function snoozeReminder(reminderId: string) {
  const supabase = await createClient()
  const snoozeUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('reminders')
    .update({ remind_at: snoozeUntil })
    .eq('id', reminderId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function dismissReminder(reminderId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('reminders')
    .update({ is_done: true })
    .eq('id', reminderId)

  if (error) return { error: error.message }
  return { success: true }
}
