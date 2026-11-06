import { devices } from '@playwright/test'

/** Safe-area insets in CSS pixels, as iOS reports them in portrait. */
export interface SafeArea {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * The device matrix for the layout tests. The app runs as an installed PWA, so
 * the viewport is the whole screen (Playwright's descriptors describe Safari
 * with its toolbars). Insets assume content runs under the status bar
 * (`viewport-fit=cover`), the case globals.css pads for.
 *
 * Android: an installed Chrome PWA draws the status and navigation bars outside
 * the page, so the insets are 0 and the descriptor's viewport is kept.
 */
export const deviceMatrix = [
  {
    // Smallest supported iPhone, home button, no notch.
    name: 'iPhone SE',
    descriptor: devices['iPhone SE (3rd gen)'],
    viewport: { width: 375, height: 667 },
    safeArea: { top: 20, right: 0, bottom: 0, left: 0 },
  },
  {
    // The reference size in docs/design-system.md (notch).
    name: 'iPhone 17e',
    descriptor: devices['iPhone 17e'],
    viewport: { width: 390, height: 844 },
    safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
  },
  {
    name: 'iPhone 17',
    descriptor: devices['iPhone 17'],
    viewport: { width: 402, height: 874 },
    safeArea: { top: 62, right: 0, bottom: 34, left: 0 },
  },
  {
    name: 'iPhone 17 Pro Max',
    descriptor: devices['iPhone 17 Pro Max'],
    viewport: { width: 440, height: 956 },
    safeArea: { top: 62, right: 0, bottom: 34, left: 0 },
  },
  {
    name: 'Pixel 7',
    descriptor: devices['Pixel 7'],
    viewport: devices['Pixel 7'].viewport,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  {
    // Narrowest common Android width.
    name: 'Galaxy S24',
    descriptor: devices['Galaxy S24'],
    viewport: devices['Galaxy S24'].viewport,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  },
] satisfies {
  name: string
  descriptor: (typeof devices)[string]
  viewport: { width: number; height: number }
  safeArea: SafeArea
}[]
