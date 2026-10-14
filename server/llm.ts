import type { IncomingMessage, ServerResponse } from 'node:http'
import { SYSTEM_PROMPT } from './llm-prompt.ts'

export type LlmMode = 'prompts' | 'segments' | 'script'
export type LlmProvider = 'groq' | 'ollama'

export type LlmEnv = {
  provider: LlmProvider
  groqKey: string
  groqModel: string
  ollamaHost: string
  ollamaModel: string
}

export type LlmOk = {
  text: string
  provider: LlmProvider
  model: string
  cachedTokens: number
  promptTokens: number
}

const MODES = new Set<LlmMode>(['prompts', 'segments', 'script'])
const MAX_SOURCE = 120_000
const MAX_BODY = 1_500_000

export function envFrom(record: Record<string, string | undefined>): LlmEnv {
  const pick = (key: string, fallback = '') => record[key]?.trim() || fallback
  const forced = pick('LLM_PROVIDER').toLowerCase()
  const groqKey = pick('GROQ_API_KEY')
  const provider: LlmProvider =
    forced === 'ollama' ? 'ollama' : forced === 'groq' || groqKey ? 'groq' : 'ollama'
  return {
    provider,
    groqKey,
    groqModel: pick('GROQ_MODEL', 'openai/gpt-oss-20b'),
    ollamaHost: pick('OLLAMA_HOST', 'http://127.0.0.1:11434'),
    ollamaModel: pick('OLLAMA_MODEL', 'llama3.2'),
  }
}

export function parseLlmRequest(raw: unknown): { mode: LlmMode; source: string } {
  if (!raw || typeof raw !== 'object') throw new Error('invalid body')
  const body = raw as { mode?: unknown; source?: unknown }
  if (typeof body.mode !== 'string' || !MODES.has(body.mode as LlmMode)) {
    throw new Error('mode must be prompts, segments, or script')
  }
  if (typeof body.source !== 'string' || !body.source.trim()) throw new Error('source required')
  if (body.source.length > MAX_SOURCE) throw new Error('source too long')
  return { mode: body.mode as LlmMode, source: body.source.replace(/^\uFEFF/, '') }
}

export function buildUserMessage(mode: LlmMode, source: string): string {
  return `MODE=${mode}\n\nSOURCE:\n${source}`
}

export function unwrapModelText(text: string): string {
  let out = text.replace(/^\uFEFF/, '').trim()
  const fenced = out.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n```$/)
  if (fenced) out = fenced[1].trim()
  return out ? `${out.replace(/\s+$/, '')}\n` : ''
}

export function ollamaOrigin(host: string): string {
  const url = new URL(host || 'http://127.0.0.1:11434')
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('OLLAMA_HOST must be localhost')
  }
  return url.origin
}

type ChatMessage = { role: 'system' | 'user'; content: string }

function messages(mode: LlmMode, source: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(mode, source) },
  ]
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
        return part.text
      }
      return ''
    })
    .join('')
}

async function completeGroq(env: LlmEnv, mode: LlmMode, source: string): Promise<LlmOk> {
  if (!env.groqKey) throw new Error('GROQ_API_KEY is not set')
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.groqModel,
      temperature: 0,
      reasoning_effort: 'low',
      messages: messages(mode, source),
    }),
  })
  const payload = (await response.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: unknown } }[]
    usage?: { prompt_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }
  }
  if (!response.ok) throw new Error(payload.error?.message || `Groq HTTP ${response.status}`)
  const text = unwrapModelText(contentText(payload.choices?.[0]?.message?.content))
  if (!text) throw new Error('Groq returned an empty result')
  return {
    text,
    provider: 'groq',
    model: env.groqModel,
    cachedTokens: payload.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    promptTokens: payload.usage?.prompt_tokens ?? 0,
  }
}

async function completeOllama(env: LlmEnv, mode: LlmMode, source: string): Promise<LlmOk> {
  const origin = ollamaOrigin(env.ollamaHost)
  const response = await fetch(`${origin}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.ollamaModel,
      stream: false,
      think: false,
      options: { temperature: 0 },
      messages: messages(mode, source),
    }),
  })
  const payload = (await response.json()) as {
    error?: string
    message?: { content?: unknown }
  }
  if (!response.ok) throw new Error(payload.error || `Ollama HTTP ${response.status}`)
  const text = unwrapModelText(contentText(payload.message?.content))
  if (!text) throw new Error('Ollama returned an empty result')
  return {
    text,
    provider: 'ollama',
    model: env.ollamaModel,
    cachedTokens: 0,
    promptTokens: 0,
  }
}

export async function formatWithProvider(env: LlmEnv, mode: LlmMode, source: string): Promise<LlmOk> {
  if (env.provider === 'groq') return completeGroq(env, mode, source)
  return completeOllama(env, mode, source)
}

export function statusPayload(env: LlmEnv) {
  const configured = env.provider === 'groq' ? Boolean(env.groqKey) : true
  return {
    configured,
    provider: env.provider,
    model: env.provider === 'groq' ? env.groqModel : env.ollamaModel,
  }
}

export function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        req.destroy()
        reject(new Error('payload too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw) as unknown)
      } catch {
        reject(new Error('invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export async function handleLlmRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: LlmEnv,
): Promise<void> {
  const path = req.url?.split('?')[0]
  if (path !== '/api/llm') return

  if (req.method === 'GET') {
    send(res, 200, statusPayload(env))
    return
  }

  if (req.method !== 'POST') {
    send(res, 405, { error: 'method not allowed' })
    return
  }

  try {
    const parsed = parseLlmRequest(await readJsonBody(req))
    if (env.provider === 'groq' && !env.groqKey) {
      send(res, 503, { error: 'GROQ_API_KEY is not set on the server' })
      return
    }
    const result = await formatWithProvider(env, parsed.mode, parsed.source)
    send(res, 200, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'llm failed'
    const status = message === 'payload too large' ? 413 : message.startsWith('mode') || message.includes('source') || message === 'invalid JSON' ? 400 : 502
    send(res, status, { error: message })
  }
}
