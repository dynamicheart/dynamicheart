import { reactive, watch } from 'vue'

const STORAGE_KEY = 'pdf-watermark-params'
const DENSITY_FACTORS = { sparse: 1.8, normal: 1.0, dense: 0.7 }

const COLOR_RGB = {
  gray: [0.5, 0.5, 0.5],
  red: [0.78, 0.2, 0.2],
  blue: [0.2, 0.2, 0.78],
}

function loadSavedParams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveParams(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      text: p.text,
      fontSize: p.fontSize,
      opacity: p.opacity,
      angle: p.angle,
      density: p.density,
      colorKey: p.colorKey,
      customColor: p.customColor,
    }))
  } catch {}
}

const DEFAULT_PARAMS = {
  text: '请输入水印文字',
  fontSize: 50,
  opacity: 0.3,
  angle: 30,
  density: 'normal',
  colorKey: 'gray',
  customColor: '#808080',
}

export function useWatermark() {
  const saved = loadSavedParams()
  const params = reactive({ ...DEFAULT_PARAMS, ...saved })

  // Persist to localStorage on change
  watch(
    () => [params.text, params.fontSize, params.opacity, params.angle, params.density, params.colorKey, params.customColor],
    () => saveParams(params),
    { deep: false }
  )

  function getColor(alpha) {
    if (params.colorKey === 'custom') {
      const hex = params.customColor
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgba(${r},${g},${b},${alpha})`
    }
    const [r, g, b] = COLOR_RGB[params.colorKey]
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`
  }

  function getColorRgb() {
    if (params.colorKey === 'custom') {
      const hex = params.customColor
      return {
        r: parseInt(hex.slice(1, 3), 16) / 255,
        g: parseInt(hex.slice(3, 5), 16) / 255,
        b: parseInt(hex.slice(5, 7), 16) / 255,
      }
    }
    const [r, g, b] = COLOR_RGB[params.colorKey]
    return { r, g, b }
  }

  function calcSpacing(textWidth, fontSize, density) {
    const factor = DENSITY_FACTORS[density]
    // Minimum gap = 1.2x textWidth so text never overlaps even at "dense"
    const minXGap = textWidth * 1.2
    const rawX = (textWidth + fontSize * 4) * factor
    const xSpacing = Math.max(rawX, minXGap)
    const ySpacing = Math.max(fontSize * 8 * factor, fontSize * 3)
    return { xSpacing, ySpacing }
  }

  function drawWatermarkOverlay(canvas, scale = 1.5, cssWidth, cssHeight) {
    const ctx = canvas.getContext('2d')

    // Work in PDF-point space to match export
    const pdfW = cssWidth / scale
    const pdfH = cssHeight / scale
    const fontSize = params.fontSize
    const angleRad = params.angle * Math.PI / 180

    ctx.save()
    ctx.scale(scale, scale)

    ctx.font = `${fontSize}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.fillStyle = getColor(params.opacity)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const textWidth = ctx.measureText(params.text).width
    const { xSpacing, ySpacing } = calcSpacing(textWidth, fontSize, params.density)

    const diag = Math.sqrt(pdfW * pdfW + pdfH * pdfH)
    const cols = Math.ceil(diag / xSpacing) + 2
    const rows = Math.ceil(diag / ySpacing) + 2

    // Rotate entire grid + text together
    ctx.translate(pdfW / 2, pdfH / 2)
    ctx.rotate(-angleRad)

    for (let r = -rows; r <= rows; r++) {
      for (let c = -cols; c <= cols; c++) {
        ctx.fillText(params.text, c * xSpacing, r * ySpacing)
      }
    }
    ctx.restore()
  }

  function invalidateCache() {}

  return { params, drawWatermarkOverlay, getColorRgb, invalidateCache, calcSpacing, DENSITY_FACTORS }
}
