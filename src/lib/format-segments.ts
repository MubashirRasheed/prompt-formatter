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

function parseSegmentLines(lines: string[]): Segment[] {
  const segments: Segment[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    const heading = trimmed.match(/^SEG\s+(\d{1,4})\s*[:|]\s*(.*)$/i)
    if (!heading) continue
    segments.push({ number: Number(heading[1]), quote: heading[2] })
  }

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
  const hasSegment = lines.some((line) => /^SEG\s+\d+/i.test(line.trim()))
  const hasVisual = lines.some((line) => /^VISUAL\s+\d+/i.test(line.trim()))
  const segments = hasSegment ? parseSegmentLines(lines) : hasVisual ? parseVisualSheet(lines) : []
  return reportFrom(segments)
}
