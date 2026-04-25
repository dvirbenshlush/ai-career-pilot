import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groqChat } from '@/lib/ai/groq'

function encodeHeader(text: string): string {
  return `=?UTF-8?B?${Buffer.from(text, 'utf-8').toString('base64')}?=`
}

function buildEml(params: {
  to: string
  subject: string
  body: string
  pdfBuffer: Buffer
  pdfFileName: string
}): string {
  const { to, subject, body, pdfBuffer, pdfFileName } = params
  const boundary = `----=_Part_${Date.now()}`
  const bodyB64 = Buffer.from(body, 'utf-8').toString('base64')
  const pdfB64 = pdfBuffer.toString('base64')
  // Split base64 into 76-char lines (RFC 2045)
  const foldB64 = (s: string) => s.match(/.{1,76}/g)?.join('\r\n') ?? s

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
    foldB64(bodyB64),
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFileName}"`,
    `Content-Disposition: attachment; filename="${pdfFileName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    foldB64(pdfB64),
    '',
    `--${boundary}--`,
  ].join('\r\n')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobTitle, company, contactEmail, snippet, experienceRequired } = await req.json() as {
    jobTitle: string
    company: string
    contactEmail: string
    snippet?: string
    experienceRequired?: string
  }

  if (!contactEmail?.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  // Fetch user's latest resume
  const { data: resumes, error: resumeErr } = await supabase
    .from('resumes')
    .select('file_url, file_name, parsed_text')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (resumeErr || !resumes?.length) {
    return NextResponse.json({ error: 'No resume found. Please upload a CV first.' }, { status: 404 })
  }

  const resume = resumes[0]

  // Extract the storage path from the public URL and download via SDK
  // URL format: .../storage/v1/object/public/resumes/<path>
  let pdfBuffer: Buffer
  try {
    const urlPath = new URL(resume.file_url).pathname
    const bucketPrefix = '/storage/v1/object/public/resumes/'
    const storagePath = urlPath.includes(bucketPrefix)
      ? urlPath.slice(urlPath.indexOf(bucketPrefix) + bucketPrefix.length)
      : urlPath.split('/resumes/')[1] ?? ''

    if (!storagePath) throw new Error('Cannot parse storage path from URL')

    const { data: fileData, error: dlErr } = await supabase.storage
      .from('resumes')
      .download(decodeURIComponent(storagePath))

    if (dlErr || !fileData) throw dlErr ?? new Error('Empty file')
    pdfBuffer = Buffer.from(await fileData.arrayBuffer())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not download resume file: ${msg}` }, { status: 502 })
  }

  // Generate a short personalized cover letter
  const coverLetterResult = await groqChat({
    messages: [
      {
        role: 'system',
        content: 'You are a professional career coach. Write concise, human cover letter emails in Hebrew. Maximum 150 words. No fluff. No placeholders.',
      },
      {
        role: 'user',
        content: `Write a short cover letter email body for this job application.

JOB: ${jobTitle}${company ? ` at ${company}` : ''}
${snippet ? `DESCRIPTION: ${snippet}` : ''}
${experienceRequired ? `REQUIREMENTS: ${experienceRequired}` : ''}

CANDIDATE PROFILE (from resume):
${(resume.parsed_text ?? '').slice(0, 1500)}

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

  const body = coverLetterResult.choices[0]?.message?.content?.trim() ?? 'שלום רב,\n\nאשמח לשמוע על המשרה.\n\nקורות חיים מצורפים למייל זה.\n\nבברכה,'

  const subject = `הגשת מועמדות${jobTitle ? ` – ${jobTitle}` : ''}${company ? ` | ${company}` : ''}`
  const pdfFileName = resume.file_name ?? 'cv.pdf'

  const eml = buildEml({ to: contactEmail, subject, body, pdfBuffer, pdfFileName })

  return new NextResponse(eml, {
    status: 200,
    headers: {
      'Content-Type': 'message/rfc822',
      'Content-Disposition': `attachment; filename="apply-${company || 'job'}.eml"`,
    },
  })
}
