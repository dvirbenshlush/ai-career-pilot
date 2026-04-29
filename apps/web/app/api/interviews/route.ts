import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? '0')
  const month = parseInt(searchParams.get('month') ?? '0') // 1-based

  let query = supabase
    .from('interviews')
    .select(`
      *,
      job:job_opportunities ( id, title, company, url )
    `)
    .eq('user_id', user.id)
    .order('interview_date', { ascending: true })
    .order('interview_time', { ascending: true })

  if (year && month) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    query = query.gte('interview_date', from).lte('interview_date', to)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ interviews: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    job_opportunity_id,
    title,
    company,
    interview_date,
    interview_time,
    location,
    notes,
  } = await req.json() as {
    job_opportunity_id?: string | null
    title: string
    company?: string | null
    interview_date: string
    interview_time?: string | null
    location?: string | null
    notes?: string | null
  }

  if (!title?.trim() || !interview_date) {
    return NextResponse.json({ error: 'title and interview_date are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('interviews')
    .insert({
      user_id: user.id,
      job_opportunity_id: job_opportunity_id ?? null,
      title: title.trim(),
      company: company ?? null,
      interview_date,
      interview_time: interview_time ?? null,
      location: location ?? null,
      notes: notes ?? null,
    })
    .select(`
      *,
      job:job_opportunities ( id, title, company, url )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ interview: data }, { status: 201 })
}
