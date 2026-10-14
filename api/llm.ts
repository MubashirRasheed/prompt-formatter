import {
  envFrom,
  formatWithProvider,
  parseLlmRequest,
  statusPayload,
} from '../server/llm.js'

export const config = { runtime: 'nodejs' }

function env() {
  return envFrom(process.env)
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function GET() {
  try {
    return json(statusPayload(env()))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'status failed'
    return json({ configured: false, provider: 'groq', model: '', error: message }, 500)
  }
}

export async function POST(request: Request) {
  try {
    const current = env()
    if (current.provider === 'groq' && !current.groqKey) {
      return json({ error: 'GROQ_API_KEY is not set on the server' }, 503)
    }
    const parsed = parseLlmRequest(await request.json())
    return json(await formatWithProvider(current, parsed.mode, parsed.source))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'llm failed'
    const status =
      message.startsWith('mode') || message.includes('source') || message === 'invalid JSON' ? 400 : 502
    return json({ error: message }, status)
  }
}
