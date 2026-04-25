import { NextRequest, NextResponse } from 'next/server'
import { groqChat } from '@/lib/ai/groq'
import { jsonrepair } from 'jsonrepair'

export interface InterviewQuestion {
  category: 'טכני' | 'התנהגותי' | 'חברה'
  question: string
}

export async function POST(req: NextRequest) {
  const { jobTitle, company, snippet, experienceRequired, tags } = await req.json() as {
    jobTitle?: string
    company?: string
    snippet?: string
    experienceRequired?: string
    tags?: string[]
  }

  const result = await groqChat({
    messages: [
      {
        role: 'system',
        content: `You are an expert technical recruiter and interview coach.
Generate exactly 10 interview questions in Hebrew for a job candidate.
Return ONLY a JSON array, no markdown, no explanation.
Format: [{"category":"טכני"|"התנהגותי"|"חברה","question":"..."}]
Distribution: 4 technical, 4 behavioral, 2 company/role-specific.`,
      },
      {
        role: 'user',
        content: `Generate interview questions for:
JOB: ${jobTitle ?? 'משרה'}${company ? ` at ${company}` : ''}
${snippet ? `DESCRIPTION: ${snippet}` : ''}
${experienceRequired ? `REQUIREMENTS: ${experienceRequired}` : ''}
${tags?.length ? `TECH STACK: ${tags.join(', ')}` : ''}`,
      },
    ],
    max_tokens: 1200,
  })

  const raw = result.choices[0]?.message?.content ?? '[]'

  let questions: InterviewQuestion[] = []
  try {
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    const jsonStr = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw
    questions = JSON.parse(jsonrepair(jsonStr))
  } catch {
    return NextResponse.json({ error: 'Failed to parse questions' }, { status: 500 })
  }

  return NextResponse.json({ questions })
}
