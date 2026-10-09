import { jsPDF } from 'jspdf'

function pdfSafe(text: string): string {
  return text
    .replaceAll('→', '->')
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replaceAll('“', '"')
    .replaceAll('”', '"')
    .replaceAll('‘', "'")
    .replaceAll('’', "'")
    .replaceAll('…', '...')
}

function wrappedLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const row of pdfSafe(text).split('\n')) {
    if (!row.trim()) {
      lines.push('')
      continue
    }
    const wrapped = doc.splitTextToSize(row, maxWidth)
    lines.push(...(Array.isArray(wrapped) ? wrapped : [wrapped]))
  }
  return lines
}

export function buildPdf(text: string): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 54
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const lineHeight = 16
  doc.setFont('times', 'normal')
  doc.setFontSize(12)

  let y = margin
  for (const line of wrappedLines(doc, text, pageWidth - margin * 2)) {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    if (line) doc.text(line, margin, y)
    y += lineHeight
  }

  return doc.output('blob')
}
