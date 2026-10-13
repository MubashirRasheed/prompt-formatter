export type SegMarker = {
  number: number
  quote: string
  rest: string
}

type Pattern = {
  kind: 'bracket' | 'plain'
  re: RegExp
}

// Each pattern is one shape that already showed up, or the same shape with a different wrap.
const PATTERNS: Pattern[] = [
  // 1. **[SEG 001 — "quote"]** prompt
  {
    kind: 'bracket',
    re: /^\s*\d{1,4}\.\s*[*_]*\s*\[\s*SEG(?:MENT)?\s+(\d{1,4})\b([^\]]*)\]\s*[*_]*\s*(.*)$/i,
  },
  // 1) __[SEG 001 | "quote"]__ prompt
  {
    kind: 'bracket',
    re: /^\s*\d{1,4}\)\s*[*_]*\s*\[\s*SEG(?:MENT)?\s+(\d{1,4})\b([^\]]*)\]\s*[*_]*\s*(.*)$/i,
  },
  // (12) *[SEG 001: "quote"]* prompt
  {
    kind: 'bracket',
    re: /^\s*\(\s*\d{1,4}\s*\)\s*[*_]*\s*\[\s*SEG(?:MENT)?\s+(\d{1,4})\b([^\]]*)\]\s*[*_]*\s*(.*)$/i,
  },
  // *[SEG 001 — "quote"]* prompt, **[SEG]**, ***[SEG]***, __[SEG]__, [SEG]
  {
    kind: 'bracket',
    re: /^\s*[*_]*\s*\[\s*SEG(?:MENT)?\s+(\d{1,4})\b([^\]]*)\]\s*[*_]*\s*(.*)$/i,
  },
  // SEG 001 | "quote"    SEG 001 — "quote"    SEG 01: spoken line
  {
    kind: 'plain',
    re: /^\s*(?:\(\s*\d{1,4}\s*\)|\d{1,4}\s*[.)\-:])?\s*[*_]*\s*SEG(?:MENT)?\s+(\d{1,4})\s*[:|—–\-]+\s*(.*)$/i,
  },
  // 001 “quote” — CONCEPT: … → S1 | …
  {
    kind: 'plain',
    re: /^\s*[*_]*\s*(\d{1,4})\s*[*_]*\s*[|:—–-]?\s*([“"«].*)$/,
  },
]

function innerQuote(inside: string): string {
  const quoted = inside.match(/[“"«']([^”"»'\n]*)[”"»']/)
  return quoted ? quoted[1].trim() : ''
}

function fromBracket(number: string, inside: string, rest: string): SegMarker {
  return {
    number: Number(number),
    quote: innerQuote(inside),
    rest: rest.trim(),
  }
}

function fromPlain(number: string, tail: string): SegMarker {
  const cleaned = tail.replace(/\s*[*_]+\s*$/, '').trim()
  const quoted = cleaned.match(/^(?:“([^”]*)”|"([^"]*)"|«([^»]*)»)\s*(.*)$/)
  if (quoted) {
    const quote = quoted[1] ?? quoted[2] ?? quoted[3] ?? ''
    return { number: Number(number), quote: quote.trim(), rest: quoted[4].trim() }
  }
  return { number: Number(number), quote: cleaned, rest: '' }
}

export function matchBracketSeg(line: string): SegMarker | null {
  for (const pattern of PATTERNS) {
    if (pattern.kind !== 'bracket') continue
    const match = line.match(pattern.re)
    if (match) return fromBracket(match[1], match[2] ?? '', match[3] ?? '')
  }
  return null
}

export function matchSegMarker(line: string): SegMarker | null {
  const bracket = matchBracketSeg(line)
  if (bracket) return bracket

  for (const pattern of PATTERNS) {
    if (pattern.kind !== 'plain') continue
    const match = line.match(pattern.re)
    if (match) return fromPlain(match[1], match[2] ?? '')
  }
  return null
}
