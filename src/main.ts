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
  logoDataUrl?: string
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
let logoDataUrl: string | null = null

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

  if (options.logoDataUrl) {
    return drawLogoOnCanvas(canvas, options.logoDataUrl, options.bgColor)
  }

  return Promise.resolve(canvas)
}

function drawLogoOnCanvas(
  canvas: HTMLCanvasElement,
  logoDataUrl: string,
  bgColor: string
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')!
      const logoSize = canvas.width * 0.22
      const x = (canvas.width - logoSize) / 2
      const y = (canvas.height - logoSize) / 2
      const padding = logoSize * 0.12
      const borderRadius = logoSize * 0.1

      ctx.fillStyle = bgColor
      drawRoundedRect(ctx, x - padding, y - padding, logoSize + padding * 2, logoSize + padding * 2, borderRadius)

      ctx.save()
      ctx.beginPath()
      const r = logoSize * 0.08
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + logoSize - r, y)
      ctx.quadraticCurveTo(x + logoSize, y, x + logoSize, y + r)
      ctx.lineTo(x + logoSize, y + logoSize - r)
      ctx.quadraticCurveTo(x + logoSize, y + logoSize, x + logoSize - r, y + logoSize)
      ctx.lineTo(x + r, y + logoSize)
      ctx.quadraticCurveTo(x, y + logoSize, x, y + logoSize - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(img, x, y, logoSize, logoSize)
      ctx.restore()

      resolve(canvas)
    }
    img.onerror = () => resolve(canvas)
    img.src = logoDataUrl
  })
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
  let ecLevel = (document.getElementById('opt-ec') as HTMLSelectElement).value as 'L' | 'M' | 'Q' | 'H'
  if (logoDataUrl && ecLevel !== 'H') {
    ecLevel = 'H'
  }
  return {
    width: parseInt((document.getElementById('opt-width') as HTMLSelectElement).value) || 256,
    margin: parseInt((document.getElementById('opt-margin') as HTMLInputElement).value) ?? 2,
    fgColor: (document.getElementById('opt-fg') as HTMLInputElement).value || '#000000',
    bgColor: (document.getElementById('opt-bg') as HTMLInputElement).value || '#ffffff',
    ecLevel,
    dotStyle: (document.querySelector('.style-option.active') as HTMLElement)?.dataset.style as DotStyle || 'square',
    logoDataUrl: logoDataUrl || undefined,
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

function extractNameFromUrl(text: string): string | null {
  try {
    const url = new URL(text)
    return url.searchParams.get('name')
  } catch {
    return null
  }
}

function getFileName(text: string, index: number): string {
  return extractNameFromUrl(text) || `qrcode_${index + 1}`
}

function downloadSingle(index: number) {
  const item = qrItems[index]
  if (!item) return
  const link = document.createElement('a')
  link.download = `${getFileName(item.text, index)}.png`
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
      zip.file(`${getFileName(item.text, i)}.png`, base64, { base64: true })
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
              <label>尺寸</label>
              <select id="opt-width">
                <option value="128">128 × 128</option>
                <option value="256" selected>256 × 256（推荐）</option>
                <option value="512">512 × 512</option>
                <option value="768">768 × 768</option>
                <option value="1024">1024 × 1024</option>
              </select>
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
              <label>中心Logo</label>
              <div class="logo-upload" id="logo-upload">
                <input type="file" id="logo-file" accept="image/*" hidden>
                <div class="logo-upload-placeholder" id="logo-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24"><path d="M12 5v14M5 12h14"/></svg>
                  <span>点击上传Logo</span>
                </div>
                <div class="logo-upload-preview" id="logo-preview" style="display:none">
                  <img id="logo-preview-img" alt="Logo预览">
                  <button class="logo-remove" id="logo-remove" title="移除Logo">&times;</button>
                </div>
              </div>
              <div class="logo-hint" id="logo-hint" style="display:none">已启用Logo，容错级别自动设为H</div>
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

  document.getElementById('logo-upload')!.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'logo-remove' || (e.target as HTMLElement).closest('.logo-remove')) return
    document.getElementById('logo-file')!.click()
  })

  document.getElementById('logo-file')!.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      logoDataUrl = ev.target?.result as string
      const previewImg = document.getElementById('logo-preview-img') as HTMLImageElement
      previewImg.src = logoDataUrl
      document.getElementById('logo-placeholder')!.style.display = 'none'
      document.getElementById('logo-preview')!.style.display = 'flex'
      document.getElementById('logo-hint')!.style.display = 'block'
      const ecSelect = document.getElementById('opt-ec') as HTMLSelectElement
      ecSelect.value = 'H'
      ecSelect.disabled = true
    }
    reader.readAsDataURL(file)
  })

  document.getElementById('logo-remove')!.addEventListener('click', (e) => {
    e.stopPropagation()
    logoDataUrl = null
    ;(document.getElementById('logo-file') as HTMLInputElement).value = ''
    document.getElementById('logo-placeholder')!.style.display = 'flex'
    document.getElementById('logo-preview')!.style.display = 'none'
    document.getElementById('logo-hint')!.style.display = 'none'
    const ecSelect = document.getElementById('opt-ec') as HTMLSelectElement
    ecSelect.disabled = false
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
