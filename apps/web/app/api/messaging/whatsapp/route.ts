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

    const data = JSON.parse(text) as { jobs: unknown[]; messagesScanned: number; scannedGroupNames?: string[] }

    // Always reflect the latest 30 messages: delete old jobs for scanned groups, insert fresh ones
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      type Job = {
        title?: string; company?: string; location?: string
        salary_range?: string; remote?: boolean; url?: string
        match_score?: number; tags?: string[]; snippet?: string
        source_name?: string; experience_required?: string
        contact?: string; raw_message?: string; poster_name?: string
      }

      const groupNames = data.scannedGroupNames ?? []

      // Delete stale jobs from every group that was just scanned
      if (groupNames.length > 0) {
        const { error: delErr } = await supabase
          .from('job_opportunities')
          .delete()
          .eq('user_id', user.id)
          .eq('source', 'whatsapp')
          .in('source_name', groupNames)
        if (delErr) console.error('[WhatsApp] delete error:', delErr.message)
      }

      const validJobs = (data.jobs as Job[]).filter(j => {
        const t = j.title?.trim().toLowerCase()
        return !!t && t !== 'unknown' && t !== 'לא ידוע' && t !== 'n/a'
      })

      if (validJobs.length > 0) {
        const { error: insertErr } = await supabase.from('job_opportunities').insert(
          validJobs.map(j => ({
            user_id: user.id,
            title: j.title!,
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
          }))
        )
        if (insertErr) console.error('[WhatsApp] insert error:', insertErr.message)
        else console.log(`[WhatsApp] replaced jobs for [${groupNames.join(', ')}] → ${validJobs.length} jobs saved`)
      } else {
        console.log(`[WhatsApp] no valid jobs found in [${groupNames.join(', ')}] — old entries cleared`)
      }
    } catch (e) { console.error('[WhatsApp] save error:', e) }

    return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
