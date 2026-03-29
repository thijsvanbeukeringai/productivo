'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendPushToUser } from './push.actions'

export async function createTagNotifications(
  projectId: string,
  logId: string,
  taggedUserIds: string[],
  taggerName: string,
) {
  if (!taggedUserIds.length) return
  const supabase = await createClient()

  const message = `${taggerName} heeft je getagd in een melding`
  const url = `/project/${projectId}?log=${logId}`

  await supabase.from('notifications').insert(
    taggedUserIds.map(userId => ({
      project_id: projectId,
      user_id: userId,
      log_id: logId,
      message,
      is_read: false,
    }))
  )

  // Push notifications parallel
  await Promise.allSettled(
    taggedUserIds.map(userId => sendPushToUser(userId, 'IMS — Getagd', message, url))
  )
}

export async function createAssignNotification(
  projectId: string,
  logId: string,
  assignedUserId: string,
  assignerName: string,
) {
  const supabase = await createClient()
  const message = `${assignerName} heeft je toegewezen aan een melding`
  const url = `/project/${projectId}?log=${logId}`

  await supabase.from('notifications').insert({
    project_id: projectId,
    user_id: assignedUserId,
    log_id: logId,
    message,
    is_read: false,
  })

  await sendPushToUser(assignedUserId, 'IMS — Toegewezen', message, url)
}

export async function markNotificationsRead(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('is_read', false)

  revalidatePath(`/project/${projectId}`)
}
