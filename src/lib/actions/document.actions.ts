'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const file = formData.get('file') as File
  const projectId = formData.get('project_id') as string

  if (!file || !file.size) return { error: 'Geen bestand geselecteerd.' }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const filename = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error: uploadError } = await supabase.storage
    .from('project-documents')
    .upload(filename, file, { contentType: file.type, upsert: false })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage
    .from('project-documents')
    .getPublicUrl(data.path)

  const { error: dbError } = await supabase.from('project_documents').insert({
    project_id: projectId,
    name: file.name,
    file_url: publicUrl,
    file_size: file.size,
    mime_type: file.type,
    uploaded_by: user.id,
  })

  if (dbError) return { error: dbError.message }

  revalidatePath(`/project/${projectId}/settings/documents`)
  return { success: true }
}

export async function deleteDocument(documentId: string, projectId: string, filePath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  // Extract path from URL
  const url = new URL(filePath)
  const path = url.pathname.split('/project-documents/')[1]
  if (path) {
    await supabase.storage.from('project-documents').remove([path])
  }

  const { error } = await supabase.from('project_documents').delete().eq('id', documentId)
  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/settings/documents`)
  return { success: true }
}
