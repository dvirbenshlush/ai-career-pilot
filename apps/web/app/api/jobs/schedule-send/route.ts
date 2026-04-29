import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SendItem {
  jobId:        string
  jobTitle:     string
  company:      string | null
  contactEmail: string
  snippet:      string | null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sends, scheduledAt, language = 'he', gender = 'male' } = await req.json() as {
    sends:       SendItem[]
    scheduledAt: string
    language?:   'he' | 'en'
    gender?:     'male' | 'female'
  }

  if (!sends?.length || !scheduledAt)
    return NextResponse.json({ error: 'sends and scheduledAt required' }, { status: 400 })

  const rows = sends.map(s => ({
    user_id:             user.id,
    job_opportunity_id:  s.jobId || null,
    job_title:           s.jobTitle,
    company:             s.company ?? null,
    contact_email:       s.contactEmail,
    snippet:             s.snippet ?? null,
    language,
    gender,
    scheduled_at:        scheduledAt,
    status:              'pending',
  }))

  const { error } = await supabase.from('scheduled_cv_sends').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: rows.length })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('scheduled_cv_sends')
    .select('id, job_title, company, contact_email, scheduled_at, status, error')
    .eq('user_id', user.id)
    .order('scheduled_at', { ascending: true })

  return NextResponse.json({ sends: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json() as { id: string }
  await supabase.from('scheduled_cv_sends').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
