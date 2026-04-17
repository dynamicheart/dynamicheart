<template>
  <aside class="panel">
    <div class="panel-header">
      <h1>PDF 水印工具</h1>
      <p class="subtitle">在线预览 &amp; 添加水印</p>
    </div>

    <div class="panel-body">
      <!-- File selectors -->
      <div class="group">
        <label class="file-btn primary" :class="{ disabled: fontLoading }">
          <span class="file-btn-icon">+</span>
          {{ pdfLoaded ? '更换 PDF' : '选择 PDF 文件' }}
          <input type="file" accept=".pdf" hidden @change="onPdfSelect" />
        </label>
      </div>

      <div class="group">
        <label class="file-btn secondary">
          <span class="file-btn-icon">A</span>
          {{ fontName || '自定义字体（可选）' }}
          <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden @change="onFontSelect" />
        </label>
        <span v-if="fontLoading" class="loading-text">加载字体中...</span>
      </div>

      <hr class="divider" />

      <!-- Watermark text -->
      <div class="group">
        <label class="label">水印文字</label>
        <textarea v-model="params.text" class="textarea" rows="2" />
      </div>

      <!-- Font size -->
      <div class="group">
        <div class="label-row">
          <label class="label">字号</label>
          <span class="value">{{ params.fontSize }}px</span>
        </div>
        <input type="range" min="16" max="120" step="2" v-model.number="params.fontSize" class="slider" />
      </div>

      <!-- Opacity -->
      <div class="group">
        <div class="label-row">
          <label class="label">透明度</label>
          <span class="value">{{ Math.round(params.opacity * 100) }}%</span>
        </div>
        <input type="range" min="5" max="80"
          :value="params.opacity * 100"
          @input="params.opacity = $event.target.value / 100"
          class="slider" />
      </div>

      <!-- Angle -->
      <div class="group">
        <div class="label-row">
          <label class="label">旋转角度</label>
          <span class="value">{{ params.angle }}°</span>
        </div>
        <input type="range" min="-90" max="90" v-model.number="params.angle" class="slider" />
      </div>

      <!-- Density -->
      <div class="group">
        <label class="label">水印密度</label>
        <div class="toggle-group">
          <button v-for="d in densityOptions" :key="d.key"
            :class="['toggle-btn', { active: params.density === d.key }]"
            @click="params.density = d.key">
            {{ d.label }}
          </button>
        </div>
      </div>

      <!-- Color -->
      <div class="group">
        <label class="label">水印颜色</label>
        <div class="toggle-group">
          <button v-for="c in colorOptions" :key="c.key"
            :class="['toggle-btn', 'color-toggle', { active: params.colorKey === c.key }]"
            @click="params.colorKey = c.key">
            <span v-if="c.color" class="dot" :style="{ background: c.color }"></span>
            {{ c.label }}
          </button>
        </div>
        <input v-if="params.colorKey === 'custom'" type="color"
          v-model="params.customColor" class="color-input" />
      </div>
    </div>

    <div class="panel-footer">
      <button class="export-btn" :disabled="!pdfLoaded || exporting" @click="$emit('export')">
        {{ exporting ? '导出中...' : '导出带水印 PDF' }}
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue'
import { loadLocalFont, loadDefaultFont } from '../utils/font.js'

const props = defineProps({
  params: Object,
  pdfLoaded: Boolean,
  exporting: Boolean,
})

const emit = defineEmits(['pdf-loaded', 'export'])

const fontLoading = ref(false)
const fontName = ref('')

const densityOptions = [
  { key: 'sparse', label: '疏' },
  { key: 'normal', label: '中' },
  { key: 'dense', label: '密' },
]

const colorOptions = [
  { key: 'gray', label: '灰', color: '#808080' },
  { key: 'red', label: '红', color: '#c83232' },
  { key: 'blue', label: '蓝', color: '#3232c8' },
  { key: 'custom', label: '自定义', color: null },
]

async function onPdfSelect(e) {
  const file = e.target.files[0]
  if (!file) return

  fontLoading.value = true
  try { await loadDefaultFont() } catch {}
  fontLoading.value = false

  const buf = await file.arrayBuffer()
  emit('pdf-loaded', buf, file.name)
}

async function onFontSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  fontLoading.value = true
  try {
    await loadLocalFont(file)
    fontName.value = file.name
  } catch (err) {
    alert('字体加载失败: ' + err.message)
  } finally {
    fontLoading.value = false
  }
}
</script>

<style scoped>
.panel {
  width: 300px;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  overflow: hidden;
}

.panel-header {
  padding: 24px 20px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h1 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 2px;
}

.subtitle {
  font-size: 13px;
  color: #999;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.panel-footer {
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
}

.group {
  margin-bottom: 16px;
}

.divider {
  border: none;
  border-top: 1px solid #f0f0f0;
  margin: 16px 0;
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: #555;
  display: block;
  margin-bottom: 6px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.label-row .label {
  margin-bottom: 0;
}

.value {
  font-size: 13px;
  color: #4a90d9;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* File buttons */
.file-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-btn.primary {
  background: #4a90d9;
  color: #fff;
}

.file-btn.primary:hover {
  background: #3a7bc8;
}

.file-btn.secondary {
  background: #f5f5f5;
  color: #666;
  border: 1px dashed #d0d0d0;
}

.file-btn.secondary:hover {
  border-color: #4a90d9;
  color: #4a90d9;
}

.file-btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.file-btn-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  font-weight: 700;
  font-size: 14px;
}

.secondary .file-btn-icon {
  background: rgba(0, 0, 0, 0.05);
}

.loading-text {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  display: block;
}

/* Text area */
.textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  resize: vertical;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
}

.textarea:focus {
  border-color: #4a90d9;
  box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.1);
}

/* Slider */
.slider {
  width: 100%;
  height: 6px;
  appearance: none;
  background: #e8e8e8;
  border-radius: 3px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #4a90d9;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

/* Toggle buttons */
.toggle-group {
  display: flex;
  gap: 6px;
}

.toggle-btn {
  flex: 1;
  padding: 6px 0;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.toggle-btn:hover {
  border-color: #4a90d9;
}

.toggle-btn.active {
  background: #4a90d9;
  color: #fff;
  border-color: #4a90d9;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.toggle-btn.active .dot {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
}

.color-input {
  width: 100%;
  height: 32px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 8px;
  padding: 2px;
}

/* Export button */
.export-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #3a7bc8, #2a6ab5);
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.3);
}

.export-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
