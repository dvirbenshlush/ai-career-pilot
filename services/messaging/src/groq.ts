import Groq from 'groq-sdk'
import { jsonrepair } from 'jsonrepair'
import { anonymize } from './pii.js'

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

const MODEL = 'llama-3.1-8b-instant'   // 500k TPD; TPM limit is 6000 so keep batches small
const CHUNK_SIZE = 4                    // 4 msgs × 200 chars ≈ ~1500 input tokens, safe under 6k TPM

function hasTitle(j: ParsedJob): boolean {
  const t = j.title?.trim().toLowerCase()
  return !!t && t !== 'unknown' && t !== 'לא ידוע' && t !== 'n/a'
}

async function parseBatch(
  messages: Array<{ text: string; source: 'whatsapp' | 'telegram'; source_name: string; sender_name?: string }>,
  profileContext: string
): Promise<ParsedJob[]> {
  const batch = messages
    .map((m, i) => {
      const sender = m.sender_name ? ` | SENDER: ${m.sender_name}` : ''
      return `[${i}] GROUP: ${m.source_name}${sender}\nMESSAGE:\n${m.text.slice(0, 200)}`
    })
    .join('\n\n---\n\n')

  const completion = await getGroq().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a JSON API. Respond with valid JSON only — no markdown, no explanation.',
      },
      {
        role: 'user',
        content: `You are analyzing WhatsApp/Telegram job-group messages. These groups are DEDICATED to job postings — treat almost every message as a potential job. Extract ALL of them.
${profileContext}

MESSAGES:
${batch}

For EVERY message extract:
- title: job title — infer from context if needed (e.g. "מפתח Full Stack", "בדיקות QA", "מנהל מוצר"). NEVER return "Unknown".
- company: company name or ""
- location: city/region/Remote/היברידי or ""
- salary_range: any salary mentioned or ""
- remote: true if remote/hybrid mentioned
- url: any application URL or ""
- tags: up to 8 skill/tech/role tags
- snippet: 2-3 sentence summary of the role
- experience_required: copy verbatim requirement lines or ""
- contact: exact email/phone/WhatsApp link or ""
- poster_name: from SENDER field or ""
- source: "whatsapp" or "telegram"
- source_name: from GROUP field
- match_score: 0-100
- raw_message: message index as string ("0","1","2"...)

Skip ONLY: messages with zero job content (pure social chat with no role/skill/hiring mention).
Return JSON: { "jobs": [ {...}, ... ] }`,
      },
    ],
    max_tokens: 1500,
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(jsonrepair(raw))
    const jobs = (parsed.jobs ?? []) as ParsedJob[]
    console.log(`[Groq] raw response: ${jobs.length} jobs — titles: ${jobs.map(j => j.title).join(' | ')}`)
    const result = jobs
      .map(j => {
        const idx = parseInt(j.raw_message, 10)
        const original = !isNaN(idx) && messages[idx] ? messages[idx].text : j.raw_message
        return { ...j, raw_message: original }
      })
      .filter(hasTitle)
    console.log(`[Groq] after title filter: ${result.length} jobs kept`)
    return result
  } catch (e) {
    console.error('[Groq] parse error:', e, 'raw:', raw.slice(0, 300))
    return []
  }
}

export async function parseJobMessages(
  rawMessages: Array<{ text: string; source: 'whatsapp' | 'telegram'; source_name: string; sender_name?: string }>,
  userProfile?: string
): Promise<ParsedJob[]> {
  const messages = rawMessages
  if (messages.length === 0) return []
  console.log(`[Groq] parseJobMessages called with ${messages.length} messages`)

  const profileContext = userProfile
    ? `USER PROFILE: ${anonymize(userProfile)}\nScore each job 0-100 based on how well it matches this profile.`
    : 'Set match_score to 50 for all jobs (no profile provided).'

  const results: ParsedJob[] = []

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE)
    try {
      const jobs = await parseBatch(chunk, profileContext)
      console.log(`[Groq] chunk ${i}-${i + chunk.length}: found ${jobs.length} jobs`)
      results.push(...jobs)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Surface rate-limit errors immediately — no point processing remaining chunks
      if (msg.includes('429') || msg.includes('rate_limit_exceeded') || msg.includes('Rate limit')) {
        const retryMatch = msg.match(/try again in ([^.]+)/)
        const retryIn = retryMatch ? ` נסה שוב בעוד ${retryMatch[1]}` : ''
        throw new Error(`מגבלת Groq הגיעה לקצה היומי.${retryIn}`)
      }
      console.error(`[Groq] chunk ${i}-${i + chunk.length} failed:`, err)
    }
  }

  return results
}
