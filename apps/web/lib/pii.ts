/**
 * PII tokenization — strip direct identifiers before sending to any AI model,
 * then inject them back into the output.
 *
 * Tokens: {{PII_EMAIL_0}}, {{PII_PHONE_0}}, {{PII_LINKEDIN_0}} …
 * AI models copy unknown tokens verbatim → reinjection works reliably.
 */

export type PiiMap = Record<string, string>

interface Pattern { prefix: string; regex: RegExp }

const PATTERNS: Pattern[] = [
  { prefix: 'EMAIL',    regex: /[\w.+\-]+@[\w\-]+(?:\.[a-zA-Z]{2,})+/g },
  { prefix: 'LINKEDIN', regex: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%\-]+\/?/gi },
  { prefix: 'GITHUB',   regex: /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-]+\/?/gi },
  { prefix: 'URL',      regex: /https?:\/\/[^\s,)>"']{8,}/gi },
  { prefix: 'PHONE',    regex: /(?:\+972[\s\-]?|0)(?:[23489]|5[0-9])[\s\-]?\d{3}[\s\-]?\d{4}/g },
  { prefix: 'PHONE',    regex: /\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{2,5}[\s\-]?\d{2,5}(?:[\s\-]?\d{1,4})?/g },
]

const EXPECTED_FIELDS = ['NAME', 'EMAIL', 'PHONE', 'LINKEDIN', 'GITHUB']

function extractName(text: string): string | null {
  const STOP = /^(summary|profile|objective|experience|skills|education|contact|about|cv|resume)/i
  for (const raw of text.split('\n').slice(0, 8)) {
    const line = raw.trim()
    if (!line || line.length > 60 || line.length < 3) continue
    if (STOP.test(line)) continue
    const words = line.split(/\s+/)
    if (words.length < 2 || words.length > 5) continue
    if (words.every(w => /^[^\d\W]{2,}/.test(w))) return line
  }
  return null
}

export function anonymize(text: string): { text: string; map: PiiMap } {
  const map: PiiMap = {}
  const counters: Record<string, number> = {}
  let out = text

  const name = extractName(text)
  if (name) {
    const token = '{{PII_NAME_0}}'
    map[token] = name
    out = out.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), token)
  }

  for (const { prefix, regex } of PATTERNS) {
    counters[prefix] = counters[prefix] ?? 0
    out = out.replace(regex, (match) => {
      const token = `{{PII_${prefix}_${counters[prefix]++}}}`
      map[token] = match
      return token
    })
  }

  // Log what was found and what was missing
  const found = new Set(Object.keys(map).map(t => t.replace(/{{PII_(\w+)_\d+}}/, '$1')))
  const missing = EXPECTED_FIELDS.filter(f => !found.has(f))
  console.log(`[pii] anonymized ${Object.keys(map).length} tokens — found: ${[...found].join(', ') || 'none'}${missing.length ? ` | missing: ${missing.join(', ')}` : ''}`)

  return { text: out, map }
}

/**
 * Deep-walk value and replace every token with its real value.
 */
export function reinject(value: unknown, map: PiiMap): unknown {
  if (!value) return value
  if (typeof value === 'string') {
    let out = value
    for (const [token, real] of Object.entries(map)) {
      out = out.split(token).join(real)
    }
    return out
  }
  if (Array.isArray(value)) return value.map(v => reinject(v, map))
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, reinject(v, map)])
    )
  }
  return value
}

/**
 * After reinject, scan for any leftover {{PII_*}} tokens the model may have dropped or invented.
 * Logs each one and removes it from the output so the CV doesn't show placeholder text.
 */
export function cleanupTokens(value: unknown): unknown {
  const TOKEN_RE = /\{\{PII_[A-Z_0-9]+\}\}/g
  if (!value) return value
  if (typeof value === 'string') {
    const leftover = value.match(TOKEN_RE)
    if (leftover) {
      console.warn(`[pii] unreinjected tokens removed from CV output: ${leftover.join(', ')}`)
    }
    return value.replace(TOKEN_RE, '')
  }
  if (Array.isArray(value)) return value.map(v => cleanupTokens(v))
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, cleanupTokens(v)])
    )
  }
  return value
}
