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
    maxAgeDays?: number
  }
  const { action, groupIds, userProfile, maxAgeDays = 7 } = body

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
    const { ok, status, text } = await proxyPost('/whatsapp/scan', { groupIds, userProfile, maxAgeDays })
    if (!ok) return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })

    const data = JSON.parse(text) as { jobs: unknown[]; messagesScanned: number }

    // Save found jobs to Supabase job_opportunities (best-effort — don't fail if not logged in)
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user && data.jobs.length > 0) {
        type Job = {
          title?: string; company?: string; location?: string
          salary_range?: string; remote?: boolean; url?: string
          match_score?: number; tags?: string[]; snippet?: string
          source_name?: string
        }
        await supabase.from('job_opportunities').insert(
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
          }))
        )
      }
    } catch { /* Supabase optional — don't block */ }

    return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
