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

  const fp = (snippet || title).slice(0, 300).trim()

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('save_job_and_apply', {
    p_user_id: user.id,
    p_title: title.trim(),
    p_company: company?.trim() ?? '',
    p_snippet: snippet?.trim() ?? '',
    p_url: url?.trim() ?? '',
    p_fingerprint: fp,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, jobId: data.jobId, applicationId: data.applicationId })
}
