const SEG_MARKER = /[*_]*\s*\[\s*SEG(?:MENT)?\s+\d{1,4}\b[^\]]*\]\s*[*_]*/i

function phrasePattern(phrase: string): RegExp {
  if (SEG_MARKER.test(phrase)) return new RegExp(SEG_MARKER.source, 'gi')
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped, 'gi')
}

export function stripCustomPhrases(raw: string, phrases: string): string {
  const items = phrases
    .split(/\r?\n/)
    .map((phrase) => phrase.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (!items.length) return raw

  let text = raw
  for (const phrase of items) {
    text = text.replace(phrasePattern(phrase), '')
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
}
