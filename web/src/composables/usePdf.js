import { ref, shallowRef } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export function usePdf() {
  const pdfDoc = shallowRef(null)
  const pdfBytes = shallowRef(null)
  const currentPage = ref(1)
  const totalPages = ref(0)
  const pageWidth = ref(0)
  const pageHeight = ref(0)
  const loading = ref(false)

  async function loadPdf(arrayBuffer) {
    loading.value = true
    try {
      pdfBytes.value = new Uint8Array(arrayBuffer)
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.value.slice() }).promise
      pdfDoc.value = doc
      totalPages.value = doc.numPages
      currentPage.value = 1

      const page = await doc.getPage(1)
      const vp = page.getViewport({ scale: 1 })
      pageWidth.value = vp.width
      pageHeight.value = vp.height
    } finally {
      loading.value = false
    }
  }

  async function renderPage(canvas, pageNum, scale = 1.5) {
    if (!pdfDoc.value) return
    const page = await pdfDoc.value.getPage(pageNum)
    const dpr = window.devicePixelRatio || 1
    const vp = page.getViewport({ scale })

    // Set CSS display size
    canvas.style.width = vp.width + 'px'
    canvas.style.height = vp.height + 'px'

    // Set actual canvas buffer size for Retina
    canvas.width = Math.floor(vp.width * dpr)
    canvas.height = Math.floor(vp.height * dpr)

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    await page.render({ canvasContext: ctx, viewport: vp }).promise

    pageWidth.value = vp.width / scale
    pageHeight.value = vp.height / scale

    return { cssWidth: vp.width, cssHeight: vp.height }
  }

  function prevPage() {
    if (currentPage.value > 1) currentPage.value--
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) currentPage.value++
  }

  return {
    pdfDoc, pdfBytes, currentPage, totalPages,
    pageWidth, pageHeight, loading,
    loadPdf, renderPage, prevPage, nextPage,
  }
}
