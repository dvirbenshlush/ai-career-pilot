import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signExtensionToken } from '@/lib/extension/token'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await signExtensionToken(user.id, user.email ?? '')
  return NextResponse.json({ token, expiresIn: 86400 })
}
