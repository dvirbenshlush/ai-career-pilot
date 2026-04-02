import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Model fallback chain ordered by capability.
// llama-3.1-8b-instant has a hard 6K TPM request limit — gemma2-9b-it (15K TPM) handles larger payloads.
const MODEL_CHAIN = [
  'llama-3.3-70b-versatile',
  'gemma2-9b-it',
  'llama-3.1-8b-instant',
]

type ChatParams = Omit<Parameters<typeof groq.chat.completions.create>[0], 'model'>

export async function groqChat(params: ChatParams): Promise<Groq.Chat.ChatCompletion> {
  let lastError: unknown
  for (const model of MODEL_CHAIN) {
    try {
      return await groq.chat.completions.create({ ...params, model })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // Fall back on rate limit (429) or request-too-large (413) errors
      if (msg.includes('rate_limit_exceeded') || msg.includes('429') || msg.includes('413') || msg.includes('Request too large')) {
        lastError = e
        continue
      }
      throw e
    }
  }
  throw lastError
}
