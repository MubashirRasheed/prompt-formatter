import { matchBracketSeg } from './seg-marker'

export type ScriptReport = {
  text: string
  tagsRemoved: number
}

const WRAPPED_TAG = /(?:[*_]+[ \t]*)?\[[^\]\n]*\](?:[ \t]*[*_]+)?/g

export function formatScript(raw: string): ScriptReport {
  let tagsRemoved = 0
  const stripped = raw.replace(/^\uFEFF/, '').replace(WRAPPED_TAG, (hit) => {
    tagsRemoved += 1
    const marker = matchBracketSeg(hit.trim())
    if (marker?.quote) return ` ${marker.quote} `
    return ''
  })

  const lines = stripped.split(/\r?\n/).map((line) =>
    line
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim(),
  )

  const kept: string[] = []
  for (const line of lines) {
    if (!line) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('')
      continue
    }
    kept.push(line)
  }
  while (kept[0] === '') kept.shift()
  while (kept.at(-1) === '') kept.pop()

  return {
    text: kept.length ? `${kept.join('\n')}\n` : '',
    tagsRemoved,
  }
}
