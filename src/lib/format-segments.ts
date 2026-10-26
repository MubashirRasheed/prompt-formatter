import { matchSegMarker } from './seg-marker'

export type SegmentReport = {
  text: string
  count: number
  range: [number, number] | null
  missing: number[]
}

type Segment = {
  number: number
  quote: string
}

function pad(number: number): string {
  return String(number).padStart(2, '0')
}

function spoken(text: string): string {
  return text.trim().replace(/^[“"]+|[”"]+$/g, '').trim()
}

function isRuleLine(line: string): boolean {
  return line.length >= 3 && /^[━─—\-_=*]+$/.test(line)
}

function reportFrom(segments: Segment[]): SegmentReport {
  const numbers = segments.map((segment) => segment.number)
  const unique = [...new Set(numbers)]
  const low = numbers.length ? Math.min(...numbers) : null
  const high = numbers.length ? Math.max(...numbers) : null
  const missing =
    low === null || high === null
      ? []
      : Array.from({ length: high - low + 1 }, (_, index) => low + index).filter(
          (number) => !unique.includes(number),
        )

  const text = segments.length
    ? `${segments.map((segment) => `SEG ${pad(segment.number)}: ${spoken(segment.quote)}`).join('\n')}\n`
    : ''

  return {
    text,
    count: numbers.length,
    range: low === null || high === null ? null : [low, high],
    missing,
  }
}

const LABEL =
  '(?:CONCEPT|ANCHOR|CONTINUITY|CONT|ADDRESS|ADDR|STYLE|CAMERA|NOTES?|MOTION|TEMP|CONTRAST|VISUAL|PROMPT|SHOT|MOOD|ACTION)\\.?\\s*:'
const LABEL_LINE = new RegExp(`^\\s*(?:[—–\\-→|]\\s*)?${LABEL}`, 'i')
const LABEL_CUT = new RegExp(`\\s*(?:[—–\\-|]\\s*)?\\b${LABEL}|\\s+→|\\s+\\|`, 'i')
const NUMBERED_LINE =
  /^\s*[*_#([]*\s*(?:(?:seg(?:ment)?|scene|shot|line|beat)\s*[-#.]?\s*)?(\d{1,4})\s*[*_)\]]*\s*[.):|—–-]*\s*(.*)$/i
const FIRST_QUOTE = /“([^”]+)”|"([^"]+)"|«([^»]+)»/

function spokenFrom(rest: string): string {
  const cut = rest.search(LABEL_CUT)
  const head = cut >= 0 ? rest.slice(0, cut) : rest
  const quote = head.match(FIRST_QUOTE)
  if (quote) return (quote[1] ?? quote[2] ?? quote[3] ?? '').trim()
  return head.replace(/[\s—–\-|]+$/, '').trim()
}

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim()
  return !trimmed || isRuleLine(trimmed) || LABEL_LINE.test(trimmed)
}

function parseSegmentLines(lines: string[]): Segment[] {
  const segments: Segment[] = []
  let pending: number | null = null

  for (const line of lines) {
    const marker = matchSegMarker(line)
    if (marker) {
      pending = null
      const quote = marker.quote || spokenFrom(marker.rest)
      if (quote) segments.push({ number: marker.number, quote })
      continue
    }

    const numbered = line.match(NUMBERED_LINE)
    if (numbered && !LABEL_LINE.test(numbered[2])) {
      const spoken = spokenFrom(numbered[2])
      if (spoken) {
        segments.push({ number: Number(numbered[1]), quote: spoken })
        pending = null
      } else {
        pending = Number(numbered[1])
      }
      continue
    }

    if (pending !== null && !isNoiseLine(line)) {
      const spoken = spokenFrom(line.trim())
      if (spoken) segments.push({ number: pending, quote: spoken })
      pending = null
    }
  }

  return segments
}

function parseQuotedLines(lines: string[]): Segment[] {
  const segments: Segment[] = []
  for (const line of lines) {
    if (!/^\s*[“"«]/.test(line)) continue
    const spoken = spokenFrom(line.trim())
    if (spoken) segments.push({ number: segments.length + 1, quote: spoken })
  }
  return segments
}

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseProseParagraphs(lines: string[]): Segment[] {
  const segments: Segment[] = []
  let current: string[] = []

  const flush = () => {
    const quote = current.join(' ').replace(/\s+/g, ' ').trim()
    current = []
    for (const sentence of splitSentences(quote)) {
      segments.push({ number: segments.length + 1, quote: sentence })
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || isRuleLine(trimmed)) {
      flush()
      continue
    }
    current.push(trimmed)
  }
  flush()
  return segments
}

function parseVisualSheet(lines: string[]): Segment[] {
  const segments: Segment[] = []
  let number: number | null = null
  let quote = ''

  const finish = () => {
    if (number !== null && quote.trim()) segments.push({ number, quote })
    quote = ''
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || isRuleLine(trimmed)) continue

    const visual = trimmed.match(/^VISUAL\s+(\d{1,4})\s*$/i)
    if (visual) {
      finish()
      number = Number(visual[1])
      continue
    }

    const script = trimmed.match(/^script\s*:\s*(.*)$/i)
    if (script && number !== null) quote = script[1]
  }
  finish()
  return segments
}

export function formatSegments(raw: string): SegmentReport {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/)
  const hasMarker = lines.some((line) => matchSegMarker(line))
  const hasVisual = lines.some((line) => /^VISUAL\s+\d+/i.test(line.trim()))
  if (hasVisual && !hasMarker) {
    const visual = parseVisualSheet(lines)
    if (visual.length) return reportFrom(visual)
  }
  const numbered = parseSegmentLines(lines)
  if (numbered.length) return reportFrom(numbered)
  const quoted = parseQuotedLines(lines)
  if (quoted.length) return reportFrom(quoted)
  return reportFrom(parseProseParagraphs(lines))
}
