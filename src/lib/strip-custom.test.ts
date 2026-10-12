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

  it('leaves the text alone when the box is empty', () => {
    expect(stripCustomPhrases('VISUAL 001 asbdbasd', '  \n')).toBe('VISUAL 001 asbdbasd')
  })
})
