import Groq from 'groq-sdk'
import { jsonrepair } from 'jsonrepair'

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
  experience_required: string
  contact: string           // email / phone / link for applying
  poster_name: string       // name of person who posted in the group
  source: 'whatsapp' | 'telegram'
  source_name: string
  match_score: number
  raw_message: string
}

const CHUNK_SIZE = 5

async function parseBatch(
  messages: Array<{ text: string; source: 'whatsapp' | 'telegram'; source_name: string; sender_name?: string }>,
  profileContext: string
): Promise<ParsedJob[]> {
  const batch = messages
    .map((m, i) => {
      const sender = m.sender_name ? ` | SENDER: ${m.sender_name}` : ''
      return `[${i}] GROUP: ${m.source_name}${sender}\nMESSAGE:\n${m.text.slice(0, 600)}`
    })
    .join('\n\n---\n\n')

  const completion = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a JSON API. Respond with valid JSON only — no markdown, no explanation.',
      },
      {
        role: 'user',
        content: `You are analyzing WhatsApp/Telegram messages to find job postings. Be INCLUSIVE — if a message looks even remotely like a job posting, extract it.
${profileContext}

MESSAGES:
${batch}

For each message that could be a job posting, extract ALL available details:
- title: concise job title (infer from context if not explicit, e.g. "מפתח Full Stack")
- company: company name if mentioned (or "")
- location: city/region or "Remote" or "היברידי" (or "")
- salary_range: any salary/rate mentioned — hourly, monthly, annual (or "")
- remote: true if remote or hybrid is mentioned anywhere
- url: any URL in the message for applying or more info (or "")
- tags: up to 8 skill/tech/role tags pulled from the message (e.g. ["React","Node.js","TypeScript","Senior"])
- snippet: 3-4 sentence summary of the full role — include scope, stack, team, responsibilities
- experience_required: COPY verbatim all experience/requirement lines from the message (or "")
- contact: the EXACT email address, phone number, or WhatsApp link to apply — copy it exactly as it appears (or "")
- poster_name: name of the person who posted (from SENDER field, or "")
- source: "whatsapp" or "telegram"
- source_name: group/channel name from GROUP field
- match_score: 0-100
- raw_message: the message index as a string (e.g. "0", "1", "2")

Be generous — include borderline cases. Skip ONLY clearly non-job messages (news, spam, personal chit-chat, memes).
Return JSON: { "jobs": [ {...}, ... ] }`,
      },
    ],
    max_tokens: 3000,
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(jsonrepair(raw))
    const jobs = (parsed.jobs ?? []) as ParsedJob[]
    return jobs.map(j => {
      const idx = parseInt(j.raw_message, 10)
      const original = !isNaN(idx) && messages[idx] ? messages[idx].text : j.raw_message
      return { ...j, raw_message: original }
    })
  } catch {
    return []
  }
}

export async function parseJobMessages(
  messages: Array<{ text: string; source: 'whatsapp' | 'telegram'; source_name: string; sender_name?: string }>,
  userProfile?: string
): Promise<ParsedJob[]> {
  if (messages.length === 0) return []

  const profileContext = userProfile
    ? `USER PROFILE: ${userProfile}\nScore each job 0-100 based on how well it matches this profile.`
    : 'Set match_score to 50 for all jobs (no profile provided).'

  const results: ParsedJob[] = []

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE)
    try {
      const jobs = await parseBatch(chunk, profileContext)
      console.log(`[Groq] chunk ${i}-${i + chunk.length}: found ${jobs.length} jobs`)
      results.push(...jobs)
    } catch (err) {
      console.error(`[Groq] chunk ${i}-${i + chunk.length} failed:`, err)
    }
  }

  return results
}
