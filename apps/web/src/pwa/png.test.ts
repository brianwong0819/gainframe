import { inflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { renderPng, ringWithGap, roundedRect } from './png.ts'

// Reads back the IHDR size and the RGB value of one pixel.
function decode(png: Buffer) {
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const idatLength = png.readUInt32BE(33)
  const pixels = inflateSync(png.subarray(41, 41 + idatLength))
  const pixel = (x: number, y: number) => {
    const at = y * (width * 3 + 1) + 1 + x * 3
    return [...pixels.subarray(at, at + 3)]
  }
  return { width, height, pixel }
}

const black = '#000000'
const white = '#ffffff'

describe('renderPng', () => {
  it('writes a PNG of the requested size on the background colour', () => {
    const png = renderPng(4, 3, '#102030', [])
    expect(png.subarray(0, 8)).toEqual(Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'))
    const { width, height, pixel } = decode(png)
    expect([width, height]).toEqual([4, 3])
    expect(pixel(3, 2)).toEqual([0x10, 0x20, 0x30])
  })

  it('fills covered pixels and blends edge pixels by coverage', () => {
    // Covers x 1..2.5: pixel 1 fully, pixel 2 half, pixel 3 not at all.
    const { pixel } = decode(renderPng(4, 1, black, [roundedRect(1, 0, 1.5, 1, 0, white)]))
    expect(pixel(0, 0)).toEqual([0, 0, 0])
    expect(pixel(1, 0)).toEqual([255, 255, 255])
    expect(pixel(2, 0)).toEqual([128, 128, 128])
    expect(pixel(3, 0)).toEqual([0, 0, 0])
  })

  it('clips shapes to the image', () => {
    const { pixel } = decode(renderPng(2, 2, black, [roundedRect(-5, -5, 6, 6, 0, white)]))
    expect(pixel(0, 0)).toEqual([255, 255, 255])
    expect(pixel(1, 1)).toEqual([0, 0, 0])
  })
})

describe('shapes', () => {
  it('rounds the corners of a rectangle', () => {
    const rect = roundedRect(0, 0, 10, 10, 4, white)
    expect(rect.contains(0.2, 0.2)).toBe(false)
    expect(rect.contains(5, 0.2)).toBe(true)
    expect(rect.contains(1.5, 1.5)).toBe(true)
  })

  it('leaves the gap of a ring open, measured counter-clockwise from 3 o’clock', () => {
    const ring = ringWithGap(0, 0, 8, 10, -30, 30, white)
    expect(ring.contains(9, 0)).toBe(false) // 0°, inside the gap
    expect(ring.contains(0, -9)).toBe(true) // 90° (y grows downwards)
    expect(ring.contains(-9, 0)).toBe(true) // 180°
    expect(ring.contains(0, 5)).toBe(false) // inside the hole
  })
})
