import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'
import { RESUME_MATCH_PROMPT } from '@/lib/ai/prompts'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { resumeId, jobTitle, company, jobDescription, jobUrl } = await request.json()

  if (!resumeId || !jobDescription) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Fetch resume
  const { data: resume } = await supabase
    .from('resumes')
    .select('parsed_text')
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .single()

  if (!resume?.parsed_text) {
    return NextResponse.json({ error: 'Resume not found or not parsed' }, { status: 404 })
  }

  // Save job description
  const { data: job, error: jobError } = await supabase
    .from('job_descriptions')
    .insert({
      user_id: user.id,
      title: jobTitle,
      company,
      description: jobDescription,
      url: jobUrl || null,
    })
    .select()
    .single()

  if (jobError) return NextResponse.json({ error: 'Failed to save job: ' + jobError.message }, { status: 500 })

  // Run AI match analysis
  let responseText = ''
  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a JSON API. Respond with valid JSON only — no markdown, no code fences, no explanation. Every array value must be a quoted string.',
        },
        { role: 'user', content: RESUME_MATCH_PROMPT(resume.parsed_text, jobDescription) },
      ],
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    })
    responseText = result.choices[0]?.message?.content ?? ''
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Groq API error: ' + msg }, { status: 500 })
  }

  let analysis
  try {
    analysis = JSON.parse(responseText)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: responseText }, { status: 500 })
  }

  // Save match result
  const { data: matchResult, error: matchError } = await supabase
    .from('match_results')
    .insert({
      resume_id: resumeId,
      job_id: job.id,
      score: analysis.score || 0,
      missing_keywords: analysis.missing_keywords || [],
      tailored_suggestions: analysis.tailored_suggestions || null,
    })
    .select()
    .single()

  if (matchError) return NextResponse.json({ error: 'Failed to save match: ' + matchError.message }, { status: 500 })

  return NextResponse.json({ matchResult, analysis, jobId: job.id })
}
