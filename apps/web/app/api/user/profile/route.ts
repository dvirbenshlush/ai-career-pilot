import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_profiles')
    .select('summary, achievements, skills, certifications, languages, extra_notes')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data ?? {
    summary: '', achievements: [], skills: [], certifications: [], languages: [], extra_notes: '',
  })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { summary, achievements, skills, certifications, languages, extra_notes } = body

  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      summary: summary ?? '',
      achievements: achievements ?? [],
      skills: skills ?? [],
      certifications: certifications ?? [],
      languages: languages ?? [],
      extra_notes: extra_notes ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
