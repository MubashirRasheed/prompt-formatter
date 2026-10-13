const SEG_MARKER = /[*_]*\s*\[\s*SEG(?:MENT)?\s+\d{1,4}\b[^\]]*\]\s*[*_]*/i
const LABEL_START = /^[\s—–-]*([A-Za-z][A-Za-z.]{1,24}(?: [A-Za-z.]{1,24})?)\s*:/

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function phrasePattern(phrase: string): RegExp {
  if (SEG_MARKER.test(phrase)) return new RegExp(SEG_MARKER.source, 'gi')

  // "— CONCEPT: anything" removes from that label to the end of every line that has it.
  const label = phrase.match(LABEL_START)
  if (label) return new RegExp(`[ \\t]*[—–-]*[ \\t]*${escape(label[1])}\\s*:.*$`, 'gim')

  // Numbers match any number and dashes match any dash, so BATCH 6: Visuals 126–150 also removes BATCH 7.
  const shape = escape(phrase)
    .replace(/\d+/g, '\\d+')
    .replace(/[—–-]/g, '[—–-]')
    .replace(/\s+/g, '\\s+')
  return new RegExp(shape, 'gi')
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
