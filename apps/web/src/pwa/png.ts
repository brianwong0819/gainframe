import { crc32, deflateSync } from 'node:zlib'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
  color: string
}

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [value >> 16, (value >> 8) & 0xff, value & 0xff]
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

/**
 * Encodes an 8-bit RGB PNG of a flat background with axis-aligned rectangles.
 * Rectangle edges are rounded to whole pixels, so no anti-aliasing is needed.
 */
export function renderPng(
  width: number,
  height: number,
  background: string,
  rects: readonly Rect[],
): Buffer {
  const stride = width * 3 + 1 // each row starts with filter type 0 (none)
  const pixels = Buffer.alloc(stride * height)
  const fill = (y: number, x0: number, x1: number, color: [number, number, number]) => {
    for (let x = x0; x < x1; x++) pixels.set(color, y * stride + 1 + x * 3)
  }

  fill(0, 0, width, rgb(background))
  for (let y = 1; y < height; y++) pixels.copy(pixels, y * stride, 0, stride)

  for (const rect of rects) {
    const color = rgb(rect.color)
    const x0 = Math.max(0, Math.round(rect.x))
    const x1 = Math.min(width, Math.round(rect.x + rect.width))
    const y0 = Math.max(0, Math.round(rect.y))
    const y1 = Math.min(height, Math.round(rect.y + rect.height))
    for (let y = y0; y < y1; y++) fill(y, x0, x1, color)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8) // bit depth 8, colour type RGB, default compression/filter, no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
