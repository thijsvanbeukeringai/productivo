'use server'

import { createClient } from '@/lib/supabase/server'

export async function sendMessage(projectId: string, content: string, displayName: string, receiverId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const { error } = await supabase.from('project_messages').insert({
    project_id: projectId,
    sender_id: user.id,
    receiver_id: receiverId,
    display_name_snapshot: displayName,
    content,
    is_read: false,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function markMessagesRead(projectId: string, senderId: string, receiverId: string) {
  const supabase = await createClient()
  await supabase
    .from('project_messages')
    .update({ is_read: true })
    .eq('project_id', projectId)
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .eq('is_read', false)
}
