import { matchBracketSeg } from './seg-marker'

export type FormatReport = {
  text: string
  count: number
  range: [number, number] | null
  missing: number[]
  duplicates: number[]
  gluedMoved: number
  blanksAdded: number
  batchesRemoved: number
  spacesAdded: number
  numbersAdded: number
}

const TAG = 'HOOK|BUILD|INTERRUPT|PEAK|RESOLVE'
const PROMPT_SOURCE = `(?<!\\d)(\\d{1,4})\\.\\s*(\\[(?:${TAG})\\])`
const ANY_NUMBERED = /^(\d{1,4})\.\s/
const BATCH_SOURCE =
  '[*_]*\\s*Batch\\s+\\d+\\s+of\\s+\\d+(?:\\s*\\([^)\\n]*\\))?(?:\\s*[*_]{1,})?(?:\\s+complete[.!]?)?\\s*[*_]*'
const BATCH_CORE =
  /^Batch\s+(?:\d+\b|done\b).*$/i
const PART_CORE =
  /^(?:Part|Section)\s+\d+\s+of\s+\d+(?:\s*\([^)\n]*\))?(?:\s+complete[.!]?)?$/i
const NANO_CORE = /^(?:NANO[\s-]*BANANA|NANOBANANA)(?:\s+PROMPT)?\s*:?$/i
const VISUAL_CORE = /^VISUAL\s+\d{1,4}$/i

const GROUP_HEADER = /^(?:batch|part|section|chunk|set|group|round)\s*#?\s*\d+\b/i
const RANGE_HEADER =
  /^(?:visuals?|prompts?|segments?|scenes?|shots?|images?|frames?)\s*#?\s*\d+\s*(?:[–—-]|to|of)\s*\d+/i
const RANGE_ANYWHERE = /\b\d+\s*(?:[–—-]|to|of)\s*\d+\b/i

function isDividerLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (trimmed.length >= 3 && /^[━─—\-_=*#]+$/.test(trimmed)) return true
  const core = trimmed.replace(/^[*_#\s]+/, '').replace(/[*_\s]+$/, '').trim()
  if (!core) return false
  if (/^\d{1,4}\s*[.)]/.test(core) || new RegExp(`\\[(?:${TAG})\\]`, 'i').test(core)) return false
  if (BATCH_CORE.test(core) || PART_CORE.test(core) || NANO_CORE.test(core) || VISUAL_CORE.test(core)) {
    return true
  }
  const words = core.split(/\s+/).length
  if (words > 14 || core.length > 120) return false
  if (GROUP_HEADER.test(core) || RANGE_HEADER.test(core)) return true
  if (/^#{1,6}\s/.test(trimmed)) return true
  return words <= 8 && RANGE_ANYWHERE.test(core) && /\b(?:visuals?|prompts?|segments?|scenes?|shots?|images?|done|complete)\b/i.test(core)
}

const OTHER_NUMBERING =
  /^\s*[*_]*\s*(?:#\s*|No\.?\s*|(?:prompt|visual|image|shot|scene)\s*#?\s*)?\(?(\d{1,4})\)?\s*[*_]*\s*(?:[):\-–—]|\.(?=[\s*_]))\s*[*_]*\s*(.+)$/i

const BARE_INDEX = /^\s*[*_]*\s*(\d{1,4})\s+(.+)$/

function normalizeNumbering(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*\d{1,4}\.\s/.test(line)) return line
      const match = line.match(OTHER_NUMBERING) ?? line.match(BARE_INDEX)
      if (!match || /^\d/.test(match[2])) return line
      return `${Number(match[1])}. ${match[2].trim()}`
    })
    .join('\n')
}

function stripBatches(raw: string): { text: string; removed: number } {
  let removed = 0
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/)
  const kept: string[] = []

  for (const line of lines) {
    if (isDividerLine(line)) {
      removed += 1
      continue
    }
    const batch = new RegExp(BATCH_SOURCE, 'gi')
    const hits = line.match(batch)
    if (!hits) {
      kept.push(line.replace(/[ \t]+$/, ''))
      continue
    }
    removed += hits.length
    const cleaned = line
      .replace(new RegExp(BATCH_SOURCE, 'gi'), ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
    if (cleaned) kept.push(cleaned)
  }

  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n'), removed }
}

function splitOntoOwnLines(text: string): {
  text: string
  gluedMoved: number
  spacesAdded: number
} {
  let gluedMoved = 0
  let spacesAdded = 0
  let out = ''
  let last = 0
  const re = new RegExp(PROMPT_SOURCE, 'gi')

  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0
    const atLineStart = index === 0 || text[index - 1] === '\n'
    const hadSpace = /^\d+\.\s+\[/.test(match[0])
    const normalized = `${match[1]}. ${match[2]}`
    if (!hadSpace) spacesAdded += 1

    const before = text.slice(last, index)
    if (atLineStart) {
      out += before + normalized
    } else {
      out += before.replace(/[ \t]+$/, '') + '\n\n' + normalized
      gluedMoved += 1
    }
    last = index + match[0].length
  }

  out += text.slice(last)
  return { text: out, gluedMoved, spacesAdded }
}

function isWrappedContinuation(line: string, previous: string | undefined): boolean {
  if (!previous || !ANY_NUMBERED.test(previous)) return false
  const trimmed = line.trim()
  if (!trimmed) return false
  return /^[a-zà-öø-ÿ]/.test(trimmed) || /^[,;:]/.test(trimmed)
}

const EXISTING_NUMBER = /^\s*(\d{1,4})\./

function numberRemainingLines(text: string): { text: string; numbersAdded: number } {
  const used = new Set<number>()
  const rows = text.split('\n')

  for (const line of rows) {
    const match = line.match(EXISTING_NUMBER)
    if (match) used.add(Number(match[1]))
  }

  let last = 0
  let numbersAdded = 0
  const lines: string[] = []
  for (const line of rows) {
    const match = line.match(EXISTING_NUMBER)
    if (match) {
      last = Number(match[1])
      lines.push(line)
      continue
    }
    if (!line.trim() || isWrappedContinuation(line, lines.at(-1))) {
      lines.push(line)
      continue
    }

    let next = last + 1
    while (used.has(next)) next += 1
    used.add(next)
    last = next
    numbersAdded += 1
    lines.push(`${next}. ${line.trim()}`)
  }

  return { text: lines.join('\n'), numbersAdded }
}

function addNumbersIfMissing(text: string): { text: string; numbersAdded: number } {
  const already =
    new RegExp(PROMPT_SOURCE, 'i').test(text) ||
    text.split('\n').some((line) => /^\s*\d{1,4}\./.test(line))
  if (already) return numberRemainingLines(text)

  const lines = text.split('\n')
  const tagStart = new RegExp(`^\\s*\\[(?:${TAG})\\]`, 'i')
  const blocks: string[] = []
  let current: string[] = []
  const flush = () => {
    const block = current.join('\n').trim()
    if (block) blocks.push(block)
    current = []
  }

  for (const line of lines) {
    if (line.trim() === '') flush()
    else if (current.length && tagStart.test(line)) {
      flush()
      current.push(line)
    } else current.push(line)
  }
  flush()

  if (!blocks.length) return { text, numbersAdded: 0 }

  return {
    text: blocks.map((block, index) => `${index + 1}. ${block}`).join('\n\n'),
    numbersAdded: blocks.length,
  }
}

function separatePromptLines(text: string): { text: string; blanksAdded: number } {
  const lines = text.split('\n')
  const out: string[] = []
  let blanksAdded = 0
  let seenPrompt = false

  for (const line of lines) {
    if (ANY_NUMBERED.test(line) && seenPrompt && out.at(-1) !== '') {
      out.push('')
      blanksAdded += 1
    }
    if (ANY_NUMBERED.test(line)) seenPrompt = true
    out.push(line)
  }

  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), blanksAdded }
}

function collectNumbers(text: string): number[] {
  const numbers: number[] = []
  for (const line of text.split('\n')) {
    const match = line.match(EXISTING_NUMBER)
    if (match) numbers.push(Number(match[1]))
  }
  return numbers
}

function numberingRestarted(numbers: number[]): boolean {
  return numbers.some((number, index) => index > 0 && number <= numbers[index - 1])
}

