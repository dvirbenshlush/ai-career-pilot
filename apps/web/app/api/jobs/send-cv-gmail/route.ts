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
    .maybeSingle()

  if (!data) return null

  if (Number(data.expires_at) > Date.now() + 60_000) return data.access_token

  if (!data.refresh_token) {
    await supabase.from('google_tokens').delete().eq('user_id', userId)
    return null
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    await supabase.from('google_tokens').delete().eq('user_id', userId)
    return null
  }

  const tokens = await res.json() as { access_token: string; expires_in: number }
  await supabase.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  }).eq('user_id', userId)

  return tokens.access_token
}

// ── MIME builder ──────────────────────────────────────────────────────────────

function buildMime(params: {
  to: string; subject: string; body: string
  pdfBuffer: Buffer; pdfFileName: string
}): string {
  const { to, subject, body, pdfBuffer, pdfFileName } = params
  const boundary = `----=_Part_${Date.now()}`
  const encodeHeader = (t: string) => `=?UTF-8?B?${Buffer.from(t, 'utf-8').toString('base64')}?=`
  const fold = (s: string) => s.match(/.{1,76}/g)?.join('\r\n') ?? s

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
    fold(Buffer.from(body, 'utf-8').toString('base64')),
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFileName}"`,
    `Content-Disposition: attachment; filename="${pdfFileName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    fold(pdfBuffer.toString('base64')),
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

  const {
    jobTitle, company, contactEmail, snippet, experienceRequired,
    gender, language = 'he', tailoredPdfB64,
  } = await req.json() as {
    jobTitle: string
    company: string
    contactEmail: string
    snippet?: string
    experienceRequired?: string
    gender?: 'male' | 'female'
    language?: 'he' | 'en'
    tailoredPdfB64?: string
  }

  if (!contactEmail?.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const accessToken = await getValidAccessToken(supabase, user.id)
  if (!accessToken) {
    return NextResponse.json({ needsAuth: true }, { status: 401 })
  }

  // ── Resolve PDF ───────────────────────────────────────────────────────────
  let pdfBuffer: Buffer
  let pdfFileName: string
  let resumeParsedText = ''

  if (tailoredPdfB64) {
    pdfBuffer = Buffer.from(tailoredPdfB64, 'base64')
    pdfFileName = language === 'en' ? 'tailored-cv.pdf' : 'קורות-חיים-מותאמים.pdf'
  } else {
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
    pdfFileName = resume.file_name ?? 'cv.pdf'
    resumeParsedText = resume.parsed_text ?? ''

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
  }

  // ── Generate cover letter ─────────────────────────────────────────────────
  const isHe = language !== 'en'

  const genderNote = isHe
    ? (gender === 'female'
        ? 'הכותבת היא אישה — השתמש בגוף ראשון נקבה (לדוגמה: מעוניינת, שמחה, בטוחה, מצורפים).'
        : 'הכותב הוא גבר — השתמש בגוף ראשון זכר (לדוגמה: מעוניין, שמח, בטוח, מצורפים).')
    : (gender === 'female'
        ? 'The writer is female — use first-person feminine phrasing.'
        : 'The writer is male — use first-person masculine phrasing.')

  const profileSnippet = anonymize((resumeParsedText || snippet || '').slice(0, 1500)).text

  const coverLetterResult = await groqChat({
    messages: [
      {
        role: 'system',
        content: `You are a professional career coach. Write concise, human cover letter emails in ${isHe ? 'Hebrew' : 'English'}. Maximum 150 words. No fluff. No placeholders. ${genderNote}`,
      },
      {
        role: 'user',
        content: isHe
          ? `Write a short cover letter email body for this job application.

JOB: ${jobTitle}${company ? ` at ${company}` : ''}
${snippet ? `DESCRIPTION: ${snippet}` : ''}
${experienceRequired ? `REQUIREMENTS: ${experienceRequired}` : ''}

CANDIDATE PROFILE:
${profileSnippet}

Rules:
- Write in Hebrew
- First line: "שלום רב,"
- 2-3 short paragraphs: brief intro, why this role, closing
- Last line: "קורות חיים מצורפים למייל זה."
- Sign off with "בברכה,"`
          : `Write a short cover letter email body for this job application.

JOB: ${jobTitle}${company ? ` at ${company}` : ''}
${snippet ? `DESCRIPTION: ${snippet}` : ''}
${experienceRequired ? `REQUIREMENTS: ${experienceRequired}` : ''}

CANDIDATE PROFILE:
${profileSnippet}

Rules:
- Write in English
- First line: "Dear Hiring Manager,"
- 2-3 short paragraphs: brief intro, why this role, closing
- Last line: "My resume is attached."
- Sign off with "Best regards,"`,
      },
    ],
    max_tokens: 400,
  })

  const emailBody = coverLetterResult.choices[0]?.message?.content?.trim()
    ?? (isHe
        ? 'שלום רב,\n\nאשמח לשמוע על המשרה.\n\nקורות חיים מצורפים למייל זה.\n\nבברכה,'
        : 'Dear Hiring Manager,\n\nI am interested in this role. My resume is attached.\n\nBest regards,')

  const subject = isHe
    ? `הגשת מועמדות${jobTitle ? ` – ${jobTitle}` : ''}${company ? ` | ${company}` : ''}`
    : `Job Application${jobTitle ? ` – ${jobTitle}` : ''}${company ? ` | ${company}` : ''}`

  // ── Create Gmail draft ────────────────────────────────────────────────────
  const mime = buildMime({ to: contactEmail, subject, body: emailBody, pdfBuffer, pdfFileName })
  const raw = Buffer.from(mime).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const draftRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  })

  if (!draftRes.ok) {
    const err = await draftRes.json()
    return NextResponse.json({ error: `Gmail API error: ${JSON.stringify(err)}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true, gmailUrl: 'https://mail.google.com/mail/u/0/#drafts' })
}
