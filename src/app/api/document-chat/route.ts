import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY niet ingesteld' }, { status: 500 })

    const anthropic = new Anthropic({ apiKey })

    const { fileUrl, fileName, question, history } = await req.json()

    // Fetch the document from Supabase Storage
    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) return Response.json({ error: `Document ophalen mislukt (${fileRes.status})` }, { status: 400 })

    const contentType = fileRes.headers.get('content-type') || ''
    const buffer = await fileRes.arrayBuffer()

    const isPdf = contentType.includes('pdf') || fileName?.toLowerCase().endsWith('.pdf')

    // Build messages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = []
    for (const msg of history || []) {
      messages.push({ role: msg.role, content: msg.content })
    }

    if (isPdf) {
      const base64 = Buffer.from(buffer).toString('base64')
      messages.push({
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: question },
        ],
      })
    } else {
      const text = Buffer.from(buffer).toString('utf-8')
      messages.push({ role: 'user', content: `Document:\n\n${text}\n\nVraag: ${question}` })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Je bent een assistent die vragen beantwoordt over het document "${fileName}". Antwoord in het Nederlands. Baseer je antwoorden uitsluitend op de inhoud van het document.`,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return Response.json({ answer: text })

  } catch (err) {
    console.error('[document-chat]', err)
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