function renumberFromOne(text: string): string {
  let next = 0
  return text
    .split('\n')
    .map((line) => {
      if (!EXISTING_NUMBER.test(line)) return line
      next += 1
      return line.replace(EXISTING_NUMBER, `${next}.`)
    })
    .join('\n')
}

const VISUAL_HEADING = /^[*_]*\s*VISUAL\s+(\d{1,4})\b\s*[*_]*\s*(.*)$/i
const NANO_LABEL = /^(?:NANO[\s-]*BANANA|NANOBANANA)\s+PROMPT\s*:?\s*(.*)$/i

function isRuleLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.length >= 3 && /^[━─—\-_=*]+$/.test(trimmed)
}

function extractVisualPrompts(raw: string): FormatReport | null {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (!lines.some((line) => NANO_LABEL.test(line.trim()))) return null

  const prompts: { number: number; text: string }[] = []
  let visualNumber: number | null = null
  let collecting = false
  let body: string[] = []

  const finish = () => {
    const text = body.join('\n').trim()
    if (visualNumber !== null && text) prompts.push({ number: visualNumber, text })
    body = []
    collecting = false
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const visual = trimmed.match(VISUAL_HEADING)
    if (visual) {
      finish()
      visualNumber = Number(visual[1])
      const rest = visual[2].trim()
      if (rest) {
        collecting = true
        body.push(rest)
      }
      continue
    }
    if (isRuleLine(trimmed)) {
      if (collecting) finish()
      continue
    }
    const label = trimmed.match(NANO_LABEL)
    if (label) {
      if (collecting) finish()
      collecting = true
      if (label[1].trim()) body.push(label[1].trim())
      if (visualNumber === null) visualNumber = prompts.length + 1
      continue
    }
    if (collecting) body.push(line)
  }
  finish()

  const numbers = prompts.map((prompt) => prompt.number)
  const unique = [...new Set(numbers)]
  const low = numbers.length ? Math.min(...numbers) : null
  const high = numbers.length ? Math.max(...numbers) : null
  const missing =
    low === null || high === null
      ? []
      : Array.from({ length: high - low + 1 }, (_, i) => low + i).filter(
          (n) => !unique.includes(n),
        )
  const duplicates = unique.filter((n) => numbers.filter((x) => x === n).length > 1)
  const text = prompts.length
    ? `${prompts.map((prompt) => `${prompt.number}. ${prompt.text}`).join('\n\n')}\n`
    : ''

  return {
    text,
    count: numbers.length,
    range: low === null || high === null ? null : [low, high],
    missing,
    duplicates,
    gluedMoved: 0,
    blanksAdded: 0,
    batchesRemoved: 0,
    spacesAdded: 0,
    numbersAdded: numbers.length,
  }
}

function reportNumbered(
  prompts: { number: number; text: string }[],
  batchesRemoved = 0,
): FormatReport {
  const numbers = prompts.map((prompt) => prompt.number)
  const unique = [...new Set(numbers)]
  const low = numbers.length ? Math.min(...numbers) : null
  const high = numbers.length ? Math.max(...numbers) : null
  const missing =
    low === null || high === null
      ? []
      : Array.from({ length: high - low + 1 }, (_, i) => low + i).filter(
          (n) => !unique.includes(n),
        )
  const duplicates = unique.filter((n) => numbers.filter((x) => x === n).length > 1)
  const text = prompts.length
    ? `${prompts.map((prompt) => `${prompt.number}. ${prompt.text}`).join('\n\n')}\n`
    : ''

  return {
    text,
    count: numbers.length,
    range: low === null || high === null ? null : [low, high],
    missing,
    duplicates,
    gluedMoved: 0,
    blanksAdded: 0,
    batchesRemoved,
    spacesAdded: 0,
    numbersAdded: numbers.length,
  }
}

function extractSegMarkedPrompts(raw: string): FormatReport | null {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (!lines.some((line) => matchBracketSeg(line))) return null

  const prompts: { number: number; text: string }[] = []
  let current: { number: number; parts: string[] } | null = null
  let batchesRemoved = 0

  const finish = () => {
    if (!current) return
    const text = current.parts.join('\n').trim()
    if (text) prompts.push({ number: current.number, text })
    current = null
  }

  for (const line of lines) {
    if (isDividerLine(line)) {
      batchesRemoved += 1
      continue
    }
    const marker = matchBracketSeg(line)
    if (marker) {
      finish()
      current = { number: marker.number, parts: [] }
      if (marker.rest) current.parts.push(marker.rest)
      continue
    }
    if (!line.trim()) {
      finish()
      continue
    }
    if (current) current.parts.push(line)
  }
  finish()

  return reportNumbered(prompts, batchesRemoved)
}

