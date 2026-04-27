import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/extension/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, company, snippet, url } = await req.json() as {
    title: string
    company?: string
    snippet?: string
    url?: string
  }

  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  const admin = createAdminClient()
  const fp = (snippet || title).slice(0, 300).trim()

  // Find or create the job opportunity
  let jobId: string

  if (fp) {
    const { data: existing } = await admin
      .from('job_opportunities')
      .select('id')
      .eq('user_id', user.id)
      .eq('message_fingerprint', fp)
      .maybeSingle()

    if (existing) {
      jobId = existing.id
    } else {
      const { data: job, error } = await admin
        .from('job_opportunities')
        .insert({
          user_id: user.id,
          title: title.trim(),
          company: company?.trim() ?? '',
          snippet: snippet?.trim() ?? null,
          url: url?.trim() ?? '',
          source: 'extension',
          source_name: 'Chrome Extension',
          match_score: 70,
          message_fingerprint: fp,
          found_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      jobId = job.id
    }
  } else {
    const { data: job, error } = await admin
      .from('job_opportunities')
      .insert({
        user_id: user.id,
        title: title.trim(),
        company: company?.trim() ?? '',
        snippet: snippet?.trim() ?? null,
        url: url?.trim() ?? '',
        source: 'extension',
        source_name: 'Chrome Extension',
        match_score: 70,
        found_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    jobId = job.id
  }

  // Find or create application, always set status to applied
  const { data: existingApp } = await admin
    .from('applications')
    .select('id')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .maybeSingle()

  if (existingApp) {
    await admin
      .from('applications')
      .update({ status: 'applied', updated_at: new Date().toISOString() })
      .eq('id', existingApp.id)

    return NextResponse.json({ ok: true, jobId, applicationId: existingApp.id })
  }

  const { data: app, error: appErr } = await admin
    .from('applications')
    .insert({
      user_id: user.id,
      job_id: jobId,
      status: 'applied',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, jobId, applicationId: app.id })
}
