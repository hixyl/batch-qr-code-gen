import './style.css'
import QRCode from 'qrcode'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

type DotStyle = 'square' | 'rounded' | 'dots' | 'classy' | 'classy-rounded'

interface QrOptions {
  width: number
  margin: number
  fgColor: string
  bgColor: string
  ecLevel: 'L' | 'M' | 'Q' | 'H'
  dotStyle: DotStyle
}

interface QrItem {
  text: string
  canvas: HTMLCanvasElement
  dataUrl: string
}

const DEFAULT_OPTIONS: QrOptions = {
  width: 256,
  margin: 4,
  fgColor: '#000000',
  bgColor: '#ffffff',
  ecLevel: 'M',
  dotStyle: 'square',
}

let qrItems: QrItem[] = []
let currentOptions: QrOptions = { ...DEFAULT_OPTIONS }

function renderQrToCanvas(text: string, options: QrOptions): Promise<HTMLCanvasElement> {
  const qrData = QRCode.create(text, { errorCorrectionLevel: options.ecLevel })
  const modules = qrData.modules
  const moduleCount = modules.size
  const marginPx = options.margin * Math.floor(options.width / moduleCount)
  const cellSize = Math.floor((options.width - marginPx * 2) / moduleCount)
  const actualSize = cellSize * moduleCount + marginPx * 2

  const canvas = document.createElement('canvas')
  canvas.width = actualSize
  canvas.height = actualSize
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = options.bgColor
  ctx.fillRect(0, 0, actualSize, actualSize)

  ctx.fillStyle = options.fgColor

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules.data[row * moduleCount + col]) {
        const x = marginPx + col * cellSize
        const y = marginPx + row * cellSize
        drawModule(ctx, x, y, cellSize, options.dotStyle, row, col, moduleCount, modules)
      }
    }
  }

  return Promise.resolve(canvas)
}

