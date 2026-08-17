<template>
  <div class="preview-wrapper">
    <!-- Zoom controls -->
    <div class="zoom-bar">
      <button class="zoom-btn" @click="zoomOut" :disabled="zoom <= 0.25">-</button>
      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
      <button class="zoom-btn" @click="zoomIn" :disabled="zoom >= 3">+</button>
      <button class="zoom-btn text" @click="zoomFit">适应</button>
    </div>

    <div class="preview-container" ref="scrollRef" tabindex="0" @dragover.prevent @drop.prevent="onDrop" @paste.prevent="onPaste">
      <div v-if="preparing" class="placeholder">
        <div class="page-spinner"></div>
        <p>正在加载文件...</p>
      </div>
      <div v-else-if="!fileLoaded" class="placeholder">
        <div class="placeholder-icon">PDF / IMG</div>
        <p>将文件拖到此处，或粘贴图片</p>
        <p class="hint">支持 PDF、PNG、JPG</p>
      </div>

      <!-- Image mode: single canvas -->
      <div v-else-if="fileMode === 'image'" class="pages">
        <div class="page-slot">
          <div class="canvas-wrapper">
            <canvas ref="imgCanvasRef" class="pdf-canvas"></canvas>
            <canvas ref="imgWmCanvasRef" class="wm-canvas"></canvas>
          </div>
        </div>
      </div>

      <!-- PDF mode: paginated canvases -->
      <div v-else class="pages">
        <div v-for="p in totalPages" :key="p" class="page-slot" :data-page="p" ref="pageRefs">
          <div class="page-number">{{ p }} / {{ totalPages }}</div>
          <div class="canvas-wrapper">
            <div v-if="!pageRendered[p]" class="page-loading">
              <div class="page-spinner"></div>
              <span>渲染第 {{ p }} 页...</span>
            </div>
            <canvas :ref="el => setPdfCanvas(p, el)" class="pdf-canvas"></canvas>
            <canvas :ref="el => setWmCanvas(p, el)" class="wm-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onUnmounted } from 'vue'

const props = defineProps({
  fileLoaded: Boolean,
  fileMode: String,   // 'pdf' | 'image' | 'none'
  preparing: Boolean,
  totalPages: Number,
  renderPage: Function,
  renderImage: Function,
  drawWatermark: Function,
  pageWidth: Number,
})

const emit = defineEmits(['drop-file'])

const scrollRef = ref(null)
const pageRefs = ref([])
const imgCanvasRef = ref(null)
const imgWmCanvasRef = ref(null)
const zoom = ref(1.0)

const pdfCanvases = {}
const wmCanvases = {}
const renderedPages = new Set()
const visiblePages = new Set()
const pageRendered = reactive({})

function setPdfCanvas(p, el) { if (el) pdfCanvases[p] = el }
function setWmCanvas(p, el) { if (el) wmCanvases[p] = el }

function zoomIn() { zoom.value = Math.min(3, +(zoom.value + 0.25).toFixed(2)) }
function zoomOut() { zoom.value = Math.max(0.25, +(zoom.value - 0.25).toFixed(2)) }

function zoomFit() {
  if (!scrollRef.value || !props.pageWidth) {
    zoom.value = 1.0
    return
  }
  // Container available width minus padding (20px each side)
  const containerWidth = scrollRef.value.clientWidth - 40
  // PDF rendered CSS width = pageWidth * scale(1.5) at zoom=1
  const pdfCssWidth = props.pageWidth * 1.5
  const fitZoom = containerWidth / pdfCssWidth
  zoom.value = Math.max(0.25, Math.min(3, +fitZoom.toFixed(2)))
}

let observer = null

function setupObserver() {
  if (observer) observer.disconnect()
  renderedPages.clear()
  visiblePages.clear()

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const pageNum = parseInt(entry.target.dataset.page)
        if (entry.isIntersecting) {
          visiblePages.add(pageNum)
          if (!renderedPages.has(pageNum)) {
            renderSinglePage(pageNum)
          }
        } else {
          visiblePages.delete(pageNum)
        }
      }
    },
    { root: scrollRef.value, rootMargin: '300px' }
  )

  nextTick(() => {
    if (pageRefs.value) {
      for (const el of pageRefs.value) {
        observer.observe(el)
      }
    }
  })
}

async function renderSinglePage(pageNum) {
  renderedPages.add(pageNum)
  const pdfCanvas = pdfCanvases[pageNum]
  const wmCanvas = wmCanvases[pageNum]
  if (!pdfCanvas) return

  const scale = 1.5 * zoom.value
  const result = await props.renderPage(pdfCanvas, pageNum, scale)

  if (wmCanvas && result) {
    const dpr = window.devicePixelRatio || 1
    wmCanvas.style.width = result.cssWidth + 'px'
    wmCanvas.style.height = result.cssHeight + 'px'
    wmCanvas.width = Math.floor(result.cssWidth * dpr)
    wmCanvas.height = Math.floor(result.cssHeight * dpr)
    const ctx = wmCanvas.getContext('2d')
    ctx.scale(dpr, dpr)
    props.drawWatermark(wmCanvas, scale, result.cssWidth, result.cssHeight)
  }
  pageRendered[pageNum] = true
}

