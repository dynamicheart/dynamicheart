import { ref } from 'vue'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { getCachedFont, loadDefaultFont } from '../utils/font.js'

export function useExport() {
  const exporting = ref(false)
  const exportProgress = ref(0)

  function makeFileName(originalName) {
    if (!originalName) return 'watermarked.pdf'
    const base = originalName.replace(/\.pdf$/i, '')
    return `${base}_watermark.pdf`
  }

  async function exportPdf(pdfBytes, watermarkParams, getColorRgb, calcSpacing, originalFileName) {
    exporting.value = true
    exportProgress.value = 0
    try {
      let fontBytes = getCachedFont()
      if (!fontBytes) fontBytes = await loadDefaultFont()

      const pdfDoc = await PDFDocument.load(pdfBytes)
      pdfDoc.registerFontkit(fontkit)
      const font = await pdfDoc.embedFont(fontBytes)

      const { text, fontSize, opacity, angle, density } = watermarkParams
      const color = getColorRgb()

      const pages = pdfDoc.getPages()
      const total = pages.length
      for (let i = 0; i < total; i++) {
        const page = pages[i]
        const { width: pw, height: ph } = page.getSize()
        const textWidth = font.widthOfTextAtSize(text, fontSize)
        const { xSpacing, ySpacing } = calcSpacing(textWidth, fontSize, density)
        const diag = Math.sqrt(pw * pw + ph * ph)
        const cols = Math.ceil(diag / xSpacing) + 2
        const rows = Math.ceil(diag / ySpacing) + 2

        const rad = (angle * Math.PI) / 180
        const cosA = Math.cos(rad)
        const sinA = Math.sin(rad)

        // Match canvas preview: translate(center) + rotate(-angle) + draw on grid
        // Canvas visual position of grid point (lx, ly):
        //   vis_x = pw/2 + lx*cos(a) + ly*sin(a)
        //   vis_y = ph/2 - lx*sin(a) + ly*cos(a)
        // Convert to PDF Y-up: pdf_y = ph - vis_y
        // Then offset from center to left-baseline anchor accounting for rotation
        for (let r = -rows; r <= rows; r++) {
          for (let c = -cols; c <= cols; c++) {
            const lx = c * xSpacing
            const ly = r * ySpacing
            const x = pw / 2 + (lx - textWidth / 2) * cosA + (ly + fontSize / 2) * sinA
            const y = ph / 2 + (lx - textWidth / 2) * sinA - (ly + fontSize / 2) * cosA

            page.drawText(text, {
              x, y,
              size: fontSize,
              font,
              color: rgb(color.r, color.g, color.b),
              opacity,
              rotate: degrees(angle),
            })
          }
        }
        exportProgress.value = Math.round(((i + 1) / total) * 100)
      }

      const outBytes = await pdfDoc.save()
      const blob = new Blob([outBytes], { type: 'application/pdf' })
      const fileName = makeFileName(originalFileName)

      // Try File System Access API for save-as dialog, fallback to download
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          return
        } catch (e) {
          if (e.name === 'AbortError') return
        }
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      exporting.value = false
      exportProgress.value = 0
    }
  }

  return { exporting, exportProgress, exportPdf }
}
