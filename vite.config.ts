/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { llmPlugin } from './server/llm-plugin.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), llmPlugin()],
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})

