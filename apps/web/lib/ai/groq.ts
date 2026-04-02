import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Model fallback chain ordered by capability.
// llama-3.1-8b-instant is the fast fallback when the 70b daily quota is exhausted.
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
      // Fall back on rate limit, request-too-large, or decommissioned-model errors
      if (
        msg.includes('rate_limit_exceeded') ||
        msg.includes('429') ||
        msg.includes('413') ||
        msg.includes('Request too large') ||
        msg.includes('model_decommissioned') ||
        msg.includes('decommissioned')
      ) {
        lastError = e
        continue
      }
      throw e
    }
  }
  throw lastError
}
