import { NextRequest, NextResponse } from 'next/server'
import { groqChat } from '@/lib/ai/groq'
import { jsonrepair } from 'jsonrepair'

export interface AnswerFeedback {
  score: number        // 1–10
  analysis: string     // 2-3 sentences in Hebrew
  improvements: string[] // 1-2 specific tips
}

export async function POST(req: NextRequest) {
  const { question, answer, jobTitle, company, category } = await req.json() as {
    question: string
    answer: string
    jobTitle?: string
    company?: string
    category?: string
  }

  if (!question || !answer?.trim()) {
    return NextResponse.json({ error: 'שאלה או תשובה חסרות' }, { status: 400 })
  }

  const result = await groqChat({
    messages: [
      {
        role: 'system',
        content: `You are a senior interviewer and career coach evaluating a candidate's answer.
Respond ONLY with a JSON object, no markdown.
Format: {"score": <1-10>, "analysis": "<2-3 sentences in Hebrew>", "improvements": ["<tip1>", "<tip2>"]}
Be honest and constructive. Score 1-4 = weak, 5-7 = good, 8-10 = excellent.`,
      },
      {
        role: 'user',
        content: `ROLE: ${jobTitle ?? 'משרה'}${company ? ` at ${company}` : ''}
QUESTION TYPE: ${category ?? 'כללי'}
QUESTION: ${question}
CANDIDATE ANSWER: ${answer}

Evaluate this answer and return JSON feedback in Hebrew.`,
      },
    ],
    max_tokens: 500,
  })

  const raw = result.choices[0]?.message?.content ?? '{}'

  let feedback: AnswerFeedback
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    const jsonStr = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw
    feedback = JSON.parse(jsonrepair(jsonStr))
  } catch {
    return NextResponse.json({ error: 'שגיאה בניתוח התשובה' }, { status: 500 })
  }

  return NextResponse.json({ feedback })
}
