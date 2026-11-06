import { renderPng, ring, roundedRect, type Shape } from './png.ts'
import type { SchemeColors, ThemeColors } from './theme-colors.ts'

// The app icon and the iOS splash screens. scripts/pwa-images.ts renders them
// into public/pwa/ before `next dev` and `next build`; they are not committed.

export const pwaImageDir = 'pwa'

// The mark: a G with a barbell through it. Sizes are in units from the
// centre; the mark spans 770 units, the length of the bar.
const markSpan = 770

// Plates on each side of the G, from the inside out: offset, width, height,
// corner radius and whether the plate takes the accent colour.
const plates = [
  { at: 282, width: 44, height: 300, radius: 14, accent: true },
  { at: 329, width: 34, height: 210, radius: 12, accent: true },
  { at: 365, width: 22, height: 70, radius: 8, accent: false },
] as const

function mark(canvasWidth: number, canvasHeight: number, markWidth: number, colors: SchemeColors) {
  const k = markWidth / markSpan
  const [cx, cy] = [canvasWidth / 2, canvasHeight / 2]
  const centred = (x: number, width: number, height: number, radius: number, color: string) =>
    roundedRect(
      cx + (x - width / 2) * k,
      cy - (height / 2) * k,
      width * k,
      height * k,
      radius * k,
      color,
    )
  return [
    centred(0, 770, 18, 9, colors.ink2),
    ...plates.flatMap(({ at, width, height, radius, accent }) =>
      [-at, at].map((x) => centred(x, width, height, radius, accent ? colors.accent : colors.ink2)),
    ),
    // The G: a ring open from 0° to 40°, and its crossbar from the centre out.
    ring(cx, cy, 166 * k, 234 * k, colors.ink, { from: 40, to: 360 }),
    centred(117, 234, 68, 0, colors.ink),
  ] satisfies Shape[]
}

// Home-screen and manifest icons, on a soft gradient from the surface colour.
// The mark stays inside the safe zone of a maskable icon (the central circle,
// 80% of the width), so one image serves both purposes.
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
      png: renderPng(
        size,
        size,
        { top: colors.dark.surface, bottom: colors.dark.bg },
        mark(size, size, size * 0.68, colors.dark),
      ),
    }
  }
  for (const { width, height, ratio, scheme, file } of splashScreens) {
    const [w, h] = [width * ratio, height * ratio]
    const palette = colors[scheme]
    yield { file, png: renderPng(w, h, palette.bg, mark(w, h, w * 0.42, palette)) }
  }
}
