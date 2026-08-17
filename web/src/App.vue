<template>
  <div class="app">
    <ControlPanel
      :params="params"
      :file-loaded="fileLoaded"
      :exporting="exporting"
      :export-progress="exportProgress"
      :font-error="fontError"
      @file-loaded="onFileLoaded"
      @export="onExport"
      @font-loaded="fontError = ''"
    />
    <PdfPreview
      ref="previewRef"
      :file-loaded="fileLoaded"
      :file-mode="fileMode"
      :preparing="preparing"
      :total-pages="totalPages"
      :page-width="currentPageWidth"
      :render-page="renderPage"
      :render-image="renderImage"
      :draw-watermark="drawWatermarkOverlay"
      @drop-file="onDropFile"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import PdfPreview from './components/PdfPreview.vue'
import { usePdf } from './composables/usePdf.js'
import { useWatermark } from './composables/useWatermark.js'
import { useExport } from './composables/useExport.js'
import { useImage } from './composables/useImage.js'
import { loadDefaultFont, getCachedFont } from './utils/font.js'

const {
  pdfDoc, pdfBytes, currentPage, totalPages,
  pageWidth, pageHeight, loading, loadProgress,
  loadPdf, renderPage, prevPage, nextPage,
} = usePdf()

const { params, drawWatermarkOverlay, getColorRgb, invalidateCache, calcSpacing } = useWatermark()
const { exporting, exportProgress, exportPdf } = useExport()
const { imageEl, imageWidth, imageHeight, loadImage, renderImage, exportImage, clear: clearImage } = useImage()

// Preload font on page open so it's ready when user selects a PDF
onMounted(() => {
  loadDefaultFont().catch(() => {})
})

const previewRef = ref(null)
const fileMode = ref('none')  // 'none' | 'pdf' | 'image'
const pdfFileName = ref('')
const fontError = ref('')
const preparing = ref(false)

const fileLoaded = computed(() => {
  if (fileMode.value === 'pdf') return !!pdfDoc.value
  if (fileMode.value === 'image') return !!imageEl.value
  return false
})

const currentPageWidth = computed(() => {
  if (fileMode.value === 'image') return imageWidth.value
  return pageWidth.value
})

async function onFileLoaded(arrayBuffer, fileName, fileType, mimeType) {
  preparing.value = true
  if (fileType === 'image') {
    fileMode.value = 'image'
    await loadImage(arrayBuffer, fileName, mimeType)
  } else {
    fileMode.value = 'pdf'
    pdfFileName.value = fileName || ''
    await loadPdf(arrayBuffer)
  }
  preparing.value = false
}

async function onDropFile(file) {
  preparing.value = true
  const buf = await file.arrayBuffer()
  const isImage = ['image/png', 'image/jpeg'].includes(file.type)

  if (isImage) {
    fileMode.value = 'image'
    await loadImage(buf, file.name, file.type)
  } else {
    fileMode.value = 'pdf'
    pdfFileName.value = file.name || ''
    try { await loadDefaultFont() } catch {}
    await loadPdf(buf)
    fontError.value = getCachedFont() ? '' : '默认字体加载失败，请上传本地字体文件'
  }
  preparing.value = false
}

async function onExport() {
  if (fileMode.value === 'pdf') {
    if (!pdfBytes.value) return
    await exportPdf(pdfBytes.value, params, getColorRgb, calcSpacing, pdfFileName.value)
  } else if (fileMode.value === 'image') {
    await exportImage(drawWatermarkOverlay)
  }
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