function redrawAllWatermarks() {
  if (props.fileMode === 'image') {
    redrawImageWatermark()
    return
  }
  const dpr = window.devicePixelRatio || 1
  const scale = 1.5 * zoom.value
  const pagesToRedraw = renderedPages
  for (const pageNum of pagesToRedraw) {
    const pdfCanvas = pdfCanvases[pageNum]
    const wmCanvas = wmCanvases[pageNum]
    if (!wmCanvas || !pdfCanvas) continue

    const cssW = parseFloat(pdfCanvas.style.width)
    const cssH = parseFloat(pdfCanvas.style.height)
    if (!cssW || !cssH) continue

    const bufW = Math.floor(cssW * dpr)
    const bufH = Math.floor(cssH * dpr)

    // Only reallocate buffer if dimensions changed — avoids expensive GPU realloc
    if (wmCanvas.width !== bufW || wmCanvas.height !== bufH) {
      wmCanvas.style.width = cssW + 'px'
      wmCanvas.style.height = cssH + 'px'
      wmCanvas.width = bufW
      wmCanvas.height = bufH
    }

    const ctx = wmCanvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, bufW, bufH)
    ctx.scale(dpr, dpr)
    props.drawWatermark(wmCanvas, scale, cssW, cssH)
  }
}

// --- Image mode rendering ---
function renderImagePreview() {
  const canvas = imgCanvasRef.value
  const wmCanvas = imgWmCanvasRef.value
  if (!canvas || !props.renderImage) return

  const scale = 1.5 * zoom.value
  const result = props.renderImage(canvas, scale)
  if (!result || !wmCanvas) return

  const dpr = window.devicePixelRatio || 1
  wmCanvas.style.width = result.cssWidth + 'px'
  wmCanvas.style.height = result.cssHeight + 'px'
  wmCanvas.width = Math.floor(result.cssWidth * dpr)
  wmCanvas.height = Math.floor(result.cssHeight * dpr)
  const ctx = wmCanvas.getContext('2d')
  ctx.scale(dpr, dpr)
  props.drawWatermark(wmCanvas, scale, result.cssWidth, result.cssHeight)
}

function redrawImageWatermark() {
  const canvas = imgCanvasRef.value
  const wmCanvas = imgWmCanvasRef.value
  if (!canvas || !wmCanvas) return

  const dpr = window.devicePixelRatio || 1
  const scale = 1.5 * zoom.value
  const cssW = parseFloat(canvas.style.width)
  const cssH = parseFloat(canvas.style.height)
  if (!cssW || !cssH) return

  const bufW = Math.floor(cssW * dpr)
  const bufH = Math.floor(cssH * dpr)

  if (wmCanvas.width !== bufW || wmCanvas.height !== bufH) {
    wmCanvas.style.width = cssW + 'px'
    wmCanvas.style.height = cssH + 'px'
    wmCanvas.width = bufW
    wmCanvas.height = bufH
  }

  const ctx = wmCanvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, bufW, bufH)
  ctx.scale(dpr, dpr)
  props.drawWatermark(wmCanvas, scale, cssW, cssH)
}

// Re-render all pages on zoom change
watch(zoom, () => {
  if (props.fileMode === 'image') {
    renderImagePreview()
  } else {
    renderedPages.clear()
    Object.keys(pageRendered).forEach(k => delete pageRendered[k])
    nextTick(setupObserver)
  }
})

function isInViewport(el) {
  if (!scrollRef.value) return false
  const rect = el.getBoundingClientRect()
  const containerRect = scrollRef.value.getBoundingClientRect()
  return rect.bottom > containerRect.top - 300 && rect.top < containerRect.bottom + 300
}

// Setup observer when file is loaded AND preparing is done
watch([() => props.fileLoaded, () => props.preparing, () => props.fileMode], ([loaded, prep, mode]) => {
  if (loaded && !prep) {
    nextTick(() => {
      zoomFit()
      if (mode === 'image') {
        nextTick(renderImagePreview)
      } else {
        nextTick(setupObserver)
      }
    })
  }
})

watch(() => props.totalPages, () => {
  renderedPages.clear()
  visiblePages.clear()
  Object.keys(pdfCanvases).forEach(k => delete pdfCanvases[k])
  Object.keys(wmCanvases).forEach(k => delete wmCanvases[k])
  Object.keys(pageRendered).forEach(k => delete pageRendered[k])
  nextTick(setupObserver)
})

function onDrop(e) {
  const file = e.dataTransfer.files[0]
  if (!file) return
  const validTypes = ['application/pdf', 'image/png', 'image/jpeg']
  if (validTypes.includes(file.type)) {
    emit('drop-file', file)
  }
}

function onPaste(e) {
  const items = e.clipboardData && e.clipboardData.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        e.preventDefault()
        emit('drop-file', file)
        return
      }
    }
  }
}

onUnmounted(() => {
  if (observer) observer.disconnect()
})

defineExpose({ redrawAllWatermarks })
</script>

<style scoped>
.preview-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.zoom-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.zoom-btn {
  width: 32px;
  height: 28px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zoom-btn.text {
  width: auto;
  padding: 0 10px;
  font-size: 12px;
}

.zoom-btn:hover:not(:disabled) {
  border-color: #4a90d9;
  color: #4a90d9;
}

.zoom-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-label {
  font-size: 13px;
  color: #666;
  min-width: 48px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.preview-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  background: #e2e2e2;
  padding: 20px;
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 500px;
  border: 2px dashed #c0c0c0;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.4);
}

.placeholder-icon {
  font-size: 48px;
  font-weight: 700;
  color: #bbb;
  margin-bottom: 12px;
  letter-spacing: 4px;
}

.placeholder p {
  color: #999;
  font-size: 15px;
  margin: 2px 0;
}

.placeholder .hint {
  font-size: 13px;
  color: #bbb;
}

.pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.page-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.page-number {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}

.canvas-wrapper {
  position: relative;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
  line-height: 0;
  min-width: 200px;
  min-height: 280px;
}

.page-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #fff;
  z-index: 2;
  font-size: 13px;
  color: #999;
}

.page-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e0e0e0;
  border-top-color: #4a90d9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.pdf-canvas {
  display: block;
}

.wm-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
</style>
