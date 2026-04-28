import { NextRequest, NextResponse } from 'next/server'
import { groqChat } from '@/lib/ai/groq'
import { anonymize } from '@/lib/pii'
import { resolveUser } from '@/lib/extension/auth'
import { createAdminClient } from '@/lib/supabase/admin'

async function getValidAccessToken(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null
  if (Number(data.expires_at) > Date.now() + 60_000) return data.access_token
  if (!data.refresh_token) {
    await admin.from('google_tokens').delete().eq('user_id', userId)
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
    await admin.from('google_tokens').delete().eq('user_id', userId)
    return null
  }
  const tokens = await res.json() as { access_token: string; expires_in: number }
  await admin.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  }).eq('user_id', userId)

  return tokens.access_token
}

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    jobTitle, company, jobDescription,
    resumeText: resumeTextInput,
    language = 'he',
  } = await req.json() as {
    jobTitle?: string
    company?: string
    jobDescription: string
    resumeText?: string
    language?: 'he' | 'en'
  }

  if (!jobDescription?.trim()) {
    return NextResponse.json({ error: 'jobDescription required' }, { status: 400 })
  }

  let resumeText = resumeTextInput?.trim() ?? ''
  let userName = ''

  const admin = createAdminClient()

  // Get user display name for filename
  const { data: { user: authUser } } = await admin.auth.admin.getUserById(user.id)
  userName = authUser?.user_metadata?.full_name
    || authUser?.user_metadata?.name
    || authUser?.email?.split('@')[0]
    || ''

  if (!resumeText) {
    const { data: resumes } = await admin
      .from('resumes')
      .select('parsed_text')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!resumes?.length || !resumes[0].parsed_text) {
      return NextResponse.json({ error: 'noResume' }, { status: 404 })
    }
    resumeText = resumes[0].parsed_text
  }

  resumeText = anonymize(resumeText.slice(0, 3000)).text
  const langLabel = language === 'en' ? 'English' : 'Hebrew'

  const result = await groqChat({
    messages: [
      {
        role: 'system',
        content: `You are an expert resume writer. Output a complete, professional resume in ${langLabel}. Write the entire resume in ${langLabel} regardless of the original language. Use clean formatting with clear sections.`,
      },
      {
        role: 'user',
        content: `Tailor this resume for the job below. Keep all true facts — only reorder, emphasize, and rephrase to match requirements. Do not invent experience.

CRITICAL RULES:
- NEVER write placeholder text such as [Phone], [Email], [Address], [City], [LinkedIn], [Date], [Company Name], etc.
- If a piece of information is not present in the original resume, omit that field or section entirely — do not leave a placeholder.
- Only include information that actually exists in the original resume.

JOB TITLE: ${jobTitle ?? 'N/A'}
COMPANY: ${company ?? 'N/A'}
JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

ORIGINAL RESUME:
${resumeText}

Output the full tailored resume in ${langLabel}, ready to paste into a document.`,
      },
    ],
    max_tokens: 2000,
  })

  const tailoredText = result.choices[0]?.message?.content?.trim() ?? ''
  if (!tailoredText) return NextResponse.json({ error: 'Failed to generate resume' }, { status: 500 })

  // Generate PDF (non-blocking — returns null on failure)
  let pdfBase64: string | null = null
  try {
    const { textToPdf } = await import('@/lib/pdf')
    const buf = await textToPdf(tailoredText)
    pdfBase64 = buf.toString('base64')
  } catch { /* PDF generation optional */ }

  // Try Google Docs (optional — requires drive.file scope)
  const accessToken = await getValidAccessToken(user.id)
  if (!accessToken) {
    return NextResponse.json({ tailoredText, pdfBase64, userName })
  }

  const docTitle = `קו"ח מותאם — ${jobTitle ?? 'משרה'}${company ? ` | ${company}` : ''}`

  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: docTitle }),
  })

  if (!createRes.ok) return NextResponse.json({ tailoredText, pdfBase64, userName })

  const doc = await createRes.json() as { documentId: string }

  await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: tailoredText } }],
    }),
  })

  const docUrl = `https://docs.google.com/document/d/${doc.documentId}/edit`
  return NextResponse.json({ tailoredText, pdfBase64, docUrl, userName })
}
