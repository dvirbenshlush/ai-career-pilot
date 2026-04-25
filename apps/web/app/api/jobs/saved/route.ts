import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    title: string; company?: string; location?: string; salary_range?: string
    remote?: boolean; url?: string; match_score?: number; tags?: string[]
    source?: string; source_name?: string; snippet?: string
    experience_required?: string; contact?: string; raw_message?: string
    message_fingerprint?: string
  }

  const fp = (body.raw_message || body.snippet || body.title || '').slice(0, 300).trim()

  // Skip if already saved (same fingerprint + source)
  const { data: existing } = await supabase
    .from('job_opportunities')
    .select('id')
    .eq('user_id', user.id)
    .eq('source', body.source ?? 'search')
    .eq('message_fingerprint', fp)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, duplicate: true })

  const { error } = await supabase.from('job_opportunities').insert({
    user_id: user.id,
    title: body.title,
    company: body.company || '',
    location: body.location || '',
    salary_range: body.salary_range || null,
    remote: body.remote ?? false,
    url: body.url || '',
    match_score: body.match_score ?? 50,
    tags: body.tags || [],
    source: body.source ?? 'search',
    source_name: body.source_name || null,
    snippet: body.snippet || null,
    experience_required: body.experience_required || null,
    contact: body.contact || null,
    raw_message: body.raw_message || null,
    message_fingerprint: fp || null,
    found_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [jobsRes, appsRes] = await Promise.all([
    supabase
      .from('job_opportunities')
      .select('*')
      .eq('user_id', user.id)
      .order('match_score', { ascending: false }),
    supabase
      .from('applications')
      .select('id, status, job_id')
      .eq('user_id', user.id),
  ])

  if (jobsRes.error) return NextResponse.json({ error: jobsRes.error.message }, { status: 500 })

  const appByJob = new Map<string, { id: string; status: string }>()
  for (const a of (appsRes.data ?? [])) {
    if (a.job_id) appByJob.set(a.job_id, { id: a.id, status: a.status })
  }

  const jobs = (jobsRes.data ?? []).map(j => {
    const app = appByJob.get(j.id) ?? null
    return { ...j, application_id: app?.id ?? null, application_status: app?.status ?? null }
  })

  return NextResponse.json({ jobs })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json() as { id: string }
  const { error } = await supabase
    .from('job_opportunities')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
