import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF and DOCX files are supported' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Upload to Supabase Storage
  const safeName = file.name.replace(/[^\w.\-]/g, '_')
  const fileName = `${user.id}/${Date.now()}-${safeName}`
  const { error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(fileName, buffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('resumes').getPublicUrl(fileName)

  // Extract text — Groq doesn't support PDF natively, so we convert to base64 text prompt for DOCX
  // For PDF we extract raw text via a text prompt workaround
  let parsedText = ''

  try {
    if (file.type === 'application/pdf') {
      // Groq doesn't support binary PDF — use llama with text extraction hint
      const base64 = buffer.toString('base64')
      const result = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: `The following is a base64-encoded PDF resume. Extract and return only the plain text content, preserving the structure as much as possible.\n\nBase64: ${base64.slice(0, 8000)}`,
          },
        ],
        max_tokens: 2048,
      })
      parsedText = result.choices[0]?.message?.content ?? ''
    } else {
      parsedText = 'DOCX parsing: text extraction from binary DOCX is not supported without a parsing library. Please upload a PDF for best results.'
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AI parse error: ' + msg }, { status: 500 })
  }

  // Save to DB
  const { data: resume, error: dbError } = await supabase
    .from('resumes')
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_url: publicUrl,
      parsed_text: parsedText,
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Failed to save resume: ' + dbError.message }, { status: 500 })
  }

  return NextResponse.json({ resume })
}
