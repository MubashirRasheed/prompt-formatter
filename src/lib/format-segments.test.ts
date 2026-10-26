import { describe, expect, it } from 'vitest'
import { formatSegments } from './format-segments'

describe('formatSegments', () => {
  it('keeps only the spoken line from a full segment block', () => {
    const report = formatSegments(`SEG 001 | “Sor Josefa Menéndez vio, en tres momentos distintos,”
CONCEPT: Awe held in check: a witness who cannot unsee what she saw kneels in glory and her eyes search the viewer.
ANCHOR: Josefa kneeling, Jesus beside her, three arched doors of light.
CONTINUITY: Opening frame; sets Josefa, Jesus and the door-of-light motif.
ADDRESS: N (hook: her eyes look out at the viewer)
→ Style 1 | Camera MEDIUM-WIDE FULL FIGURE | Temp Warm | Motion M1 | Contrast: opening frame
SEG 002 | “el instante exacto en que un alma se perdía para siempre.”
CONCEPT: The silence of a choice setting like stone.
ANCHOR: Alma del Orgullo at a dark threshold, small warm light behind her.
CONTINUITY: Door-of-light motif from 001, now small and far.
ADDRESS: N
→ Style 5 | Camera WIDE FULL SCENE | Temp Cool | Motion M6 | Contrast: Temperature, Tonal weight
SEG 003 | “No eran criminales. No eran monstruos.”
CONCEPT: Relief and unease together: these faces are kind and familiar.
ADDRESS: N
→ Style 4 | Camera MEDIUM WAIST-UP | Temp Warm | Motion M7 | Contrast: Temperature, Tonal weight`)

    expect(report.text).toBe(`SEG 01: Sor Josefa Menéndez vio, en tres momentos distintos,
SEG 02: el instante exacto en que un alma se perdía para siempre.
SEG 03: No eran criminales. No eran monstruos.
`)
    expect(report.count).toBe(3)
    expect(report.range).toEqual([1, 3])
    expect(report.missing).toEqual([])
    expect(report.text).not.toMatch(/CONCEPT:|ANCHOR:|CONTINUITY:|ADDRESS:|Style /)
  })

  it('leaves a short segment line in the same shape', () => {
    const report = formatSegments(`SEG 01: She knelt at Communion one morning
SEG 02: and felt herself descending`)

    expect(report.text).toBe(`SEG 01: She knelt at Communion one morning
SEG 02: and felt herself descending
`)
  })

  it('reads a line that starts with only a number and a quote', () => {
    const report = formatSegments(`001 “Santa Gertrudis la Grande escribió que Jesús le dijo exactamente” — CONCEPT: Jesus speaking a command so specific it stops her breath. ANCHOR: Jesus’s lips forming the words, Gertrudis receiving them. Cont.: — (opening). Addr: N. → S1 | EXTREME CLOSE EYES | Warm | M1 | Contrast: n/a (opening)

002 “qué hacer apenas abriera los ojos cada mañana.” — CONCEPT: the instruction is about the very first instant of waking. ANCHOR: eyes just beginning to open. Cont.: Gertrudis’s hands from 001. Addr: N. → S2A | EXTREME CLOSE HANDS | Warm | M3 | Contrast: scale, activity

003 “No le pidió una oración larga,” — CONCEPT: relief that nothing elaborate was demanded. ANCHOR: her face, unburdened. Cont.: same soft dawn light. Addr: N. → S2D (`)

    expect(report.text).toBe(`SEG 01: Santa Gertrudis la Grande escribió que Jesús le dijo exactamente
SEG 02: qué hacer apenas abriera los ojos cada mañana.
SEG 03: No le pidió una oración larga,
`)
    expect(report.missing).toEqual([])
  })

  it('reads other numbered shapes without a SEG prefix', () => {
    const report = formatSegments(`1. “primera frase” — CONCEPT: drop
(2) "segunda frase" | S2A | Warm
#3 tercera frase → S1 | EXTREME CLOSE
Line 4: cuarta frase ANCHOR: drop this
Scene 5 — «quinta frase»`)

    expect(report.text).toBe(`SEG 01: primera frase
SEG 02: segunda frase
SEG 03: tercera frase
SEG 04: cuarta frase
SEG 05: quinta frase
`)
    expect(report.text).not.toMatch(/CONCEPT|ANCHOR|S2A|EXTREME/)
  })

  it('takes the spoken line from the line under a bare number', () => {
    const report = formatSegments(`SEG 007
“la frase debajo”
CONCEPT: drop this

008
CONCEPT: label first
“otra frase”`)

    expect(report.text).toBe(`SEG 07: la frase debajo
SEG 08: otra frase
`)
  })

  it('turns an unnumbered narration into one segment per paragraph', () => {
    const report = formatSegments(`Un muchacho del Oratorio de Turín caminaba hacia una decisión
que podía hundir su alma, y no lo sabía.

Esa misma noche, San Juan Bosco lo vio en sueños:
vio al Ángel de la Guarda del joven interponerse
justo antes de que cayera, deteniendo lo que parecía ya decidido.

Esto no es una metáfora piadosa.`)

    expect(report.text).toBe(`SEG 01: Un muchacho del Oratorio de Turín caminaba hacia una decisión que podía hundir su alma, y no lo sabía.
SEG 02: Esa misma noche, San Juan Bosco lo vio en sueños: vio al Ángel de la Guarda del joven interponerse justo antes de que cayera, deteniendo lo que parecía ya decidido.
SEG 03: Esto no es una metáfora piadosa.
`)
    expect(report.range).toEqual([1, 3])
    expect(report.missing).toEqual([])
  })

  it('splits wrapped narration into sentences when there is no blank line', () => {
    const report = formatSegments(`Un muchacho del Oratorio de Turín caminaba hacia una decisión
que podía hundir su alma, y no lo sabía.
Esa misma noche, San Juan Bosco lo vio en sueños:
vio al Ángel de la Guarda del joven interponerse
justo antes de que cayera, deteniendo lo que parecía ya decidido.
Esto no es una metáfora piadosa. Quedó registrado en las Memorias.`)

    expect(report.text).toBe(`SEG 01: Un muchacho del Oratorio de Turín caminaba hacia una decisión que podía hundir su alma, y no lo sabía.
SEG 02: Esa misma noche, San Juan Bosco lo vio en sueños: vio al Ángel de la Guarda del joven interponerse justo antes de que cayera, deteniendo lo que parecía ya decidido.
SEG 03: Esto no es una metáfora piadosa.
SEG 04: Quedó registrado en las Memorias.
`)
    expect(report.count).toBe(4)
  })

  it('numbers quote-only lines in order when nothing is numbered', () => {
    const report = formatSegments(`“primera” — CONCEPT: drop
CONCEPT: nothing here
“segunda” → S1 | Warm`)

    expect(report.text).toBe(`SEG 01: primera
SEG 02: segunda
`)
  })

  it('reads the spoken line from bold, dashed, and wrapped headings', () => {
    const report = formatSegments(`1. **[SEG 001 — "en lugar de huir de él?"]** A painting that should not be kept.

SEG 002 — “segunda frase”
__SEG 003 | "tercera"__
CONCEPT: drop this`)

    expect(report.text).toBe(`SEG 01: en lugar de huir de él?
SEG 02: segunda frase
SEG 03: tercera
`)
    expect(report.text).not.toMatch(/painting|CONCEPT|\[/)
  })
})
