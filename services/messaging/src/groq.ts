import Groq from 'groq-sdk'
import { jsonrepair } from 'jsonrepair'

// Lazy-initialized so dotenv has time to load before first use
let _groq: Groq | null = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

export interface ParsedJob {
  title: string
  company: string
  location: string
  salary_range: string
  remote: boolean
  url: string
  tags: string[]
  snippet: string          // 2-3 sentence AI summary
  experience_required: string  // e.g. "3+ years React, 2+ years Node"
  contact: string          // email / phone / application link extracted from message
  source: 'whatsapp' | 'telegram'
  source_name: string
  match_score: number
  raw_message: string      // full original message text
}

export async function parseJobMessages(
  messages: Array<{ text: string; source: 'whatsapp' | 'telegram'; source_name: string }>,
  userProfile?: string
): Promise<ParsedJob[]> {
  if (messages.length === 0) return []

  const batch = messages
    .map((m, i) => `[${i}] SOURCE: ${m.source}/${m.source_name}\nMESSAGE: ${m.text.slice(0, 1200)}`)
    .join('\n\n---\n\n')

  const profileContext = userProfile
    ? `USER PROFILE: ${userProfile}\nScore each job 0-100 based on how well it matches this profile.`
    : 'Set match_score to 50 for all jobs (no profile provided).'

  const completion = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a JSON API. Respond with valid JSON only — no markdown, no explanation.',
      },
      {
        role: 'user',
        content: `Extract job postings from these WhatsApp/Telegram messages.
${profileContext}

MESSAGES:
${batch}

For each message that contains a job posting, extract ALL of the following fields:
- title: job title (translate to Hebrew if needed, or keep English)
- company: company name (or empty string if unknown)
- location: city/country or "Remote" (or empty string)
- salary_range: salary / hourly rate if mentioned (or empty string)
- remote: true if remote or hybrid is mentioned
- url: full URL from message for applying (or empty string)
- tags: up to 8 relevant skill/tech/role tags (e.g. ["React","Node.js","Senior","Full-stack"])
- snippet: 2-3 sentence summary of the role — what they do, what they build, team size if mentioned
- experience_required: experience requirements extracted verbatim or summarized (e.g. "3+ שנות ניסיון ב-React, ניסיון ב-Node.js יתרון" or empty string)
- contact: how to apply — extract email address, phone number, or WhatsApp link from the message (or empty string)
- source: "whatsapp" or "telegram" (from the SOURCE field above)
- source_name: the group/channel name (from the SOURCE field above)
- match_score: 0-100
- raw_message: the COMPLETE original message text, not truncated

Skip messages that are NOT job postings (news, discussions, spam, personal messages, etc.).

Return JSON: { "jobs": [ {...}, ... ] }`,
      },
    ],
    max_tokens: 6000,
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(jsonrepair(raw))
    return (parsed.jobs ?? []) as ParsedJob[]
  } catch {
    return []
  }
}
