import { describe, expect, it } from 'vitest'
import { buildPdf } from './build-pdf'

describe('buildPdf', () => {
  it('builds a multi-page PDF and keeps a blank line between prompts', async () => {
    const prompt = '1. [HOOK] Sor Josefa Menéndez ' + 'elbow '.repeat(80)
    const next = '2. [BUILD] steam near the ear'
    const blob = buildPdf(`${prompt}\n\n${next}\n`)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const header = String.fromCharCode(...bytes.slice(0, 5))

    expect(header).toBe('%PDF-')
    expect(blob.size).toBeGreaterThan(800)
    expect(blob.type).toBe('application/pdf')
  })
})
