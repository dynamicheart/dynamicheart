const LOCAL_FONT_PATH = `${import.meta.env.BASE_URL}fonts/NotoSansSC-Regular.ttf`
const FONT_CDN_URLS = [
  'https://fonts.gstatic.com/s/notosanssc/v37/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.ttf',
  'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest/chinese-simplified-400-normal.woff2',
]

let cachedFontBytes = null

export async function loadDefaultFont() {
  if (cachedFontBytes) return cachedFontBytes

  // Try local bundled font first, then CDN fallbacks
  const urls = [LOCAL_FONT_PATH, ...FONT_CDN_URLS]
  for (const url of urls) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      cachedFontBytes = new Uint8Array(await resp.arrayBuffer())
      return cachedFontBytes
    } catch {
      continue
    }
  }
  throw new Error('字体加载失败，请上传本地字体文件')
}

export async function loadLocalFont(file) {
  const buf = await file.arrayBuffer()
  cachedFontBytes = new Uint8Array(buf)
  return cachedFontBytes
}

export function getCachedFont() {
  return cachedFontBytes
}
