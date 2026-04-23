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
  snippet: string
  source: 'whatsapp' | 'telegram'
  source_name: string
  match_score: number
  raw_message: string
}

export async function parseJobMessages(
  messages: Array<{ text: string; source: 'whatsapp' | 'telegram'; source_name: string }>,
  userProfile?: string
): Promise<ParsedJob[]> {
  if (messages.length === 0) return []

  const batch = messages
    .map((m, i) => `[${i}] SOURCE: ${m.source}/${m.source_name}\nMESSAGE: ${m.text.slice(0, 600)}`)
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

For each message that contains a job posting, extract:
- title: job title
- company: company name (or empty string if unknown)
- location: location (or "Remote" or empty string)
- salary_range: salary range if mentioned (or empty string)
- remote: true if remote/hybrid mentioned
- url: URL from message if present (or empty string)
- tags: up to 5 relevant skill/tech tags
- snippet: 1-2 sentence summary of the role
- source: "whatsapp" or "telegram" (from the SOURCE field above)
- source_name: the group/channel name
- match_score: 0-100
- raw_message: first 200 chars of original message

Skip messages that are NOT job postings (news, discussions, spam, etc.).

Return JSON: { "jobs": [ {...}, ... ] }`,
      },
    ],
    max_tokens: 3000,
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(jsonrepair(raw))
    return (parsed.jobs ?? []) as ParsedJob[]
  } catch {
    return []
  }
}
