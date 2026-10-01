import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, FileText, Moon, Sun, Upload } from 'lucide-react'
import { downloadName, formatMissing, formatPrompts } from './lib/format-prompts'

const SAMPLE = `1. [HOOK] elbow jabs in2. [HOOK] steam near the ear
**Batch 4 of 11 (segments 91-120)**
3.[BUILD] rent maths on the notepad
4. [BUILD] phone glance`

type Theme = 'light' | 'dark'

export default function App() {
  const [source, setSource] = useState('')
  const [fileName, setFileName] = useState('prompts.txt')
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const fileRef = useRef<HTMLInputElement>(null)
  const report = useMemo(() => formatPrompts(source), [source])

  useEffect(() => {
    const saved = localStorage.getItem('prompt-formatter-theme')
    if (saved === 'dark') setTheme('dark')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('prompt-formatter-theme', next)
  }

  async function onUpload(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    setSource(text.replace(/^\uFEFF/, ''))
    if (file.name) setFileName(file.name)
  }

  async function copyOutput() {
    if (!report.text) return
    await navigator.clipboard.writeText(report.text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  function downloadOutput() {
    if (!report.text) return
    const blob = new Blob([report.text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = downloadName(fileName)
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-white/10">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-zinc-500 uppercase">
            Prompt formatter
          </p>
          <h1 className="text-lg font-medium tracking-tight text-zinc-950 dark:text-zinc-50">
            One prompt per line
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <label className="flex min-w-[220px] items-center gap-3 sm:w-56">
            <span className="text-xs text-zinc-500">File</span>
            <input
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-500/70 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-300/60"
              aria-label="Download file name"
            />
          </label>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-0 lg:grid-cols-2">
        <section className="flex min-h-[420px] flex-col border-b border-zinc-200 lg:border-r lg:border-b-0 dark:border-white/10">
          <div className="flex items-center justify-between gap-3 px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <FileText className="size-4" />
              Source
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSource(SAMPLE)}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
              >
                Sample
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-800 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
              >
                <Upload className="size-3.5" />
                Upload .txt
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(event) => {
                  void onUpload(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </div>
          </div>
          <textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              void onUpload(event.dataTransfer.files?.[0])
            }}
            placeholder="Paste prompts, or drop a .txt file. Blank lines become 1. 2. 3. if you did not number them. Glued numbers are split onto new lines."
            className="min-h-0 flex-1 resize-none bg-transparent px-6 pb-6 text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-600"
            spellCheck={false}
          />
        </section>

        <section className="flex min-h-[420px] flex-col bg-zinc-100/80 dark:bg-zinc-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Formatted</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void copyOutput()}
                disabled={!report.text}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 hover:bg-zinc-50 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-white/5"
              >
                <Copy className="size-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={downloadOutput}
                disabled={!report.text}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-amber-200 dark:text-zinc-950 dark:hover:bg-amber-100"
              >
                <Download className="size-3.5" />
                Download
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-6 pb-3">
            <Stat label="Prompts" value={String(report.count)} />
            <Stat
              label="Range"
              value={report.range ? `${report.range[0]}–${report.range[1]}` : '—'}
            />
            <Stat label="Split onto new line" value={String(report.gluedMoved)} />
            <Stat label="Numbers added" value={String(report.numbersAdded)} />
            <Stat label="Batch headers removed" value={String(report.batchesRemoved)} />
            <Stat
              label="Missing"
              value={formatMissing(report.missing)}
              warn={report.missing.length > 0}
            />
          </div>

          <pre className="min-h-0 flex-1 overflow-auto px-6 pb-6 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
            {report.text || (
              <span className="text-zinc-400 dark:text-zinc-600">Formatted prompts show up here.</span>
            )}
          </pre>
        </section>
      </main>
    </div>
  )
}

function Stat({
  label,
  value,
  warn = false,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="max-w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-zinc-900/80">
      <p className="text-[10px] tracking-wide text-zinc-500 uppercase">{label}</p>
      <p
        className={`truncate text-xs ${warn ? 'text-amber-700 dark:text-amber-200' : 'text-zinc-800 dark:text-zinc-200'}`}
      >
        {value}
      </p>
    </div>
  )
}
