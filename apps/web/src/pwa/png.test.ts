import { inflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { renderPng } from './png.ts'

// Reads back the IHDR size and the RGB value of one pixel.
function decode(png: Buffer) {
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const idatLength = png.readUInt32BE(33)
  const pixels = inflateSync(png.subarray(41, 41 + idatLength))
  const pixel = (x: number, y: number) => [
    ...pixels.subarray(y * (width * 3 + 1) + 1 + x * 3, y * (width * 3 + 1) + 4 + x * 3),
  ]
  return { width, height, pixel }
}

describe('renderPng', () => {
  const png = renderPng(4, 3, '#102030', [
    { x: 0.6, y: 1.2, width: 2, height: 5, color: '#ff8000' },
  ])

  it('writes a PNG of the requested size', () => {
    expect(png.subarray(0, 8)).toEqual(Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'))
    expect(decode(png)).toMatchObject({ width: 4, height: 3 })
  })

  it('paints rectangles on the background, rounded to whole pixels and clipped', () => {
    const { pixel } = decode(png)
    expect(pixel(0, 0)).toEqual([0x10, 0x20, 0x30])
    expect(pixel(0, 1)).toEqual([0x10, 0x20, 0x30])
    expect(pixel(1, 1)).toEqual([0xff, 0x80, 0x00])
    expect(pixel(2, 2)).toEqual([0xff, 0x80, 0x00])
    expect(pixel(3, 2)).toEqual([0x10, 0x20, 0x30])
  })
})
