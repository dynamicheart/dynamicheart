import { ref } from 'vue'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { getCachedFont, loadDefaultFont } from '../utils/font.js'

export function useExport() {
  const exporting = ref(false)

  async function exportPdf(pdfBytes, watermarkParams, getColorRgb, calcSpacing) {
    exporting.value = true
    try {
      let fontBytes = getCachedFont()
      if (!fontBytes) fontBytes = await loadDefaultFont()

      const pdfDoc = await PDFDocument.load(pdfBytes)
      pdfDoc.registerFontkit(fontkit)
      const font = await pdfDoc.embedFont(fontBytes)

      const { text, fontSize, opacity, angle, density } = watermarkParams
      const color = getColorRgb()

      const pages = pdfDoc.getPages()
      for (const page of pages) {
        const { width: pw, height: ph } = page.getSize()
        const textWidth = font.widthOfTextAtSize(text, fontSize)
        const { xSpacing, ySpacing } = calcSpacing(textWidth, fontSize, density)
        const diag = Math.sqrt(pw * pw + ph * ph)
        const cols = Math.ceil(diag / xSpacing) + 2
        const rows = Math.ceil(diag / ySpacing) + 2

        const rad = (angle * Math.PI) / 180
        const cosA = Math.cos(rad)
        const sinA = Math.sin(rad)

        for (let r = -rows; r <= rows; r++) {
          for (let c = -cols; c <= cols; c++) {
            const lx = c * xSpacing
            const ly = r * ySpacing
            const x = pw / 2 + lx * cosA - ly * sinA - textWidth / 2
            const y = ph / 2 + lx * sinA + ly * cosA - fontSize / 2

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
      }

      const outBytes = await pdfDoc.save()
      const blob = new Blob([outBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'watermarked.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportPdf }
}
