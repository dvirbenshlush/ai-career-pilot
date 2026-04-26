import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import mammoth from 'mammoth'

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

  let parsedText = ''

  try {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // DOCX: extract text with mammoth
      const result = await mammoth.extractRawText({ buffer })
      parsedText = result.value.trim()
    } else {
      // PDF: extract text using pdf-parse
      try {
        const { default: pdfParse } = await import('pdf-parse')
        const result = await pdfParse(buffer)
        parsedText = result.text.trim()
      } catch {
        parsedText = buffer.toString('utf-8').replace(/[^\x20-\x7E֐-׿\n\r\t ]/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Failed to parse file: ' + msg }, { status: 500 })
  }

  if (!parsedText.trim()) {
    return NextResponse.json({ error: 'Could not extract text from this file. Try saving as a different format.' }, { status: 400 })
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
