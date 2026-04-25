import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const returnTo = req.nextUrl.searchParams.get('state') ?? '/jobs'
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL(`${returnTo}?gmail_error=${error ?? 'cancelled'}`, req.url))
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL(`${returnTo}?gmail_error=token_exchange_failed`, req.url))
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
  }

  // Get user email from Google
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = profileRes.ok ? await profileRes.json() as { email?: string } : {}

  // Save tokens to Supabase
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const html = `<p style="font-family:sans-serif;color:red">שגיאה: לא נמצא משתמש מחובר. נסה להתחבר לאתר ולחזור.</p><script>setTimeout(()=>window.close(),5000)</script>`
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  const { error: upsertErr } = await supabase.from('google_tokens').upsert({
    user_id: user.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: Date.now() + tokens.expires_in * 1000,
    email: profile.email ?? null,
  }, { onConflict: 'user_id' })

  if (upsertErr) {
    const html = `<p style="font-family:sans-serif;color:red">שגיאת DB: ${upsertErr.message}</p><script>setTimeout(()=>window.close(),8000)</script>`
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  // Close popup. Google's COOP headers null out window.opener after OAuth,
  // so postMessage is unreliable — the parent polls /api/gmail/status instead.
  const html = `
    <script>
      try { window.opener?.postMessage({ type: 'GMAIL_AUTH_SUCCESS' }, '*') } catch(e) {}
      window.close();
      setTimeout(() => { window.location.href = '${returnTo}?gmail_connected=1' }, 300);
    </script>
    <p>Gmail חובר בהצלחה. החלון ייסגר...</p>
  `
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
