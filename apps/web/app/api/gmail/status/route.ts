import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false })

  const { data } = await supabase
    .from('google_tokens')
    .select('email, expires_at, refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return NextResponse.json({ connected: false })

  const valid = Number(data.expires_at) > Date.now() + 60_000 || !!data.refresh_token
  return NextResponse.json({ connected: valid, email: data.email })
}
