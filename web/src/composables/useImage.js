import { ref, shallowRef } from 'vue'

export function useImage() {
  const imageEl = shallowRef(null)
  const imageBytes = shallowRef(null)
  const imageType = ref('')
  const imageWidth = ref(0)
  const imageHeight = ref(0)
  const imageFileName = ref('')

  async function loadImage(arrayBuffer, fileName, mimeType) {
    imageBytes.value = new Uint8Array(arrayBuffer)
    imageType.value = mimeType
    imageFileName.value = fileName || ''

    // Create HTMLImageElement from bytes
    const blob = new Blob([imageBytes.value], { type: mimeType })
    const url = URL.createObjectURL(blob)

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        imageEl.value = img
        imageWidth.value = img.naturalWidth
        imageHeight.value = img.naturalHeight
        URL.revokeObjectURL(url)
        resolve()
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('图片加载失败'))
      }
      img.src = url
    })
  }

  function renderImage(canvas, scale = 1.5) {
    const img = imageEl.value
    if (!img) return null

    const dpr = window.devicePixelRatio || 1
    const cssWidth = img.naturalWidth * scale
    const cssHeight = img.naturalHeight * scale

    canvas.style.width = cssWidth + 'px'
    canvas.style.height = cssHeight + 'px'
    canvas.width = Math.floor(cssWidth * dpr)
    canvas.height = Math.floor(cssHeight * dpr)

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.drawImage(img, 0, 0, cssWidth, cssHeight)

    return { cssWidth, cssHeight }
  }

  async function exportImage(drawWatermarkOverlay) {
    const img = imageEl.value
    if (!img) return

    const w = img.naturalWidth
    const h = img.naturalHeight

    // Draw original image + watermark onto a single canvas at 1:1 scale
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)

    // Draw watermark at scale=1 (native pixel size)
    drawWatermarkOverlay(canvas, 1, w, h)

    // Export as original format
    const mime = imageType.value || 'image/png'
    const quality = mime === 'image/jpeg' ? 0.92 : undefined

    const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality))
    const fileName = makeExportName(imageFileName.value, mime)

    // Try File System Access API, fallback to download link
    if (window.showSaveFilePicker) {
      try {
        const ext = mime === 'image/png' ? '.png' : '.jpg'
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'Image', accept: { [mime]: [ext] } }],
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
  }

  function makeExportName(originalName, mime) {
    if (!originalName) {
      return mime === 'image/png' ? 'watermarked.png' : 'watermarked.jpg'
    }
    const ext = originalName.lastIndexOf('.')
    const base = ext > 0 ? originalName.slice(0, ext) : originalName
    const suffix = mime === 'image/png' ? '.png' : '.jpg'
    return `${base}_watermark${suffix}`
  }

  function clear() {
    imageEl.value = null
    imageBytes.value = null
    imageType.value = ''
    imageWidth.value = 0
    imageHeight.value = 0
    imageFileName.value = ''
  }

  return {
    imageEl, imageBytes, imageType,
    imageWidth, imageHeight, imageFileName,
    loadImage, renderImage, exportImage, clear,
  }
}
