import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MESSAGING_URL = process.env.MESSAGING_SERVICE_URL ?? 'http://localhost:3001'

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

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    action: string
    botToken?: string
    channels?: string[]
    userProfile?: string
  }
  const { action, botToken, channels, userProfile } = body

  if (action === 'validate') {
    const { text, status } = await proxyPost('/telegram/validate', { botToken })
    return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'scan') {
    const { ok, status, text } = await proxyPost('/telegram/scan', { botToken, channels, userProfile })
    if (!ok) return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })

    const data = JSON.parse(text) as { jobs: unknown[]; messagesScanned: number }

    // Replace Telegram jobs in Supabase (delete old, insert fresh)
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('job_opportunities').delete().eq('user_id', user.id).eq('source', 'telegram')

        if (data.jobs.length > 0) {
          type Job = {
            title?: string; company?: string; location?: string
            salary_range?: string; remote?: boolean; url?: string
            match_score?: number; tags?: string[]; snippet?: string
            source_name?: string; experience_required?: string
            contact?: string; raw_message?: string
          }
          await supabase.from('job_opportunities').insert(
            (data.jobs as Job[]).map(j => ({
              user_id: user.id,
              title: j.title || 'משרה מטלגרם',
              company: j.company || '',
              location: j.location || '',
              salary_range: j.salary_range || null,
              remote: j.remote ?? false,
              url: j.url || '',
              match_score: j.match_score ?? 50,
              tags: j.tags || [],
              source: 'telegram',
              source_name: j.source_name || null,
              snippet: j.snippet || null,
              experience_required: j.experience_required || null,
              contact: j.contact || null,
              raw_message: j.raw_message || null,
            }))
          )
        }
      }
    } catch { /* optional */ }

    return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
