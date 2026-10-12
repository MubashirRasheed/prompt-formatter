import { describe, expect, it } from 'vitest'
import { formatScript } from './format-script'

describe('formatScript', () => {
  it('removes square-bracket tags and keeps the spoken paragraphs', () => {
    const report = formatScript(`Santa Faustina escribió que las almas tibias le causan a Jesús un dolor más agudo. [HOOK] Lo anotó en su Diario. [CORE REVEAL] Una alma tibia no es alguien que odia a Dios.

[LOOP 1 CLOSE] Lo que cambia es esto: casi todos asumen que la tibieza es un punto intermedio seguro. [CONTRAST: tibieza como punto medio seguro vs. lo que Jesús reveló sobre su dolor] Pero lo que Santa Faustina registró es distinto. [SCRIPTURE: Apocalipsis 3:15-16] Esto no es una idea nueva.`)

    expect(report.text).toBe(`Santa Faustina escribió que las almas tibias le causan a Jesús un dolor más agudo. Lo anotó en su Diario. Una alma tibia no es alguien que odia a Dios.

Lo que cambia es esto: casi todos asumen que la tibieza es un punto intermedio seguro. Pero lo que Santa Faustina registró es distinto. Esto no es una idea nueva.
`)
    expect(report.tagsRemoved).toBe(5)
    expect(report.text).not.toMatch(/\[|\]/)
  })

  it('drops a line that is only a bracket tag', () => {
    const report = formatScript(`Primera frase. [RETENTION BRIDGE]

[LOOP 1 CLOSE] Segunda frase. [asd]`)

    expect(report.text).toBe(`Primera frase.

Segunda frase.
`)
    expect(report.tagsRemoved).toBe(3)
  })

  it('drops bold wrappers and keeps the spoken line inside a SEG marker', () => {
    const report = formatScript(
      '**[HOOK]** Primera. **[SEG 001 — "La frase dicha,"]** sigue. [CORE REVEAL]',
    )

    expect(report.text).toBe('Primera. La frase dicha, sigue.\n')
    expect(report.tagsRemoved).toBe(3)
    expect(report.text).not.toMatch(/\[|\]|\*/)
  })
})
