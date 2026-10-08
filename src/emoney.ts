export type EmoneyTemplate = {
  id: string
  label: string
  src: string
}

export type EmoneyCustomization = {
  type: 'emoney_card'
  templateId: string
  templateLabel: string
  customerName: string
  nameX: number
  nameY: number
  nameSize: number
  photoX: number
  photoY: number
  photoScale: number
  previewDataUrl: string
}

export const EMONEY_CANVAS = { width: 540, height: 855 }
export const EMONEY_BACK_URL = '/emoney/back-template-info.png'
const NAME_BAR_COLOR = '#3b69b4'
const NAME_BAR_TOP = 0.855

export const EMONEY_TEMPLATES: EmoneyTemplate[] = [
  { id: 'em1', label: 'Template 1', src: '/emoney/templates/template-1.png' },
  { id: 'em2', label: 'Template 2', src: '/emoney/templates/template-2.png' },
  { id: 'em3', label: 'Template 3', src: '/emoney/templates/template-3.png' },
  { id: 'em4', label: 'Template 4', src: '/emoney/templates/template-4.png' }
]

const imageCache = new Map<string, Promise<HTMLImageElement>>()

function loadImage(src: string) {
  let pending = imageCache.get(src)
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Gagal memuat gambar: ${src}`))
      img.src = src
    })
    imageCache.set(src, pending)
  }
  return pending
}

export function defaultEmoneyCustomization(templateId = EMONEY_TEMPLATES[0]?.id || 'em1'): Omit<EmoneyCustomization, 'previewDataUrl' | 'customerName' | 'templateLabel'> & { customerName: string; templateLabel: string } {
  const template = EMONEY_TEMPLATES.find(t => t.id === templateId) || EMONEY_TEMPLATES[0]
  return {
    type: 'emoney_card',
    templateId: template.id,
    templateLabel: template.label,
    customerName: '',
    nameX: 50,
    nameY: 92.5,
    nameSize: 34,
    photoX: 50,
    photoY: 52,
    photoScale: 100
  }
}

function sanitizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 28)
}

function resolveTemplate(templateId: string) {
  return EMONEY_TEMPLATES.find(t => t.id === templateId) || EMONEY_TEMPLATES[0]
}

export async function drawEmoneyBaseTemplate(canvas: HTMLCanvasElement, templateId: string) {
  const template = resolveTemplate(templateId)
  const artwork = await loadImage(template.src)
  canvas.width = EMONEY_CANVAS.width
  canvas.height = EMONEY_CANVAS.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas tidak tersedia.')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(artwork, 0, 0, artwork.width, artwork.height, 0, 0, canvas.width, canvas.height)
  return ctx
}

export async function drawEmoneyTemplate(canvas: HTMLCanvasElement, templateId: string) {
  const ctx = await drawEmoneyBaseTemplate(canvas, templateId)
  const nameBarY = Math.round(canvas.height * NAME_BAR_TOP)
  ctx.fillStyle = NAME_BAR_COLOR
  ctx.fillRect(0, nameBarY, canvas.width, canvas.height - nameBarY)
  return ctx
}

export async function renderEmoneyPreview(options: {
  templateId: string
  customerName: string
  photoDataUrl?: string | null
  nameX: number
  nameY: number
  nameSize: number
  photoX: number
  photoY: number
  photoScale: number
  canvas: HTMLCanvasElement
}) {
  const ctx = await drawEmoneyTemplate(options.canvas, options.templateId)
  const w = options.canvas.width
  const h = options.canvas.height

  if (options.photoDataUrl) {
    try {
      const photo = await loadImage(options.photoDataUrl)
      const maxW = w * 0.72
      const maxH = h * 0.56
      const fitRatio = Math.min(maxW / photo.width, maxH / photo.height)
      const ratio = fitRatio * Math.max(0.35, Math.min(1.8, options.photoScale / 100))
      const drawW = photo.width * ratio
      const drawH = photo.height * ratio
      const drawX = (options.photoX / 100) * w - drawW / 2
      const drawY = (options.photoY / 100) * h - drawH / 2
      ctx.drawImage(photo, drawX, drawY, drawW, drawH)
    } catch {
      // lanjutkan walau foto gagal dirender
    }
  }

  const name = sanitizeName(options.customerName || 'Nama Lengkap')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${Math.max(20, Math.min(72, options.nameSize))}px Inter, Arial, sans-serif`
  ctx.fillText(name, (options.nameX / 100) * w, (options.nameY / 100) * h, w * 0.88)
}

export async function renderEmoneyDataUrl(options: {
  templateId: string
  customerName: string
  photoDataUrl?: string | null
  nameX: number
  nameY: number
  nameSize: number
  photoX: number
  photoY: number
  photoScale: number
}) {
  const canvas = document.createElement('canvas')
  await renderEmoneyPreview({ ...options, canvas })
  return canvas.toDataURL('image/png')
}
