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

export async function GET(req: NextRequest) {
  const groupId = req.nextUrl.searchParams.get('groupId')
  if (groupId) return proxyGet(`/whatsapp/group-messages?groupId=${encodeURIComponent(groupId)}`)
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

    // Accumulate jobs from all sources — only insert ones not already in DB
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

      const validJobs = (data.jobs as Job[]).filter(j => {
        const t = j.title?.trim().toLowerCase()
        return !!t && t !== 'unknown' && t !== 'לא ידוע' && t !== 'n/a'
      })

      if (validJobs.length > 0) {
        const fps = validJobs
          .map(j => (j.raw_message || j.snippet || j.title || '').slice(0, 300).trim())
          .filter(Boolean)

        const { data: existing } = await supabase
          .from('job_opportunities')
          .select('message_fingerprint')
          .eq('user_id', user.id)
          .eq('source', 'whatsapp')
          .in('message_fingerprint', fps)

        const existingSet = new Set((existing ?? []).map(r => r.message_fingerprint))
        const newJobs = validJobs.filter(j => {
          const fp = (j.raw_message || j.snippet || j.title || '').slice(0, 300).trim()
          return !existingSet.has(fp)
        })

        if (newJobs.length > 0) {
          const { error: insertErr } = await supabase.from('job_opportunities').insert(
            newJobs.map(j => ({
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
              found_at: new Date().toISOString(),
            }))
          )
          if (insertErr) {
            console.error('[WhatsApp] insert error:', insertErr.message)
            return NextResponse.json({ ...data, dbError: insertErr.message }, { status })
          }
          console.log(`[WhatsApp] +${newJobs.length} new jobs saved (${validJobs.length - newJobs.length} already in DB)`)
        } else {
          console.log(`[WhatsApp] all ${validJobs.length} jobs already in DB — nothing new`)
        }
      }
    } catch (e) { console.error('[WhatsApp] save error:', e) }

    return new NextResponse(text, { status, headers: { 'Content-Type': 'application/json' } })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
