const FONT_CDN_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest/chinese-simplified-400-normal.woff2'
const FONT_CDN_URL_FALLBACK = 'https://fonts.gstatic.com/s/notosanssc/v37/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.ttf'

let cachedFontBytes = null

export async function loadDefaultFont() {
  if (cachedFontBytes) return cachedFontBytes

  for (const url of [FONT_CDN_URL, FONT_CDN_URL_FALLBACK]) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      cachedFontBytes = new Uint8Array(await resp.arrayBuffer())
      return cachedFontBytes
    } catch {
      continue
    }
  }
  throw new Error('Failed to load font from CDN')
}

export async function loadLocalFont(file) {
  const buf = await file.arrayBuffer()
  cachedFontBytes = new Uint8Array(buf)
  return cachedFontBytes
}

export function getCachedFont() {
  return cachedFontBytes
}