function drawModule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  style: DotStyle,
  row: number,
  col: number,
  moduleCount: number,
  modules: { data: Uint8Array; size: number }
) {
  const isFinderPattern =
    (row < 7 && col < 7) ||
    (row < 7 && col >= moduleCount - 7) ||
    (row >= moduleCount - 7 && col < 7)

  switch (style) {
    case 'square':
      ctx.fillRect(x, y, size, size)
      break

    case 'rounded': {
      const r = size * 0.35
      if (isFinderPattern) {
        ctx.fillRect(x, y, size, size)
      } else {
        drawRoundedRect(ctx, x, y, size, size, r)
      }
      break
    }

    case 'dots': {
      if (isFinderPattern) {
        ctx.fillRect(x, y, size, size)
      } else {
        const cx = x + size / 2
        const cy = y + size / 2
        const radius = size * 0.42
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }

    case 'classy': {
      if (isFinderPattern) {
        ctx.fillRect(x, y, size, size)
      } else {
        const right = modules.data[row * moduleCount + col + 1]
        const bottom = modules.data[(row + 1) * moduleCount + col]
        ctx.fillRect(x, y, size, size)
        if (!right && !bottom) {
          const r = size * 0.5
          ctx.fillStyle = getBgColor()
          ctx.beginPath()
          ctx.arc(x + size, y + size, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = getFgColor()
        }
      }
      break
    }

    case 'classy-rounded': {
      if (isFinderPattern) {
        const r = size * 0.3
        drawRoundedRect(ctx, x, y, size, size, r)
      } else {
        const r = size * 0.4
        drawRoundedRect(ctx, x, y, size, size, r)
      }
      break
    }

    default:
      ctx.fillRect(x, y, size, size)
  }
}

function getBgColor(): string {
  return currentOptions.bgColor
}

function getFgColor(): string {
  return currentOptions.fgColor
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function showToast(message: string) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  document.body.appendChild(toast)

  requestAnimationFrame(() => {
    toast.classList.add('show')
  })

  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}

function showLoading() {
  const overlay = document.createElement('div')
  overlay.className = 'loading-overlay'
  overlay.id = 'loading-overlay'
  overlay.innerHTML = '<div class="loading-spinner"></div>'
  document.body.appendChild(overlay)
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay')
  if (overlay) overlay.remove()
}

async function generateQrCodes() {
  const textarea = document.getElementById('qr-input') as HTMLTextAreaElement
  const text = textarea.value.trim()

  if (!text) {
    showToast('请输入文本或链接')
    return
  }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    showToast('请输入文本或链接')
    return
  }

  currentOptions = readOptions()
  qrItems = []

  for (const line of lines) {
    const canvas = await renderQrToCanvas(line, currentOptions)
    const dataUrl = canvas.toDataURL('image/png')
    qrItems.push({ text: line, canvas, dataUrl })
  }

  renderQrGrid()
  showToast(`已生成 ${qrItems.length} 个二维码`)
}

function readOptions(): QrOptions {
  return {
    width: parseInt((document.getElementById('opt-width') as HTMLInputElement).value) || 256,
    margin: parseInt((document.getElementById('opt-margin') as HTMLInputElement).value) ?? 2,
    fgColor: (document.getElementById('opt-fg') as HTMLInputElement).value || '#000000',
    bgColor: (document.getElementById('opt-bg') as HTMLInputElement).value || '#ffffff',
    ecLevel: (document.getElementById('opt-ec') as HTMLSelectElement).value as 'L' | 'M' | 'Q' | 'H',
    dotStyle: (document.querySelector('.style-option.active') as HTMLElement)?.dataset.style as DotStyle || 'square',
  }
}

function renderQrGrid() {
  const container = document.getElementById('qr-results')!
  const countEl = document.getElementById('qr-count')!

  if (qrItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="3" height="3"/>
          <rect x="18" y="18" width="3" height="3"/>
          <rect x="18" y="14" width="3" height="1"/>
          <rect x="14" y="18" width="1" height="3"/>
        </svg>
        <p>输入文本后点击生成，二维码将显示在这里</p>
      </div>
    `
    countEl.textContent = ''
    return
  }

  countEl.textContent = `共 ${qrItems.length} 个`

  container.innerHTML = qrItems
    .map(
      (item, i) => `
    <div class="qr-item" data-index="${i}">
      <div class="qr-item-index">
        <span class="index-badge">${i + 1}</span>
        <span style="font-size:11px;color:var(--text-secondary)">${item.text.length > 30 ? item.text.slice(0, 30) + '…' : item.text}</span>
      </div>
      <div class="qr-item-canvas" id="qr-canvas-${i}"></div>
      <div class="qr-item-text" title="${escapeHtml(item.text)}">${escapeHtml(item.text)}</div>
      <div class="qr-item-actions">
        <button class="btn btn-secondary" onclick="window._downloadSingle(${i})">下载</button>
        <button class="btn btn-secondary" onclick="window._copySingle(${i})">复制</button>
      </div>
    </div>
  `
    )
    .join('')

  qrItems.forEach((item, i) => {
    const canvasContainer = document.getElementById(`qr-canvas-${i}`)!
    const displayCanvas = document.createElement('canvas')
    const maxDisplaySize = 168
    const scale = maxDisplaySize / item.canvas.width
    displayCanvas.width = item.canvas.width * scale
    displayCanvas.height = item.canvas.height * scale
    const ctx = displayCanvas.getContext('2d')!
    ctx.drawImage(item.canvas, 0, 0, displayCanvas.width, displayCanvas.height)
    canvasContainer.appendChild(displayCanvas)
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function downloadSingle(index: number) {
  const item = qrItems[index]
  if (!item) return
  const link = document.createElement('a')
  link.download = `qrcode_${index + 1}.png`
  link.href = item.dataUrl
  link.click()
  showToast(`已下载二维码 #${index + 1}`)
}

async function copySingle(index: number) {
  const item = qrItems[index]
  if (!item) return

  try {
    const blob = await new Promise<Blob>((resolve) => {
      item.canvas.toBlob((b) => resolve(b!), 'image/png')
    })
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    showToast(`已复制二维码 #${index + 1}`)
  } catch {
    showToast('复制失败，请尝试下载')
  }
}

async function downloadAll() {
  if (qrItems.length === 0) {
    showToast('没有可下载的二维码')
    return
  }

  showLoading()

  try {
    const zip = new JSZip()
    qrItems.forEach((item, i) => {
      const base64 = item.dataUrl.split(',')[1]
      zip.file(`qrcode_${i + 1}.png`, base64, { base64: true })
    })

    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, `qrcodes_${Date.now()}.zip`)
    showToast(`已打包下载 ${qrItems.length} 个二维码`)
  } catch {
    showToast('打包下载失败')
  } finally {
    hideLoading()
  }
}

function clearAll() {
  const textarea = document.getElementById('qr-input') as HTMLTextAreaElement
  textarea.value = ''
  qrItems = []
  renderQrGrid()
  showToast('已清空')
}

function setDotStyle(style: DotStyle) {
  document.querySelectorAll('.style-option').forEach((el) => {
    el.classList.toggle('active', (el as HTMLElement).dataset.style === style)
  })
}

function init() {
  const app = document.getElementById('app')!

  app.innerHTML = `
    <header>
      <h1>批量二维码生成器</h1>
      <p>输入文本或链接，每行一个，批量生成二维码并打包下载</p>
    </header>

    <div class="main-layout">
      <div class="sidebar">
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            📝 输入内容
          </div>
          <div class="card-body">
            <textarea id="qr-input" placeholder="每行输入一个文本或链接，例如：&#10;https://example.com&#10;https://github.com&#10;Hello World"></textarea>
            <div class="actions-bar">
              <button class="btn btn-primary btn-full" id="btn-generate">生成二维码</button>
            </div>
            <div class="actions-bar">
              <button class="btn btn-secondary" id="btn-clear" style="flex:1">清空</button>
              <button class="btn btn-success" id="btn-download-all" style="flex:1">📦 打包下载</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            🎨 样式设置
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>尺寸 (px)</label>
              <input type="number" id="opt-width" value="256" min="64" max="2048" step="32">
            </div>

            <div class="form-group">
              <label>边距（模块）</label>
              <input type="number" id="opt-margin" value="4" min="0" max="10">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>前景色</label>
                <input type="color" id="opt-fg" value="#000000">
              </div>
              <div class="form-group">
                <label>背景色</label>
                <input type="color" id="opt-bg" value="#ffffff">
              </div>
            </div>

            <div class="form-group">
              <label>容错级别</label>
              <select id="opt-ec">
                <option value="L">L - 低 (7%)</option>
                <option value="M" selected>M - 中 (15%)</option>
                <option value="Q">Q - 较高 (25%)</option>
                <option value="H">H - 高 (30%)</option>
              </select>
            </div>

            <div class="form-group">
              <label>点阵样式</label>
              <div class="style-preview">
                <div class="style-option active" data-style="square">方块</div>
                <div class="style-option" data-style="rounded">圆角</div>
                <div class="style-option" data-style="dots">圆点</div>
                <div class="style-option" data-style="classy-rounded">优雅</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="download-bar">
          <span id="qr-count" class="count"></span>
        </div>
        <div class="qr-grid" id="qr-results">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="3" height="3"/>
              <rect x="18" y="18" width="3" height="3"/>
              <rect x="18" y="14" width="3" height="1"/>
              <rect x="14" y="18" width="1" height="3"/>
            </svg>
            <p>输入文本后点击生成，二维码将显示在这里</p>
          </div>
        </div>
      </div>
    </div>
  `

  document.getElementById('btn-generate')!.addEventListener('click', generateQrCodes)
  document.getElementById('btn-clear')!.addEventListener('click', clearAll)
  document.getElementById('btn-download-all')!.addEventListener('click', downloadAll)

  document.querySelectorAll('.style-option').forEach((el) => {
    el.addEventListener('click', () => {
      setDotStyle((el as HTMLElement).dataset.style as DotStyle)
    })
  })

  document.getElementById('qr-input')!.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).ctrlKey || (e as KeyboardEvent).metaKey) {
      if ((e as KeyboardEvent).key === 'Enter') {
        e.preventDefault()
        generateQrCodes()
      }
    }
  })

  window._downloadSingle = downloadSingle
  window._copySingle = copySingle
}

declare global {
  interface Window {
    _downloadSingle: (index: number) => void
    _copySingle: (index: number) => void
  }
}

init()
