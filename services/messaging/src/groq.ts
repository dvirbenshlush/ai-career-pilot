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
  snippet: string              // 2-3 sentence AI summary
  experience_required: string  // e.g. "3+ years React, 2+ years Node"
  contact: string              // email / phone / application link extracted from message
  source: 'whatsapp' | 'telegram'
  source_name: string
  match_score: number
  raw_message: string          // full original message text
}

const CHUNK_SIZE = 5          // messages per Groq call
const MSG_PREVIEW = 500       // chars sent to Groq for classification (raw_message stored separately)

async function parseBatch(
  messages: Array<{ text: string; source: 'whatsapp' | 'telegram'; source_name: string }>,
  profileContext: string
): Promise<ParsedJob[]> {
  const batch = messages
    .map((m, i) => `[${i}] SOURCE: ${m.source}/${m.source_name}\nMESSAGE: ${m.text.slice(0, MSG_PREVIEW)}`)
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
        content: `Extract job postings from these WhatsApp/Telegram messages.
${profileContext}

MESSAGES:
${batch}

For each message that IS a job posting extract:
- title: job title
- company: company name (or "")
- location: city or "Remote" (or "")
- salary_range: salary if mentioned (or "")
- remote: true if remote/hybrid mentioned
- url: application URL if present (or "")
- tags: up to 6 skill/tech tags
- snippet: 2-3 sentence role summary
- experience_required: experience requirements verbatim/summarized (or "")
- contact: email, phone, or WhatsApp link for applying (or "")
- source: value from SOURCE field
- source_name: group/channel name from SOURCE field
- match_score: 0-100
- raw_message: the message index number as string (e.g. "0", "1")

Skip non-job messages (news, discussions, spam).
Return JSON: { "jobs": [ {...}, ... ] }`,
      },
    ],
    max_tokens: 3000,
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(jsonrepair(raw))
    const jobs = (parsed.jobs ?? []) as ParsedJob[]
    // Attach full original message text using the index returned by the model
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
  messages: Array<{ text: string; source: 'whatsapp' | 'telegram'; source_name: string }>,
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
      results.push(...jobs)
    } catch (err) {
      console.error(`Groq batch ${i}-${i + CHUNK_SIZE} failed:`, err)
    }
    // Small delay between chunks to avoid TPM burst
    if (i + CHUNK_SIZE < messages.length) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  return results
}
