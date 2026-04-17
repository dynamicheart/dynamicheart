<template>
  <div class="app">
    <ControlPanel
      :params="params"
      :pdf-loaded="!!pdfDoc"
      :exporting="exporting"
      :export-progress="exportProgress"
      @pdf-loaded="onPdfLoaded"
      @export="onExport"
    />
    <PdfPreview
      ref="previewRef"
      :pdf-loaded="!!pdfDoc"
      :total-pages="totalPages"
      :render-page="renderPage"
      :draw-watermark="drawWatermarkOverlay"
      @drop-pdf="onDropPdf"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import PdfPreview from './components/PdfPreview.vue'
import { usePdf } from './composables/usePdf.js'
import { useWatermark } from './composables/useWatermark.js'
import { useExport } from './composables/useExport.js'
import { loadDefaultFont } from './utils/font.js'

const {
  pdfDoc, pdfBytes, currentPage, totalPages,
  pageWidth, pageHeight, loading, loadProgress,
  loadPdf, renderPage, prevPage, nextPage,
} = usePdf()

const { params, drawWatermarkOverlay, getColorRgb, invalidateCache, calcSpacing } = useWatermark()
const { exporting, exportProgress, exportPdf } = useExport()

const previewRef = ref(null)
const pdfFileName = ref('')

async function onPdfLoaded(arrayBuffer, fileName) {
  pdfFileName.value = fileName || ''
  await loadPdf(arrayBuffer)
}

async function onDropPdf(file) {
  pdfFileName.value = file.name || ''
  const buf = await file.arrayBuffer()
  try { await loadDefaultFont() } catch {}
  await loadPdf(buf)
}

async function onExport() {
  if (!pdfBytes.value) return
  await exportPdf(pdfBytes.value, params, getColorRgb, calcSpacing, pdfFileName.value)
}

// Watermark redraw on param change — use RAF for responsive feedback
let rafId = null
watch(
  () => [params.text, params.fontSize, params.opacity, params.angle, params.density, params.colorKey, params.customColor],
  () => {
    invalidateCache()
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      if (previewRef.value) previewRef.value.redrawAllWatermarks()
      rafId = null
    })
  },
)
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", sans-serif;
  color: #333;
  background: #f0f0f0;
}

.app {
  display: flex;
  height: 100vh;
  width: 100vw;
}
</style>
