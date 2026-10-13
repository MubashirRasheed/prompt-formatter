import { describe, expect, it } from 'vitest'
import { stripCustomPhrases } from './strip-custom'

describe('stripCustomPhrases', () => {
  it('removes each entered line, ignoring case', () => {
    const text = stripCustomPhrases(
      'HELLO LABEL keep this painting\nvisual 001 asbdbasd',
      'hello label\nVISUAL 001',
    )

    expect(text).toBe('keep this painting\nasbdbasd')
  })

  it('treats one SEG marker as the pattern for every number and quote', () => {
    const text = stripCustomPhrases(
      `1. *[SEG 001 — "¿Por qué querría un alma entrar al purgatorio,"]* A grand Renaissance fresco.

2. *[SEG 002 — "en lugar de huir de él?"]* A chiaroscuro oil painting.

3. **[SEG 003 — "Esa fue la pregunta"]** A Byzantine icon.`,
      '*[SEG 001 — "¿Por qué querría un alma entrar al purgatorio,"]*',
    )

    expect(text).toBe(`1. A grand Renaissance fresco.

2. A chiaroscuro oil painting.

3. A Byzantine icon.`)
    expect(text).not.toMatch(/SEG|purgatorio|huir|pregunta|\*/)
  })

  it('treats a CONCEPT line as removing that label to the end of every line', () => {
    const text = stripCustomPhrases(
      `001 “Santa Gertrudis la Grande escribió que Jesús le dijo exactamente” — CONCEPT: Jesus speaking a command so specific it stops her breath. ANCHOR: Jesus’s lips. → S1 | EXTREME CLOSE EYES | Warm | M1

002 “qué hacer apenas abriera los ojos cada mañana.” — CONCEPT: the instruction is about waking. ANCHOR: eyes. → S2A | EXTREME CLOSE HANDS`,
      '— CONCEPT: Jesus speaking a command so specific it stops her breath. ANCHOR: Jesus’s lips forming the words. → S1 | EXTREME CLOSE EYES | Warm | M1',
    )

    expect(text).toBe(`001 “Santa Gertrudis la Grande escribió que Jesús le dijo exactamente”

002 “qué hacer apenas abriera los ojos cada mañana.”`)
  })

  it('lets numbers in an entry match any number', () => {
    const text = stripCustomPhrases(
      `BATCH 6: Visuals 126–150
126. A painting.
BATCH 7: Visuals 126–1520
128. Another painting.`,
      'BATCH 6: Visuals 126–150',
    )

    expect(text).toBe(`
126. A painting.

128. Another painting.`)
  })

  it('leaves the text alone when the box is empty', () => {
    expect(stripCustomPhrases('VISUAL 001 asbdbasd', '  \n')).toBe('VISUAL 001 asbdbasd')
  })
})
