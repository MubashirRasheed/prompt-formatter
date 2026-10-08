import { describe, expect, it } from 'vitest'
import { downloadName, formatMissing, formatPrompts } from './format-prompts'

function blankLinesBetweenPrompts(text: string): number[] {
  const lines = text.replace(/\n$/, '').split('\n')
  const gaps: number[] = []
  let blanks = 0
  let seenPrompt = false

  for (const line of lines) {
    if (/^\d{1,4}\.\s/.test(line)) {
      if (seenPrompt) gaps.push(blanks)
      seenPrompt = true
      blanks = 0
    } else if (line.trim() === '') {
      blanks += 1
    } else {
      blanks = 0
    }
  }

  return gaps
}

describe('formatPrompts spacing', () => {
  it('puts exactly one blank line between unnumbered prompts', () => {
    const report = formatPrompts(`[HOOK] first prompt text

[BUILD] second prompt

third block with no tag`)

    expect(report.text).toBe(`1. [HOOK] first prompt text

2. [BUILD] second prompt

3. third block with no tag
`)
    expect(blankLinesBetweenPrompts(report.text)).toEqual([1, 1])
    expect(report.numbersAdded).toBe(3)
    expect(report.count).toBe(3)
  })

  it('collapses two or more blank lines down to one', () => {
    const report = formatPrompts(`[HOOK] first


[BUILD] second`)

    expect(blankLinesBetweenPrompts(report.text)).toEqual([1])
    expect(report.text).toBe(`1. [HOOK] first

2. [BUILD] second
`)
  })

  it('numbers a bare tag that comes after numbered prompts', () => {
    const report = formatPrompts(`29. [BUILD] first

30. [BUILD] second

[BUILD] third prompt
[INTERRUPT] fourth prompt
[BUILD] fifth prompt`)

    expect(report.text).toBe(`29. [BUILD] first

30. [BUILD] second

31. [BUILD] third prompt

32. [INTERRUPT] fourth prompt

33. [BUILD] fifth prompt
`)
    expect(report.numbersAdded).toBe(3)
    expect(report.missing).toEqual([])
    expect(blankLinesBetweenPrompts(report.text)).toEqual([1, 1, 1, 1])
  })

  it('inserts one blank line when numbered prompts are back to back', () => {
    const report = formatPrompts(`1. [HOOK] first
2. [BUILD] second
3. [RESOLVE] third`)

    expect(blankLinesBetweenPrompts(report.text)).toEqual([1, 1])
    expect(report.numbersAdded).toBe(0)
    expect(report.blanksAdded).toBe(2)
  })

  it('splits a glued number onto the next prompt with one blank line', () => {
    const report = formatPrompts(
      '1. [HOOK] elbow jabs in2. [HOOK] steam near the ear',
    )

    expect(report.text).toBe(`1. [HOOK] elbow jabs in

2. [HOOK] steam near the ear
`)
    expect(blankLinesBetweenPrompts(report.text)).toEqual([1])
    expect(report.gluedMoved).toBe(1)
    expect(report.numbersAdded).toBe(0)
  })
})

describe('formatPrompts numbering and cleanup', () => {
  it('numbers tag lines that have no blank line between them', () => {
    const report = formatPrompts(`[HOOK] one
[BUILD] two
[RESOLVE] three`)

    expect(report.text).toBe(`1. [HOOK] one

2. [BUILD] two

3. [RESOLVE] three
`)
    expect(report.numbersAdded).toBe(3)
  })

  it('keeps an existing number and fixes a missing space after the period', () => {
    const report = formatPrompts('3.[BUILD] rent maths')

    expect(report.text).toBe('3. [BUILD] rent maths\n')
    expect(report.numbersAdded).toBe(0)
    expect(report.spacesAdded).toBe(1)
  })

  it('removes a batch header and still reports a complete range', () => {
    const report = formatPrompts(`1. [HOOK] elbow jabs in2. [HOOK] steam near the ear
**Batch 4 of 11 (segments 91-120)**
3.[BUILD] rent maths
4. [BUILD] phone glance`)

    expect(report.batchesRemoved).toBe(1)
    expect(report.text).not.toMatch(/Batch/)
    expect(report.count).toBe(4)
    expect(report.range).toEqual([1, 4])
    expect(report.missing).toEqual([])
    expect(blankLinesBetweenPrompts(report.text)).toEqual([1, 1, 1])
  })

  it('removes a batch line that ends with complete, and a bold batch line', () => {
    const report = formatPrompts(`1. [HOOK] first
  Batch 4 of 9 complete.


**Batch 5 of 9**
2. [BUILD] second`)

    expect(report.batchesRemoved).toBe(2)
    expect(report.text).toBe(`1. [HOOK] first

2. [BUILD] second
`)
    expect(report.text).not.toMatch(/complete|Batch/i)
  })

  it('lists missing numbers as collapsed ranges', () => {
    const report = formatPrompts(`1. [HOOK] first
315. [BUILD] middle
416. [RESOLVE] last`)

    expect(report.missing[0]).toBe(2)
    expect(report.missing.at(-1)).toBe(415)
    expect(formatMissing(report.missing)).toBe('2–314, 316–415')
  })
})

describe('downloadName', () => {
  it('adds .txt when the name has no extension', () => {
    expect(downloadName('atlas')).toBe('atlas.txt')
    expect(downloadName('atlas.TXT')).toBe('atlas.TXT')
    expect(downloadName('  ')).toBe('prompts.txt')
  })
})
