export type EmoneyTemplate = {
  id: string
  label: string
  crop: { x: number; y: number; w: number; h: number }
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
export const EMONEY_SPRITE_URL = '/emoney/front-templates-4.png'
export const EMONEY_BACK_URL = '/emoney/back-template-info.png'
const CARD_BLUE = '#3967b6'

export const EMONEY_TEMPLATES: EmoneyTemplate[] = [
  { id: 'em1', label: 'Template 1', crop: { x: 20, y: 20, w: 170, h: 318 } },
  { id: 'em2', label: 'Template 2', crop: { x: 220, y: 20, w: 170, h: 318 } },
  { id: 'em3', label: 'Template 3', crop: { x: 20, y: 360, w: 170, h: 318 } },
  { id: 'em4', label: 'Template 4', crop: { x: 220, y: 360, w: 170, h: 318 } }
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
    nameY: 89,
    nameSize: 34,
    photoX: 50,
    photoY: 50,
    photoScale: 100
  }
}

function sanitizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 28)
}

export async function drawEmoneyTemplate(canvas: HTMLCanvasElement, templateId: string) {
  const template = EMONEY_TEMPLATES.find(t => t.id === templateId) || EMONEY_TEMPLATES[0]
  const sprite = await loadImage(EMONEY_SPRITE_URL)
  canvas.width = EMONEY_CANVAS.width
  canvas.height = EMONEY_CANVAS.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas tidak tersedia.')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(sprite, template.crop.x, template.crop.y, template.crop.w, template.crop.h, 0, 0, canvas.width, canvas.height)
  // cover the right-side role text and the original placeholder name/position area
  ctx.fillStyle = CARD_BLUE
  ctx.fillRect(canvas.width * 0.72, canvas.height * 0.02, canvas.width * 0.25, canvas.height * 0.14)
  ctx.fillRect(0, canvas.height * 0.82, canvas.width, canvas.height * 0.18)
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
      const maxH = h * 0.55
      const fitRatio = Math.min(maxW / photo.width, maxH / photo.height)
      const ratio = fitRatio * Math.max(0.35, Math.min(1.8, options.photoScale / 100))
      const drawW = photo.width * ratio
      const drawH = photo.height * ratio
      const drawX = (options.photoX / 100) * w - drawW / 2
      const drawY = (options.photoY / 100) * h - drawH / 2
      ctx.drawImage(photo, drawX, drawY, drawW, drawH)
    } catch {
      // ignore photo render errors and continue with template/name
    }
  }
  const name = sanitizeName(options.customerName || 'Nama Kamu')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${Math.max(20, Math.min(72, options.nameSize))}px Inter, Arial, sans-serif`
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
