import PDFDocument from 'pdfkit'

const FONT_URL = 'https://cdn.jsdelivr.net/gh/googlefonts/heebo@main/fonts/ttf/Heebo-Regular.ttf'
let _font: Buffer | null = null

async function loadFont(): Promise<Buffer> {
  if (!_font) {
    const r = await fetch(FONT_URL)
    if (!r.ok) throw new Error(`Font fetch failed: ${r.status}`)
    _font = Buffer.from(await r.arrayBuffer())
  }
  return _font
}

export async function textToPdf(text: string): Promise<Buffer> {
  const font = await loadFont()
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 55 })
    const chunks: Buffer[] = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.registerFont('Heebo', font)
    doc.font('Heebo').fontSize(11)

    for (const line of text.split('\n')) {
      if (!line.trim()) {
        doc.moveDown(0.35)
      } else {
        doc.text(line, { align: 'right', lineGap: 2 })
      }
    }

    doc.end()
  })
}
