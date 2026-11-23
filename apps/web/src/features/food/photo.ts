import { type FoodEstimateRequest, FOOD_PHOTO_LONG_EDGE_PX } from '@gainframe/shared'

// The photo the user just chose on the Food tab, handed to the estimate screen
// (/food/photo). Kept in memory only: a reload starts over at the picker.
let pending: Blob | null = null

export function setPendingPhoto(photo: Blob | null): void {
  pending = photo
}

export function pendingPhoto(): Blob | null {
  return pending
}

function readBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('could not read the photo'))
    }
    reader.readAsDataURL(blob)
  })
}

// The photo re-encoded as a JPEG whose long edge is at most
// FOOD_PHOTO_LONG_EDGE_PX, in its upright orientation. Re-encoding drops EXIF
// data such as the location ("Rules" in docs/ai.md).
export type EncodedPhoto = FoodEstimateRequest['photo']

export async function encodePhoto(photo: Blob): Promise<EncodedPhoto> {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' })
  const scale = Math.min(1, FOOD_PHOTO_LONG_EDGE_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) reject(new Error('could not encode the photo'))
        else resolve(blob)
      },
      'image/jpeg',
      0.85,
    )
  })
  return { type: 'image/jpeg', base64: await readBase64(jpeg) }
}