function extractInlineVisualPrompts(raw: string): FormatReport | null {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/)
  const inline = lines.some((line) => {
    const match = line.trim().match(VISUAL_HEADING)
    return !!match?.[2].trim()
  })
  if (!inline) return null

  const prompts: { number: number; text: string }[] = []
  let current: { number: number; parts: string[] } | null = null

  const finish = () => {
    if (!current) return
    const text = current.parts.join('\n').trim()
    if (text) prompts.push({ number: current.number, text })
    current = null
  }

  for (const line of lines) {
    if (isDividerLine(line)) continue
    const match = line.trim().match(VISUAL_HEADING)
    if (match) {
      finish()
      current = { number: Number(match[1]), parts: [] }
      if (match[2].trim()) current.parts.push(match[2].trim())
      continue
    }
    if (!line.trim()) {
      finish()
      continue
    }
    if (current) current.parts.push(line)
  }
  finish()

  return reportNumbered(prompts)
}

function hasHookPrompt(raw: string): boolean {
  if (new RegExp(PROMPT_SOURCE, 'i').test(raw)) return true
  return raw.split(/\r?\n/).some((line) => new RegExp(`^\\s*\\[(?:${TAG})\\]`, 'i').test(line))
}

export function formatPrompts(raw: string): FormatReport {
  const segMarked = extractSegMarkedPrompts(raw)
  if (segMarked) return segMarked

  if (!hasHookPrompt(raw)) {
    const visuals = extractVisualPrompts(raw)
    if (visuals) return visuals
    const inlineVisuals = extractInlineVisualPrompts(raw)
    if (inlineVisuals) return inlineVisuals
  }

  const stripped = stripBatches(raw)
  const numbered = addNumbersIfMissing(normalizeNumbering(stripped.text))
  const split = splitOntoOwnLines(numbered.text)
  const sequential = numberingRestarted(collectNumbers(split.text))
    ? renumberFromOne(split.text)
    : split.text
  const separated = separatePromptLines(sequential)
  const text = separated.text.trim() ? `${separated.text.replace(/\s+$/, '')}\n` : ''
  const numbers = collectNumbers(text)
  const unique = [...new Set(numbers)]
  const low = numbers.length ? Math.min(...numbers) : null
  const high = numbers.length ? Math.max(...numbers) : null
  const missing =
    low === null || high === null
      ? []
      : Array.from({ length: high - low + 1 }, (_, i) => low + i).filter(
          (n) => !unique.includes(n),
        )
  const duplicates = unique.filter((n) => numbers.filter((x) => x === n).length > 1)

  return {
    text,
    count: numbers.length,
    range: low === null || high === null ? null : [low, high],
    missing,
    duplicates,
    gluedMoved: split.gluedMoved,
    blanksAdded: separated.blanksAdded,
    batchesRemoved: stripped.removed,
    spacesAdded: split.spacesAdded,
    numbersAdded: numbered.numbersAdded,
  }
}

export function formatMissing(missing: number[]): string {
  if (!missing.length) return 'none'
  const ranges: string[] = []
  let start = missing[0]
  let prev = missing[0]
  for (const n of missing.slice(1)) {
    if (n === prev + 1) {
      prev = n
      continue
    }
    ranges.push(start === prev ? String(start) : `${start}–${prev}`)
    start = n
    prev = n
  }
  ranges.push(start === prev ? String(start) : `${start}–${prev}`)
  return ranges.join(', ')
}

export function downloadName(name: string, extension: 'txt' | 'pdf' = 'txt'): string {
  const trimmed = name.trim() || 'prompts'
  if (extension === 'txt' && trimmed.toLowerCase().endsWith('.txt')) return trimmed
  const stem = trimmed.replace(/\.(txt|pdf)$/i, '') || 'prompts'
  return `${stem}.${extension}`
}
