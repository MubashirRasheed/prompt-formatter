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
})
