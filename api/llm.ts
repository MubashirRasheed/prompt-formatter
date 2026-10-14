import { envFrom, formatWithProvider, parseLlmRequest, statusPayload } from '../server/llm.ts'

type VercelRes = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: VercelRes,
) {
  const env = envFrom(process.env)
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    res.status(200).json(statusPayload(env))
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  try {
    if (env.provider === 'groq' && !env.groqKey) {
      res.status(503).json({ error: 'GROQ_API_KEY is not set on the server' })
      return
    }
    const parsed = parseLlmRequest(req.body)
    const result = await formatWithProvider(env, parsed.mode, parsed.source)
    res.status(200).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'llm failed'
    const status =
      message.startsWith('mode') || message.includes('source') || message === 'invalid JSON' ? 400 : 502
    res.status(status).json({ error: message })
  }
}
