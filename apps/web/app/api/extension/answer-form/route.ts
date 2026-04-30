import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groqChat } from '@/lib/ai/groq'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { questions, jobTitle, company } = await req.json() as {
    questions: string[]
    jobTitle?: string
    company?: string
  }

  if (!questions?.length) {
    return NextResponse.json({ error: 'No questions provided' }, { status: 400 })
  }

  const [resumeRes, profileRes] = await Promise.all([
    supabase
      .from('resumes')
      .select('parsed_text')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('user_profiles')
      .select('summary, achievements, skills, certifications, languages, extra_notes')
      .eq('user_id', user.id)
      .single(),
  ])

  const resumeText = resumeRes.data?.[0]?.parsed_text ?? ''
  const profile = profileRes.data

  const profileBlock = profile ? [
    profile.summary ? `סיכום: ${profile.summary}` : '',
    profile.achievements?.length ? `הישגים: ${profile.achievements.join(' | ')}` : '',
    profile.skills?.length ? `כישורים: ${profile.skills.join(', ')}` : '',
    profile.certifications?.length ? `הסמכות: ${profile.certifications.join(', ')}` : '',
    profile.languages?.length ? `שפות: ${profile.languages.join(', ')}` : '',
    profile.extra_notes ? `הערות: ${profile.extra_notes}` : '',
  ].filter(Boolean).join('\n') : ''

  const prompt = `אתה עוזר מקצועי למציאת עבודה. ענה על שאלות טופס הגשת מועמדות בהתבסס על פרופיל המועמד וקורות החיים שלו.

${jobTitle || company ? `משרה: ${jobTitle ?? ''}${company ? ` ב-${company}` : ''}` : ''}

פרופיל המועמד:
${profileBlock || 'לא סופק'}

קורות חיים:
${resumeText.slice(0, 2000) || 'לא סופקו'}

ענה על כל שאלה בנפרד. החזר JSON בלבד:
{
  "answers": [
    { "question": "השאלה המקורית", "answer": "התשובה" }
  ]
}

כללים:
- ענה בשפה שבה נכתבה השאלה (עברית/אנגלית)
- תשובות קצרות וממוקדות למילוי טופס
- אם אין מידע מספק — ציין "יש למלא ידנית"
- לשאלות yes/no — ענה בצורה ברורה

שאלות לענות:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`

  const result = await groqChat({
    messages: [
      { role: 'system', content: 'You are a JSON API. Respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1500,
  })

  try {
    const content = result.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }
}
