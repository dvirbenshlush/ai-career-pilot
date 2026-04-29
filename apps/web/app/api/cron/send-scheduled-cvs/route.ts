import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { groqChat } from '@/lib/ai/groq'
import { anonymize } from '@/lib/pii'

export const maxDuration = 60

async function getAccessToken(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null
  if (Number(data.expires_at) > Date.now() + 60_000) return data.access_token
  if (!data.refresh_token) { await admin.from('google_tokens').delete().eq('user_id', userId); return null }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      refresh_token: data.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) { await admin.from('google_tokens').delete().eq('user_id', userId); return null }

  const tokens = await res.json() as { access_token: string; expires_in: number }
  await admin.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at:   Date.now() + tokens.expires_in * 1000,
  }).eq('user_id', userId)
  return tokens.access_token
}

function buildMime(params: { to: string; subject: string; body: string; pdfBuffer: Buffer; pdfFileName: string }): string {
  const { to, subject, body, pdfBuffer, pdfFileName } = params
  const boundary    = `----=_Part_${Date.now()}`
  const encodeHeader = (t: string) => `=?UTF-8?B?${Buffer.from(t, 'utf-8').toString('base64')}?=`
  const fold         = (s: string) => s.match(/.{1,76}/g)?.join('\r\n') ?? s

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

async function processSend(admin: ReturnType<typeof createAdminClient>, send: {
  id: string; user_id: string; job_title: string; company: string | null
  contact_email: string; snippet: string | null; language: string; gender: string
}) {
  const isHe = send.language !== 'en'

  // ── Get Gmail token ───────────────────────────────────────────────────────
  const accessToken = await getAccessToken(admin, send.user_id)
  if (!accessToken) throw new Error('Gmail not connected')

  // ── Fetch CV from storage ─────────────────────────────────────────────────
  const { data: resumes } = await admin
    .from('resumes')
    .select('file_url, file_name, parsed_text')
    .eq('user_id', send.user_id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!resumes?.length) throw new Error('No resume found')

  const resume      = resumes[0]
  const pdfFileName = resume.file_name ?? 'cv.pdf'

  const urlPath      = new URL(resume.file_url).pathname
  const bucketPrefix = '/storage/v1/object/public/resumes/'
  const storagePath  = urlPath.includes(bucketPrefix)
    ? urlPath.slice(urlPath.indexOf(bucketPrefix) + bucketPrefix.length)
    : urlPath.split('/resumes/')[1] ?? ''

  const { data: fileData, error: dlErr } = await admin.storage.from('resumes').download(decodeURIComponent(storagePath))
  if (dlErr || !fileData) throw new Error('Could not download resume')
  const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

  // ── Generate cover letter ─────────────────────────────────────────────────
  const genderNote = isHe
    ? (send.gender === 'female'
        ? 'הכותבת היא אישה — השתמש בגוף ראשון נקבה.'
        : 'הכותב הוא גבר — השתמש בגוף ראשון זכר.')
    : (send.gender === 'female' ? 'The writer is female.' : 'The writer is male.')

  const profileSnippet = anonymize((resume.parsed_text || send.snippet || '').slice(0, 1500)).text

  const result = await groqChat({
    messages: [
      {
        role: 'system',
        content: `You are a professional career coach. Write a genuine, human cover letter email in ${isHe ? 'Hebrew' : 'English'}. ${genderNote} Stay faithful to actual experience. If there is a gap, highlight transferable skills and express strong motivation. No placeholders.`,
      },
      {
        role: 'user',
        content: isHe
          ? `כתוב גוף מייל למשרה: ${send.job_title}${send.company ? ` ב-${send.company}` : ''}.\n${send.snippet ? `תיאור: ${send.snippet}` : ''}\nפרופיל:\n${profileSnippet}\n\nכללים: שורה ראשונה "שלום רב,", 3 פסקאות, שורה אחרונה "קורות חיים מצורפים למייל זה.", חתימה "בברכה,"`
          : `Write cover letter for: ${send.job_title}${send.company ? ` at ${send.company}` : ''}.\n${send.snippet ? `Description: ${send.snippet}` : ''}\nProfile:\n${profileSnippet}\n\nRules: First line "Dear Hiring Manager,", 3 paragraphs, last line "My resume is attached.", sign off "Best regards,"`,
      },
    ],
    max_tokens: 600,
  })

  const emailBody = result.choices[0]?.message?.content?.trim()
    ?? (isHe ? 'שלום רב,\n\nקורות חיים מצורפים למייל זה.\n\nבברכה,' : 'Dear Hiring Manager,\n\nMy resume is attached.\n\nBest regards,')

  const subject = isHe
    ? `הגשת מועמדות${send.job_title ? ` – ${send.job_title}` : ''}${send.company ? ` | ${send.company}` : ''}`
    : `Job Application${send.job_title ? ` – ${send.job_title}` : ''}${send.company ? ` | ${send.company}` : ''}`

  // ── Create Gmail draft ────────────────────────────────────────────────────
  const mime = buildMime({ to: send.contact_email, subject, body: emailBody, pdfBuffer, pdfFileName })
  const raw  = Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const draftRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  })
  if (!draftRes.ok) {
    const err = await draftRes.json()
    throw new Error(`Gmail API error: ${JSON.stringify(err)}`)
  }
}

export async function GET(req: NextRequest) {
  // Vercel passes the CRON_SECRET automatically; also allow local dev without it
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  const { data: dueSends, error } = await admin
    .from('scheduled_cv_sends')
    .select('id, user_id, job_title, company, contact_email, snippet, language, gender')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!dueSends?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  let failed    = 0

  for (const send of dueSends) {
    try {
      await processSend(admin, send)
      await admin.from('scheduled_cv_sends').update({ status: 'sent' }).eq('id', send.id)
      processed++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin.from('scheduled_cv_sends').update({ status: 'failed', error: msg }).eq('id', send.id)
      failed++
    }
  }

  return NextResponse.json({ processed, failed })
}
