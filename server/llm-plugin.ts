import { loadEnv, type Plugin } from 'vite'
import { envFrom, handleLlmRequest } from './llm.ts'

export function llmPlugin(): Plugin {
  let env = envFrom({})

  return {
    name: 'prompt-formatter-llm',
    configResolved(config) {
      env = envFrom({
        ...loadEnv(config.mode, config.root, ''),
        ...process.env,
      })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/llm') {
          next()
          return
        }
        void handleLlmRequest(req, res, env).catch(next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/llm') {
          next()
          return
        }
        void handleLlmRequest(req, res, env).catch(next)
      })
    },
  }
}
