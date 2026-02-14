type CompressionOptions = {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  minQuality?: number
  targetBytes?: number
}

const DEFAULTS: Required<CompressionOptions> = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.8,
  minQuality: 0.52,
  targetBytes: 300 * 1024,
}

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to load image.'))
    }
    image.src = objectUrl
  })

const computeSize = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) => {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  quality: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to compress image.'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })

export async function compressImageFile(
  file: File,
  options?: CompressionOptions,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const merged = { ...DEFAULTS, ...(options ?? {}) }
  const image = await loadImage(file)
  const { width, height } = computeSize(
    image.width,
    image.height,
    merged.maxWidth,
    merged.maxHeight,
  )

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return file

  context.drawImage(image, 0, 0, width, height)

  let quality = merged.quality
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > merged.targetBytes && quality > merged.minQuality) {
    quality = Math.max(merged.minQuality, quality - 0.08)
    blob = await canvasToBlob(canvas, quality)
  }

  const baseName = file.name.replace(/\.[^/.]+$/, '')
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

export const toEuro = (value: string | null | undefined) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.includes('€') ? trimmed : `€${trimmed}`
}
