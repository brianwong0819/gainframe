import { crc32, deflateSync } from 'node:zlib'

/** A filled region: its bounding box and a point-in-shape test, in pixels. */
export interface Shape {
  bounds: { left: number; top: number; right: number; bottom: number }
  contains: (x: number, y: number) => boolean
  color: string
}

const SAMPLES = 4 // per axis: 16 samples per pixel give smooth edges

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
 * Encodes an 8-bit RGB PNG of a flat background with shapes painted in order.
 * Each pixel inside a shape's bounds is blended by the share of its 4 x 4
 * sub-samples the shape contains, which anti-aliases curves and diagonals.
 */
export function renderPng(
  width: number,
  height: number,
  background: string,
  shapes: readonly Shape[],
): Buffer {
  const stride = width * 3 + 1 // each row starts with filter type 0 (none)
  const pixels = Buffer.alloc(stride * height)
  const bg = rgb(background)
  for (let x = 0; x < width; x++) pixels.set(bg, 1 + x * 3)
  for (let y = 1; y < height; y++) pixels.copy(pixels, y * stride, 0, stride)

  for (const { bounds, contains, color } of shapes) {
    const fill = rgb(color)
    const x0 = Math.max(0, Math.floor(bounds.left))
    const x1 = Math.min(width, Math.ceil(bounds.right))
    const y0 = Math.max(0, Math.floor(bounds.top))
    const y1 = Math.min(height, Math.ceil(bounds.bottom))
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        let hits = 0
        for (let sy = 0; sy < SAMPLES; sy++) {
          for (let sx = 0; sx < SAMPLES; sx++) {
            if (contains(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES)) hits++
          }
        }
        if (hits === 0) continue
        const alpha = hits / (SAMPLES * SAMPLES)
        const at = y * stride + 1 + x * 3
        for (let c = 0; c < 3; c++) {
          const under = pixels[at + c] ?? 0
          pixels[at + c] = Math.round(under + ((fill[c] ?? 0) - under) * alpha)
        }
      }
    }
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

/** An axis-aligned rectangle with rounded corners. */
export function roundedRect(
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
  color: string,
): Shape {
  const [cx, cy] = [left + width / 2, top + height / 2]
  const [hx, hy] = [width / 2 - radius, height / 2 - radius]
  return {
    bounds: { left, top, right: left + width, bottom: top + height },
    contains: (x, y) => {
      const dx = Math.max(Math.abs(x - cx) - hx, 0)
      const dy = Math.max(Math.abs(y - cy) - hy, 0)
      return dx * dx + dy * dy <= radius * radius
    },
    color,
  }
}

/**
 * A ring between two radii with an open gap. Angles are in degrees, measured
 * counter-clockwise from 3 o'clock; the gap runs from `gapFrom` up to `gapTo`.
 */
export function ringWithGap(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  gapFrom: number,
  gapTo: number,
  color: string,
): Shape {
  return {
    bounds: { left: cx - outer, top: cy - outer, right: cx + outer, bottom: cy + outer },
    contains: (x, y) => {
      const distance = Math.hypot(x - cx, y - cy)
      if (distance < inner || distance > outer) return false
      const angle = (Math.atan2(cy - y, x - cx) * 180) / Math.PI
      return angle < gapFrom || angle > gapTo
    },
    color,
  }
}
