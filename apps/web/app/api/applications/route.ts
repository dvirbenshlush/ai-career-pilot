import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['applied', 'interviewing', 'interview_scheduled', 'offer', 'rejected']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { job_opportunity_id, status } = await req.json() as { job_opportunity_id: string; status: string }
  if (!job_opportunity_id || !VALID_STATUSES.includes(status))
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  const { data, error } = await supabase
    .from('applications')
    .insert({ user_id: user.id, job_id: job_opportunity_id, status, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ application: data })
}
