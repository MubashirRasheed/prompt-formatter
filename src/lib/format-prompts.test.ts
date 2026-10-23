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

  it('continues numbering when some prompts already have numbers', () => {
    const report = formatPrompts(`13. A watercolor bedroom.
14. A Renaissance oil portrait.
15. A Renaissance oil interior.
A gothic atmospheric watercolor.
A stunning Byzantine-Renaissance icon.`)

    expect(report.text).toBe(`13. A watercolor bedroom.

14. A Renaissance oil portrait.

15. A Renaissance oil interior.

16. A gothic atmospheric watercolor.

17. A stunning Byzantine-Renaissance icon.
`)
    expect(report.numbersAdded).toBe(2)
    expect(report.missing).toEqual([])
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

  it('puts one blank line between plain numbered prompts', () => {
    const report = formatPrompts(`1. A stunning Byzantine-Renaissance icon colorful painting.
2. A highly detailed Renaissance oil colorful painting.
3. A highly detailed Renaissance oil colorful painting.`)

    expect(report.text).toBe(`1. A stunning Byzantine-Renaissance icon colorful painting.

2. A highly detailed Renaissance oil colorful painting.

3. A highly detailed Renaissance oil colorful painting.
`)
    expect(blankLinesBetweenPrompts(report.text)).toEqual([1, 1])
    expect(report.blanksAdded).toBe(2)
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

  it('removes a batch header wrapped in underscores', () => {
    const report = formatPrompts(`1. [HOOK] first
___Batch 2 of 4 (segments 1-10)___
2. [BUILD] second`)

    expect(report.batchesRemoved).toBe(1)
    expect(report.text).toBe(`1. [HOOK] first

2. [BUILD] second
`)
  })

  it('drops BATCH N: Visuals headers and batch done summary lines', () => {
    const report = formatPrompts(`125. A watercolor bedroom.
Batch done: visuals 101–125 of 152. Running style count: S1 27 | S2 37 | S3 16 | S4 14 | S5 16 | S6 7.

BATCH 6: Visuals 126–150
126. A Renaissance oil portrait.
127. A Renaissance oil interior.
BATCH 7: Visuals 126–1520
128. A Renaissance oil low angle.`)

    expect(report.text).toBe(`125. A watercolor bedroom.

126. A Renaissance oil portrait.

127. A Renaissance oil interior.

128. A Renaissance oil low angle.
`)
    expect(report.batchesRemoved).toBe(3)
    expect(report.missing).toEqual([])
  })

  it('does not prefix 1. onto a line that already starts with 001', () => {
    const report = formatPrompts(`001 “Santa Gertrudis la Grande escribió que Jesús le dijo exactamente”
002 “qué hacer apenas abriera los ojos cada mañana.”
003 “No le pidió una oración larga,”`)

    expect(report.text).toBe(`1. “Santa Gertrudis la Grande escribió que Jesús le dijo exactamente”

2. “qué hacer apenas abriera los ojos cada mañana.”

3. “No le pidió una oración larga,”
`)
    expect(report.text).not.toMatch(/1\. 001|2\. 002/)
    expect(report.numbersAdded).toBe(0)
  })

  it('turns other numbering styles into N. and keeps one blank line', () => {
    const report = formatPrompts(`1) A fresco ceiling.
(2) A chiaroscuro oil.
#3 - A Byzantine icon.
Prompt 4: A watercolor bedroom.
**5.** A gothic hall.
6: A Genoa harbor.`)

    expect(report.text).toBe(`1. A fresco ceiling.

2. A chiaroscuro oil.

3. A Byzantine icon.

4. A watercolor bedroom.

5. A gothic hall.

6. A Genoa harbor.
`)
    expect(report.missing).toEqual([])
  })

  it('drops other short header lines between prompts', () => {
    const report = formatPrompts(`## Visuals 1–30
1. A fresco ceiling.
Set 2
2. A chiaroscuro oil.
Prompts 31-60 of 152
3. A Byzantine icon.
Chunk 4 complete
4. A watercolor bedroom.`)

    expect(report.text).toBe(`1. A fresco ceiling.

2. A chiaroscuro oil.

3. A Byzantine icon.

4. A watercolor bedroom.
`)
    expect(report.batchesRemoved).toBe(4)
  })

  it('keeps a short prompt that only mentions a number range', () => {
    const report = formatPrompts(`1. Two kids aged 8–10 by a river.
2. A crowd of 20 to 30 monks.`)

    expect(report.text).toContain('8–10 by a river')
    expect(report.text).toContain('20 to 30 monks')
    expect(report.batchesRemoved).toBe(0)
  })

  it('drops a nano banana label and a part header between hook prompts', () => {
    const report = formatPrompts(`1. [HOOK] first

**NANO BANANA**
Part 2 of 4 complete.

2. [BUILD] second`)

    expect(report.text).toBe(`1. [HOOK] first

2. [BUILD] second
`)
    expect(report.batchesRemoved).toBe(2)
    expect(report.text).not.toMatch(/NANO|Part /)
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

describe('visual nanobanana blocks', () => {
  it('keeps only the prompt and numbers it from the visual heading', () => {
    const report = formatPrompts(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL 001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Script: "Sor Josefa Menéndez vio, en tres momentos distintos,"
Concept: The weight of a witness.
Style: 1 — Byzantine-Renaissance Icon
Camera: MEDIUM-WIDE FULL FIGURE
Reference images to attach: Sor Josefa Menéndez, Jesucristo

NANOBANANA PROMPT:
A stunning Byzantine-Renaissance icon colorful painting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL 002
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Script: "el instante exacto."
Concept: The silence of a choice.

NANOBANANA PROMPT:
A highly detailed dramatic chiaroscuro oil colorful painting.
`)

    expect(report.text).toBe(`1. A stunning Byzantine-Renaissance icon colorful painting.

2. A highly detailed dramatic chiaroscuro oil colorful painting.
`)
    expect(report.count).toBe(2)
    expect(report.range).toEqual([1, 2])
    expect(report.missing).toEqual([])
    expect(report.text).not.toMatch(/Script:|Concept:|Camera:|VISUAL|NANOBANANA/)
  })

  it('drops the visual label when the prompt is on the same line', () => {
    const report = formatPrompts(`NANO BANANA PROMPT:
VISUAL 001 asbdbasd
`)

    expect(report.text).toBe(`1. asbdbasd
`)
    expect(report.text).not.toMatch(/VISUAL|NANO/)
  })

  it('numbers a visual prompt that has no nano label', () => {
    const report = formatPrompts('VISUAL 001 asbdbasd')

    expect(report.text).toBe(`1. asbdbasd
`)
    expect(report.text).not.toMatch(/VISUAL/)
  })

  it('accepts a spaced nano banana label', () => {
    const report = formatPrompts(`VISUAL 004

NANO BANANA PROMPT:
A painted doorway.
`)

    expect(report.text).toBe(`4. A painted doorway.
`)
  })
})

describe('seg-marked image prompts', () => {
  it('drops the leading SEG quote marker and numbers from the SEG index', () => {
    const report = formatPrompts(
      `*[SEG 001 — "¿Por qué querría un alma entrar al purgatorio,"]* A grand Renaissance fresco ceiling colorful painting, variant ARRIVAL.

**[SEG 003 — "She knelt at Communion."]** A second painted prompt.`,
    )

    expect(report.text).toBe(`1. A grand Renaissance fresco ceiling colorful painting, variant ARRIVAL.

3. A second painted prompt.
`)
    expect(report.text).not.toMatch(/SEG 00|purgatorio|She knelt/)
    expect(report.count).toBe(2)
    expect(report.range).toEqual([1, 3])
    expect(report.missing).toEqual([2])
  })

  it('strips a bold SEG marker that already sits after a list number', () => {
    const report = formatPrompts(
      `1. **[SEG 001 — "¿Por qué querría un alma entrar al purgatorio,"]** A grand Renaissance fresco ceiling colorful painting, variant ARRIVAL.

2. **[SEG 002 — "en lugar de huir de él?"]** A highly detailed dramatic chiaroscuro oil colorful painting.`,
    )

    expect(report.text).toBe(`1. A grand Renaissance fresco ceiling colorful painting, variant ARRIVAL.

2. A highly detailed dramatic chiaroscuro oil colorful painting.
`)
    expect(report.text).not.toMatch(/\*|SEG |purgatorio|huir/)
    expect(report.missing).toEqual([])
  })

  it('strips the same SEG marker with the other wraps that already showed up', () => {
    const report = formatPrompts(
      `1) **[SEG 004 — "cuarta"]** A fourth painted prompt.

(5) *[SEG 005 | "quinta"]* A fifth painted prompt.

__[SEG 006: "sexta"]__ A sixth painted prompt.

[SEGMENT 007 — "séptima"] A seventh painted prompt.

***[SEG 008 — "octava"]*** An eighth painted prompt.`,
    )

    expect(report.text).toBe(`4. A fourth painted prompt.

5. A fifth painted prompt.

6. A sixth painted prompt.

7. A seventh painted prompt.

8. An eighth painted prompt.
`)
    expect(report.text).not.toMatch(/\[|SEG |\*|cuarta|quinta|sexta|séptima|octava/)
    expect(report.missing).toEqual([])
  })

  it('drops batch, nano banana, and visual labels sitting between prompts', () => {
    const report = formatPrompts(`1. **[SEG 001 — "primera"]** A grand Renaissance fresco.

**Batch 2 of 9**
NANO BANANA PROMPT:
VISUAL 009
━━━━━━━━━━━━━━━━

2. **[SEG 002 — "segunda"]** A chiaroscuro oil painting.`)

    expect(report.text).toBe(`1. A grand Renaissance fresco.

2. A chiaroscuro oil painting.
`)
    expect(report.text).not.toMatch(/Batch|NANO|VISUAL|━|primera|segunda/)
    expect(report.batchesRemoved).toBe(4)
  })
})

describe('downloadName', () => {
  it('adds .txt when the name has no extension', () => {
    expect(downloadName('atlas')).toBe('atlas.txt')
    expect(downloadName('atlas.TXT')).toBe('atlas.TXT')
    expect(downloadName('  ')).toBe('prompts.txt')
    expect(downloadName('prompts.txt', 'pdf')).toBe('prompts.pdf')
    expect(downloadName('segments', 'pdf')).toBe('segments.pdf')
  })
})
