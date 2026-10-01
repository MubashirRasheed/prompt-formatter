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
const LINE_PROMPT = new RegExp(`^(\\d{1,4})\\.\\s+\\[(?:${TAG})\\]`, 'i')
const ANY_NUMBERED = /^(\d{1,4})\.\s/
const BATCH_SOURCE = '\\*{0,2}\\s*Batch\\s+\\d+\\s+of\\s+\\d+(?:\\s*\\([^)\\n]*\\))?\\s*\\*{0,2}'

function stripBatches(raw: string): { text: string; removed: number } {
  let removed = 0
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/)
  const kept: string[] = []

  for (const line of lines) {
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

function addNumbersIfMissing(text: string): { text: string; numbersAdded: number } {
  const already =
    new RegExp(PROMPT_SOURCE, 'i').test(text) ||
    text.split('\n').some((line) => /^\s*\d{1,4}\./.test(line))
  if (already) return { text, numbersAdded: 0 }

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

  for (let i = 0; i < lines.length; i += 1) {
    out.push(lines[i])
    const next = lines[i + 1]
    if (next && LINE_PROMPT.test(lines[i]) && LINE_PROMPT.test(next)) {
      out.push('')
      blanksAdded += 1
    }
  }

  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), blanksAdded }
}

function collectNumbers(text: string): number[] {
  const numbers: number[] = []
  for (const line of text.split('\n')) {
    const match = line.match(ANY_NUMBERED)
    if (match) numbers.push(Number(match[1]))
  }
  return numbers
}

export function formatPrompts(raw: string): FormatReport {
  const stripped = stripBatches(raw)
  const numbered = addNumbersIfMissing(stripped.text)
  const split = splitOntoOwnLines(numbered.text)
  const separated = separatePromptLines(split.text)
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

export function downloadName(name: string): string {
  const trimmed = name.trim() || 'prompts'
  return trimmed.toLowerCase().endsWith('.txt') ? trimmed : `${trimmed}.txt`
}
