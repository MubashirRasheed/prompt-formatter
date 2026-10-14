import { describe, expect, it } from 'vitest'
import {
  buildUserMessage,
  envFrom,
  ollamaOrigin,
  parseLlmRequest,
  statusPayload,
  unwrapModelText,
} from './llm.ts'
import { SYSTEM_PROMPT } from './llm-prompt.ts'

describe('llm helpers', () => {
  it('keeps a long static system prompt so Groq can prefix-cache it', () => {
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(2000)
    expect(SYSTEM_PROMPT).toContain('MODE=prompts')
    expect(SYSTEM_PROMPT).toContain('MODE=segments')
    expect(SYSTEM_PROMPT).toContain('Never print two numbers')
  })

  it('parses a valid body and rejects junk', () => {
    expect(parseLlmRequest({ mode: 'segments', source: '001 “hola”' })).toEqual({
      mode: 'segments',
      source: '001 “hola”',
    })
    expect(() => parseLlmRequest({ mode: 'other', source: 'x' })).toThrow(/mode/)
    expect(() => parseLlmRequest({ mode: 'prompts', source: '   ' })).toThrow(/source/)
  })

  it('puts the variable paste after a stable MODE prefix', () => {
    expect(buildUserMessage('prompts', '001 “hola”')).toBe('MODE=prompts\n\nSOURCE:\n001 “hola”')
  })

  it('strips markdown fences from the model text', () => {
    expect(unwrapModelText('```text\n1. A fresco.\n```')).toBe('1. A fresco.\n')
  })

  it('uses Groq when a key is present and Ollama when asked', () => {
    expect(envFrom({ GROQ_API_KEY: 'gsk_test' }).provider).toBe('groq')
    expect(envFrom({ LLM_PROVIDER: 'ollama', GROQ_API_KEY: 'gsk_test' }).provider).toBe('ollama')
    expect(statusPayload(envFrom({})).configured).toBe(true)
    expect(statusPayload(envFrom({ LLM_PROVIDER: 'groq' })).configured).toBe(false)
  })

  it('only allows a local Ollama host', () => {
    expect(ollamaOrigin('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434')
    expect(() => ollamaOrigin('http://example.com:11434')).toThrow(/localhost/)
  })
})
