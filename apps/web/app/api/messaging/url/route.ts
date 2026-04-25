import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MESSAGING_URL = process.env.MESSAGING_SERVICE_URL ?? 'http://localhost:3001'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { urls, userProfile } = await req.json() as { urls: string[]; userProfile?: string }

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: 'urls required' }, { status: 400 })
  }

  let serviceRes: Response
  try {
    serviceRes = await fetch(`${MESSAGING_URL}/url/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, userProfile }),
    })
  } catch {
    return NextResponse.json({ error: 'Messaging service unreachable.' }, { status: 503 })
  }

  const data = await serviceRes.json() as {
    jobs: Array<{
      title?: string; company?: string; location?: string
      salary_range?: string; remote?: boolean; url?: string
      match_score?: number; tags?: string[]; snippet?: string
      source_name?: string; experience_required?: string
      contact?: string; raw_message?: string
    }>
    errors?: string[]
  }

  if (!serviceRes.ok) {
    return NextResponse.json(data, { status: serviceRes.status })
  }

  // Save valid jobs — dedup by fingerprint
  const validJobs = (data.jobs ?? []).filter(j => {
    const t = j.title?.trim().toLowerCase()
    return !!t && t !== 'unknown' && t !== 'לא ידוע' && t !== 'n/a'
  })

  if (validJobs.length > 0) {
    const fps = validJobs.map(j =>
      (j.raw_message || j.snippet || j.title || '').slice(0, 300).trim()
    ).filter(Boolean)

    const { data: existing } = await supabase
      .from('job_opportunities')
      .select('message_fingerprint')
      .eq('user_id', user.id)
      .eq('source', 'url')
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
          source: 'url',
          source_name: j.source_name || null,
          snippet: j.snippet || null,
          experience_required: j.experience_required || null,
          contact: j.contact || null,
          raw_message: j.raw_message || null,
          message_fingerprint: (j.raw_message || j.snippet || j.title || '').slice(0, 300).trim() || null,
          found_at: new Date().toISOString(),
        }))
      )
      if (insertErr) console.error('[URL] insert error:', insertErr.message)
      else console.log(`[URL] saved ${newJobs.length} new jobs`)
    }
  }

  return NextResponse.json(data)
}
