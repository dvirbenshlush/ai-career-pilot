import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groqChat } from '@/lib/ai/groq'
import { anonymize } from '@/lib/pii'

// ── Token helpers ─────────────────────────────────────────────────────────────

async function getValidAccessToken(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single()

  if (!data) return null

  // Token still valid
  if (data.expires_at > Date.now() + 60_000) return data.access_token

  // Try to refresh
  if (!data.refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) return null

  const tokens = await res.json() as { access_token: string; expires_in: number }
  await supabase.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  }).eq('user_id', userId)

  return tokens.access_token
}

// ── MIME builder ──────────────────────────────────────────────────────────────

function buildMime(params: {
  to: string
  subject: string
  body: string
  pdfBuffer: Buffer
  pdfFileName: string
}): string {
  const { to, subject, body, pdfBuffer, pdfFileName } = params
  const boundary = `----=_Part_${Date.now()}`

  const encodeHeader = (t: string) => `=?UTF-8?B?${Buffer.from(t, 'utf-8').toString('base64')}?=`
  const fold = (s: string) => s.match(/.{1,76}/g)?.join('\r\n') ?? s

  const bodyB64 = fold(Buffer.from(body, 'utf-8').toString('base64'))
  const pdfB64 = fold(pdfBuffer.toString('base64'))

  return [
    'MIME-Version: 1.0',
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFileName}"`,
    `Content-Disposition: attachment; filename="${pdfFileName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    pdfB64,
    '',
    `--${boundary}--`,
  ].join('\r\n')
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { resolveUser } = await import('@/lib/extension/auth')
  const { createAdminClient } = await import('@/lib/supabase/admin')

  const resolved = await resolveUser(req)
  if (!resolved) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const user = { id: resolved.id }

  const { jobTitle, company, contactEmail, snippet, experienceRequired, gender } = await req.json() as {
    jobTitle: string
    company: string
    contactEmail: string
    snippet?: string
    experienceRequired?: string
    gender?: 'male' | 'female'
  }

  if (!contactEmail?.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  // Check Google token
  const accessToken = await getValidAccessToken(supabase, user.id)
  if (!accessToken) {
    return NextResponse.json({ needsAuth: true }, { status: 401 })
  }

  // Fetch user's latest resume
  const { data: resumes } = await supabase
    .from('resumes')
    .select('file_url, file_name, parsed_text')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!resumes?.length) {
    return NextResponse.json({ error: 'No resume found. Please upload a CV first.' }, { status: 404 })
  }

  const resume = resumes[0]

  // Download PDF via Supabase SDK
  let pdfBuffer: Buffer
  try {
    const urlPath = new URL(resume.file_url).pathname
    const bucketPrefix = '/storage/v1/object/public/resumes/'
    const storagePath = urlPath.includes(bucketPrefix)
      ? urlPath.slice(urlPath.indexOf(bucketPrefix) + bucketPrefix.length)
      : urlPath.split('/resumes/')[1] ?? ''

    const { data: fileData, error: dlErr } = await supabase.storage
      .from('resumes')
      .download(decodeURIComponent(storagePath))

    if (dlErr || !fileData) throw dlErr ?? new Error('Empty file')
    pdfBuffer = Buffer.from(await fileData.arrayBuffer())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not download resume: ${msg}` }, { status: 502 })
  }

  // Generate cover letter
  const genderNote = gender === 'female'
    ? 'הכותבת היא אישה — השתמש בגוף ראשון נקבה (לדוגמה: מעוניינת, שמחה, בטוחה, מצורפים).'
    : 'הכותב הוא גבר — השתמש בגוף ראשון זכר (לדוגמה: מעוניין, שמח, בטוח, מצורפים).'

  const coverLetterResult = await groqChat({
    messages: [
      {
        role: 'system',
        content: `You are a professional career coach. Write concise, human cover letter emails in Hebrew. Maximum 150 words. No fluff. No placeholders. ${genderNote}`,
      },
      {
        role: 'user',
        content: `Write a short cover letter email body for this job application.

JOB: ${jobTitle}${company ? ` at ${company}` : ''}
${snippet ? `DESCRIPTION: ${snippet}` : ''}
${experienceRequired ? `REQUIREMENTS: ${experienceRequired}` : ''}

CANDIDATE PROFILE (from resume):
${anonymize((resume.parsed_text ?? '').slice(0, 1500)).text}

Rules:
- Write in Hebrew
- First line: "שלום רב,"
- 2-3 short paragraphs: brief intro, why this role, closing
- Last line: "קורות חיים מצורפים למייל זה."
- Sign off with "בברכה,"`,
      },
    ],
    max_tokens: 400,
  })

  const body = coverLetterResult.choices[0]?.message?.content?.trim()
    ?? 'שלום רב,\n\nאשמח לשמוע על המשרה.\n\nקורות חיים מצורפים למייל זה.\n\nבברכה,'

  const subject = `הגשת מועמדות${jobTitle ? ` – ${jobTitle}` : ''}${company ? ` | ${company}` : ''}`
  const pdfFileName = resume.file_name ?? 'cv.pdf'

  const mime = buildMime({ to: contactEmail, subject, body, pdfBuffer, pdfFileName })

  // base64url encode (Gmail API requirement)
  const raw = Buffer.from(mime).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  // Create Gmail draft
  const draftRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  })

  if (!draftRes.ok) {
    const err = await draftRes.json()
    return NextResponse.json({ error: `Gmail API error: ${JSON.stringify(err)}` }, { status: 502 })
  }

  // Return Gmail drafts URL so client can open it
  return NextResponse.json({
    ok: true,
    gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
  })
}
