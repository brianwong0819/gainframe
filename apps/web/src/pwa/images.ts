import { renderPng, ringWithGap, roundedRect, type Shape } from './png.ts'
import type { SchemeColors, ThemeColors } from './theme-colors.ts'

// The app icon and the iOS splash screens. scripts/pwa-images.ts renders them
// into public/pwa/ before `next dev` and `next build`; they are not committed.

export const pwaImageDir = 'pwa'

// The mark: a "G" drawn as an open ring whose crossbar is a dumbbell in the
// accent colour. Coordinates are on a 1024 grid centred on (512, 512); the
// mark spans 540 units across.
const markSpan = 540

function mark(canvasWidth: number, canvasHeight: number, markWidth: number, colors: SchemeColors) {
  const k = markWidth / markSpan
  const at = (x: number, y: number) =>
    [canvasWidth / 2 + (x - 512) * k, canvasHeight / 2 + (y - 512) * k] as const
  const rect = (x: number, y: number, w: number, h: number, r: number, color: string) => {
    const [left, top] = at(x, y)
    return roundedRect(left, top, w * k, h * k, r * k, color)
  }
  const [cx, cy] = at(490, 512)
  return [
    ringWithGap(cx, cy, 192 * k, 248 * k, -38, 30, colors.ink),
    rect(530, 496, 220, 32, 8, colors.accent),
    rect(514, 427, 52, 170, 20, colors.accent),
    rect(730, 427, 52, 170, 20, colors.accent),
  ] satisfies Shape[]
}

// Home-screen and manifest icons. The mark fills just over half the width,
// inside the safe zone of a maskable icon, so one image serves both purposes.
const icons = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
] as const

// iOS shows a startup image only when its media query matches the device
// exactly, so each portrait screen size needs its own (CSS px, pixel ratio).
const screens = [
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max, 17 Pro Max
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 402, height: 874, ratio: 3 }, // 16 Pro, 17, 17 Pro
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Plus / Pro Max, 16 Plus
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 428, height: 926, ratio: 3 }, // 12 / 13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 16e
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12 / 13 mini
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 375, height: 667, ratio: 2 }, // SE (2nd, 3rd), 8
] as const

const schemes = ['light', 'dark'] as const

const splashScreens = screens.flatMap((screen) =>
  schemes.map((scheme) => ({
    ...screen,
    scheme,
    file: `splash-${String(screen.width * screen.ratio)}x${String(screen.height * screen.ratio)}-${scheme}.png`,
  })),
)

export const startupImages = splashScreens.map(({ width, height, ratio, scheme, file }) => ({
  url: `/${pwaImageDir}/${file}`,
  media: `(device-width: ${String(width)}px) and (device-height: ${String(height)}px) and (-webkit-device-pixel-ratio: ${String(ratio)}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})`,
}))

export function* renderPwaImages(colors: ThemeColors): Generator<{ file: string; png: Buffer }> {
  for (const { file, size } of icons) {
    yield {
      file,
      png: renderPng(size, size, colors.dark.bg, mark(size, size, size * 0.53, colors.dark)),
    }
  }
  for (const { width, height, ratio, scheme, file } of splashScreens) {
    const [w, h] = [width * ratio, height * ratio]
    const palette = colors[scheme]
    yield { file, png: renderPng(w, h, palette.bg, mark(w, h, w / 4, palette)) }
  }
}
