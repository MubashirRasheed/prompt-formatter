export type LlmMode = 'prompts' | 'segments' | 'script'

export type LlmStatus = {
  configured: boolean
  provider: 'groq' | 'ollama'
  model: string
}

export type LlmResult = {
  text: string
  provider: 'groq' | 'ollama'
  model: string
  cachedTokens: number
  promptTokens: number
  fromClientCache: boolean
}

const memory = new Map<string, Omit<LlmResult, 'fromClientCache'>>()

export function llmCacheKey(mode: LlmMode, source: string): string {
  return `${mode}\n${source}`
}

export function rememberLlm(mode: LlmMode, source: string, result: Omit<LlmResult, 'fromClientCache'>) {
  memory.set(llmCacheKey(mode, source), result)
}

export function peekLlmCache(mode: LlmMode, source: string): LlmResult | null {
  const hit = memory.get(llmCacheKey(mode, source))
  return hit ? { ...hit, fromClientCache: true } : null
}

export async function fetchLlmStatus(): Promise<LlmStatus> {
  const response = await fetch('/api/llm')
  if (!response.ok) throw new Error('LLM status failed')
  return (await response.json()) as LlmStatus
}

export async function formatWithLlm(mode: LlmMode, source: string): Promise<LlmResult> {
  const cached = peekLlmCache(mode, source)
  if (cached) return cached

  const response = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, source }),
  })
  const payload = (await response.json()) as Partial<LlmResult> & { error?: string }
  if (!response.ok) throw new Error(payload.error || `LLM HTTP ${response.status}`)
  if (!payload.text) throw new Error('LLM returned an empty result')

  const result: Omit<LlmResult, 'fromClientCache'> = {
    text: payload.text,
    provider: payload.provider === 'ollama' ? 'ollama' : 'groq',
    model: payload.model || '',
    cachedTokens: payload.cachedTokens ?? 0,
    promptTokens: payload.promptTokens ?? 0,
  }
  rememberLlm(mode, source, result)
  return { ...result, fromClientCache: false }
}
