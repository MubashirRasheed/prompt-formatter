import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatWithLlm, llmCacheKey, rememberLlm } from './llm-client'

describe('llm client cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a remembered result without calling the server', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    rememberLlm('prompts', '001 “hola”', {
      text: '1. hola\n',
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      cachedTokens: 12,
      promptTokens: 40,
    })

    const result = await formatWithLlm('prompts', '001 “hola”')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.fromClientCache).toBe(true)
    expect(result.text).toBe('1. hola\n')
    expect(llmCacheKey('prompts', '001 “hola”')).toBe('prompts\n001 “hola”')
  })
})
