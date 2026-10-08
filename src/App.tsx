import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, FileText, Moon, Sun, Upload } from 'lucide-react'
import { downloadName, formatMissing, formatPrompts } from './lib/format-prompts'
import { formatSegments } from './lib/format-segments'

const PROMPT_SAMPLE = `1. [HOOK] elbow jabs in2. [HOOK] steam near the ear
**Batch 4 of 11 (segments 91-120)**
3.[BUILD] rent maths on the notepad
4. [BUILD] phone glance`

const SEGMENT_SAMPLE = `SEG 001 | “Sor Josefa Menéndez vio, en tres momentos distintos,”
CONCEPT: Awe held in check: a witness who cannot unsee what she saw kneels in glory and her eyes search the viewer.
ANCHOR: Josefa kneeling, Jesus beside her, three arched doors of light.
CONTINUITY: Opening frame; sets Josefa, Jesus and the door-of-light motif.
ADDRESS: N (hook: her eyes look out at the viewer)
→ Style 1 | Camera MEDIUM-WIDE FULL FIGURE | Temp Warm | Motion M1 | Contrast: opening frame
SEG 002 | “and felt herself descending”
CONCEPT: The next line of the same scene.
ADDRESS: N
→ Style 5 | Camera WIDE FULL SCENE | Temp Cool | Motion M6 | Contrast: Temperature, Tonal weight`

type Theme = 'light' | 'dark'
type Mode = 'prompts' | 'segments'

export default function App() {
  const [mode, setMode] = useState<Mode>('prompts')
  const [promptSource, setPromptSource] = useState('')
  const [segmentSource, setSegmentSource] = useState('')
  const [promptFile, setPromptFile] = useState('prompts.txt')
  const [segmentFile, setSegmentFile] = useState('segments.txt')
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const fileRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const outputRef = useRef<HTMLPreElement>(null)
  const syncing = useRef<'source' | 'output' | null>(null)
  const source = mode === 'prompts' ? promptSource : segmentSource
  const fileName = mode === 'prompts' ? promptFile : segmentFile
  const promptReport = useMemo(() => formatPrompts(promptSource), [promptSource])
  const segmentReport = useMemo(() => formatSegments(segmentSource), [segmentSource])
  const report = mode === 'prompts' ? promptReport : segmentReport

  function syncScroll(from: 'source' | 'output') {
    const sourceEl = sourceRef.current
    const outputEl = outputRef.current
    if (!sourceEl || !outputEl) return
    if (syncing.current && syncing.current !== from) return

    const origin = from === 'source' ? sourceEl : outputEl
    const target = from === 'source' ? outputEl : sourceEl
    const originMax = origin.scrollHeight - origin.clientHeight
    const targetMax = target.scrollHeight - target.clientHeight
    if (originMax <= 0 || targetMax <= 0) return

    syncing.current = from
    target.scrollTop = (origin.scrollTop / originMax) * targetMax
    requestAnimationFrame(() => {
      if (syncing.current === from) syncing.current = null
    })
  }

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

  function setSource(text: string) {
    if (mode === 'prompts') setPromptSource(text)
    else setSegmentSource(text)
  }

  function setFileName(text: string) {
    if (mode === 'prompts') setPromptFile(text)
    else setSegmentFile(text)
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-white/10">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-zinc-500 uppercase">
            Prompt formatter
          </p>
          <h1 className="text-lg font-medium tracking-tight text-zinc-950 dark:text-zinc-50">
            {mode === 'prompts' ? 'One prompt per line' : 'One segment per block'}
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

      <div className="flex gap-6 border-b border-zinc-200 px-6 dark:border-white/10">
        <Tab active={mode === 'prompts'} onClick={() => setMode('prompts')}>
          Prompts
        </Tab>
        <Tab active={mode === 'segments'} onClick={() => setMode('segments')}>
          Segments
        </Tab>
      </div>

      <main className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden lg:grid-cols-2 lg:grid-rows-1">
        <section className="flex min-h-0 flex-col overflow-hidden border-b border-zinc-200 lg:border-r lg:border-b-0 dark:border-white/10">
          <div className="flex items-center justify-between gap-3 px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <FileText className="size-4" />
              Source
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSource(mode === 'prompts' ? PROMPT_SAMPLE : SEGMENT_SAMPLE)}
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
            ref={sourceRef}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            onScroll={() => syncScroll('source')}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              void onUpload(event.dataTransfer.files?.[0])
            }}
            placeholder={
              mode === 'prompts'
                ? 'Paste prompts, or drop a .txt file. VISUAL blocks keep only the Nanobanana prompt and take their number from VISUAL 001. Blank lines become 1. 2. 3. if you did not number them.'
                : 'Paste SEG 001 blocks. The right side keeps only the spoken line, as SEG 01: …'
            }
            className="min-h-0 flex-1 resize-none overflow-auto bg-transparent px-6 pb-6 text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-600"
            spellCheck={false}
          />
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden bg-zinc-100/80 dark:bg-zinc-950/60">
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
            <Stat label={mode === 'prompts' ? 'Prompts' : 'Segments'} value={String(report.count)} />
            <Stat
              label="Range"
              value={report.range ? `${report.range[0]}–${report.range[1]}` : '—'}
            />
            {mode === 'prompts' ? (
              <>
                <Stat label="Split onto new line" value={String(promptReport.gluedMoved)} />
                <Stat label="Numbers added" value={String(promptReport.numbersAdded)} />
                <Stat label="Batch headers removed" value={String(promptReport.batchesRemoved)} />
              </>
            ) : null}
            <Stat
              label="Missing"
              value={formatMissing(report.missing)}
              warn={report.missing.length > 0}
            />
          </div>

          <pre
            ref={outputRef}
            onScroll={() => syncScroll('output')}
            className="min-h-0 flex-1 overflow-auto px-6 pb-6 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100"
          >
            {report.text || (
              <span className="text-zinc-400 dark:text-zinc-600">
                {mode === 'prompts' ? 'Formatted prompts show up here.' : 'Formatted segments show up here.'}
              </span>
            )}
          </pre>
        </section>
      </main>
    </div>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-1 py-3 text-sm ${
        active
          ? 'border-zinc-950 text-zinc-950 dark:border-amber-200 dark:text-amber-100'
          : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
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
