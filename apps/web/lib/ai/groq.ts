import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Model fallback chain: prefer capable model, fall back to fast model on rate limit
const MODEL_CHAIN = [
  'llama-3.3-70b-versatile',
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
      // Only fall back on rate limit errors
      if (msg.includes('rate_limit_exceeded') || msg.includes('429')) {
        lastError = e
        continue
      }
      throw e
    }
  }
  throw lastError
}
