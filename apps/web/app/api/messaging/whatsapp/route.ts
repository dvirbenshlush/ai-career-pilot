import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MESSAGING_URL = process.env.MESSAGING_SERVICE_URL ?? 'http://localhost:3001'

async function proxyGet(path: string) {
  try {
    const res = await fetch(`${MESSAGING_URL}${path}`)
    const body = await res.text()
    return new NextResponse(body, { status: res.status, headers: { 'Content-Type': 'application/json' } })
  } catch {
    return NextResponse.json({ error: 'Messaging service unreachable. Is it running on port 3001?' }, { status: 503 })
  }
}

async function proxyPost(path: string, body: unknown) {
  try {
    const res = await fetch(`${MESSAGING_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text }
  } catch {
    return { ok: false, status: 503, text: JSON.stringify({ error: 'Messaging service unreachable.' }) }
  }
}

export async function GET() {
  return proxyGet('/whatsapp/status')
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    action: string
    groupIds?: string[]
    userProfile?: string
  }
  const { action, groupIds, userProfile } = body

  if (action === 'connect') {
    const { text, status } = await proxyPost('/whatsapp/connect', {})
    return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'disconnect') {
    const { text, status } = await proxyPost('/whatsapp/disconnect', {})
    return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'reset') {
    const { text, status } = await proxyPost('/whatsapp/reset', {})
    return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'scan') {
    const { ok, status, text } = await proxyPost('/whatsapp/scan', { groupIds, userProfile })
    if (!ok) return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })

    const data = JSON.parse(text) as { jobs: unknown[]; messagesScanned: number }

    // Upsert jobs — keep existing, add only new (dedup by message_fingerprint)
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user && data.jobs.length > 0) {
        type Job = {
          title?: string; company?: string; location?: string
          salary_range?: string; remote?: boolean; url?: string
          match_score?: number; tags?: string[]; snippet?: string
          source_name?: string; experience_required?: string
          contact?: string; raw_message?: string; poster_name?: string
        }
        await supabase.from('job_opportunities').upsert(
          (data.jobs as Job[]).map(j => ({
            user_id: user.id,
            title: j.title || 'משרה מוואטסאפ',
            company: j.company || '',
            location: j.location || '',
            salary_range: j.salary_range || null,
            remote: j.remote ?? false,
            url: j.url || '',
            match_score: j.match_score ?? 50,
            tags: j.tags || [],
            source: 'whatsapp',
            source_name: j.source_name || null,
            snippet: j.snippet || null,
            experience_required: j.experience_required || null,
            contact: j.contact || null,
            raw_message: j.raw_message || null,
            poster_name: j.poster_name || null,
            message_fingerprint: (j.raw_message || j.snippet || j.title || '').slice(0, 300).trim() || null,
          })),
          { onConflict: 'user_id,source,message_fingerprint', ignoreDuplicates: true }
        )
      }
    } catch { /* Supabase optional — don't block */ }

    return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
