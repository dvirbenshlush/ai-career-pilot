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
    .single()

  if (!data) return null
  if (data.expires_at > Date.now() + 60_000) return data.access_token
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
  await admin.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  }).eq('user_id', userId)

  return tokens.access_token
}

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobTitle, company, jobDescription } = await req.json() as {
    jobTitle?: string
    company?: string
    jobDescription: string
  }

  if (!jobDescription?.trim()) {
    return NextResponse.json({ error: 'jobDescription required' }, { status: 400 })
  }

  // Fetch user's resume
  const admin = createAdminClient()
  const { data: resumes } = await admin
    .from('resumes')
    .select('parsed_text, file_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!resumes?.length || !resumes[0].parsed_text) {
    return NextResponse.json({ error: 'לא נמצא קו"ח. העלה קו"ח תחילה באתר.' }, { status: 404 })
  }

  const resumeText = anonymize(resumes[0].parsed_text.slice(0, 3000)).text

  // Generate tailored resume via Groq
  const result = await groqChat({
    messages: [
      {
        role: 'system',
        content: 'You are an expert resume writer. Output a complete, professional resume in Hebrew or English (match the language of the original resume). Use clean formatting with clear sections.',
      },
      {
        role: 'user',
        content: `Tailor this resume for the following job. Keep all true facts from the original — only reorder, emphasize, and rephrase to better match the job requirements. Do not invent experience.

JOB TITLE: ${jobTitle ?? 'לא צוין'}
COMPANY: ${company ?? 'לא צוין'}
JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

ORIGINAL RESUME:
${resumeText}

Output the full tailored resume text, ready to paste into a document.`,
      },
    ],
    max_tokens: 2000,
  })

  const tailoredText = result.choices[0]?.message?.content?.trim() ?? ''
  if (!tailoredText) return NextResponse.json({ error: 'Failed to generate resume' }, { status: 500 })

  // Create Google Doc
  const accessToken = await getValidAccessToken(user.id)
  if (!accessToken) {
    return NextResponse.json({ tailoredText, needsAuth: true })
  }

  const docTitle = `קו"ח מותאם — ${jobTitle ?? 'משרה'}${company ? ` | ${company}` : ''}`

  // Create document
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: docTitle }),
  })

  if (!createRes.ok) {
    return NextResponse.json({ tailoredText, needsAuth: true })
  }

  const doc = await createRes.json() as { documentId: string }

  // Insert content
  await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: tailoredText,
          },
        },
      ],
    }),
  })

  const docUrl = `https://docs.google.com/document/d/${doc.documentId}/edit`
  return NextResponse.json({ tailoredText, docUrl })
}
