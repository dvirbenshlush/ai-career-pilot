import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groqChat } from '@/lib/ai/groq'
import { INTERVIEW_COACH_PROMPT } from '@/lib/ai/prompts'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { company, role, jobDescription } = await request.json()

  if (!company || !role) {
    return NextResponse.json({ error: 'Company and role are required' }, { status: 400 })
  }

  // Save job description record
  const { data: job, error: jobError } = await supabase
    .from('job_descriptions')
    .insert({
      user_id: user.id,
      title: role,
      company,
      description: jobDescription || `${role} at ${company}`,
    })
    .select()
    .single()

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })

  // Generate questions with Groq
  let responseText = ''
  try {
    const context = jobDescription || `${role} position at ${company}`
    const result = await groqChat({
      messages: [
        {
          role: 'system',
          content: 'You are a JSON API. Respond with valid JSON only — no markdown, no code fences, no explanation. Every array value must be a quoted string.',
        },
        { role: 'user', content: INTERVIEW_COACH_PROMPT(company, role, context) },
      ],
      max_tokens: 4096,
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

  // Flatten into a unified questions array for storage
  const questions = [
    ...(analysis.technical_questions ?? []).map((q: { question: string; ideal_answer_outline: string }) => ({
      type: 'technical',
      question: q.question,
      hint: q.ideal_answer_outline,
    })),
    ...(analysis.behavioral_questions ?? []).map((q: { question: string; ideal_answer_outline: string }) => ({
      type: 'behavioral',
      question: q.question,
      hint: q.ideal_answer_outline,
    })),
  ]

  // Save interview session
  const { data: session, error: sessionError } = await supabase
    .from('interview_sessions')
    .insert({
      user_id: user.id,
      job_id: job.id,
      questions,
    })
    .select('*, job_descriptions(title, company)')
    .single()

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })

  return NextResponse.json({ session, insights: analysis.company_insights, tips: analysis.prep_tips })
}
