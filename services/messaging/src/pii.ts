export type PiiMap = Record<string, string>

const PATTERNS: Array<{ prefix: string; regex: RegExp }> = [
  { prefix: 'EMAIL',    regex: /[\w.+\-]+@[\w\-]+(?:\.[a-zA-Z]{2,})+/g },
  { prefix: 'LINKEDIN', regex: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%\-]+\/?/gi },
  { prefix: 'GITHUB',   regex: /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-]+\/?/gi },
  { prefix: 'URL',      regex: /https?:\/\/[^\s,)>"']{8,}/gi },
  { prefix: 'PHONE',    regex: /(?:\+972[\s\-]?|0)(?:[23489]|5[0-9])[\s\-]?\d{3}[\s\-]?\d{4}/g },
  { prefix: 'PHONE',    regex: /\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{2,5}[\s\-]?\d{2,5}(?:[\s\-]?\d{1,4})?/g },
]

export function anonymize(text: string): string {
  const counters: Record<string, number> = {}
  let out = text
  for (const { prefix, regex } of PATTERNS) {
    counters[prefix] = counters[prefix] ?? 0
    out = out.replace(regex, () => `{{${prefix}_${counters[prefix]++}}}`)
  }
  return out
}
