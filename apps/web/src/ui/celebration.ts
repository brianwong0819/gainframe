import { animate } from 'motion/react'

import { fade, pop } from './motion'

// The three celebration tiers (docs/design-system.md, "Celebrations"), drawn
// on one canvas over the page: chalk dust around a completed set's check,
// plate fragments with gravity for a record or a finished exercise, and two
// rings pulsing out when a workout ends. Colours come from the tokens. Under
// Reduce Motion nothing is drawn. Adapted from the design prototype
// (docs/design/prototype.html, "celebration fx").

// Particle physics and the timing rules, in seconds and CSS pixels.
export const celebrationTiming = {
  // A completed set's chalk; the rest sheet opens once it has settled.
  chalkS: 0.5,
  // A record's plates and tag; the rest sheet waits for the plates to land.
  recordS: 1.2,
  // How long the "New PR" tag stays before it fades.
  badgeHoldS: 1.1,
  // From the summary appearing to its rings.
  rippleDelayS: 0.3,
} as const

interface Particle {
  kind: 'dust' | 'plate'
  x: number
  y: number
  vx: number
  vy: number
  gravity: number
  drag: number
  size: number
  length: number
  rotation: number
  spin: number
  age: number
  life: number
  alpha: number
  color: string
}

interface Ring {
  x: number
  y: number
  radius: number
  grow: number
  age: number
  delay: number
  life: number
  color: string
}

let canvas: HTMLCanvasElement | null = null
let particles: Particle[] = []
let rings: Ring[] = []
let frame = 0
let last = 0

const random = (min: number, max: number) => min + Math.random() * (max - min)

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function celebrationsOff(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function layer(): CanvasRenderingContext2D | null {
  if (canvas === null) {
    canvas = document.createElement('canvas')
    canvas.className = 'celebration-layer'
    canvas.setAttribute('aria-hidden', 'true')
    document.body.append(canvas)
  }
  const ratio = Math.min(2, window.devicePixelRatio)
  const width = Math.round(window.innerWidth * ratio)
  const height = Math.round(window.innerHeight * ratio)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  return context
}

function centre(element: Element): { x: number; y: number; radius: number } {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2, radius: box.width / 2 }
}

function draw(time: number) {
  const context = layer()
  if (context === null) return
  const dt = Math.min(0.033, (time - (last || time)) / 1000)
  last = time
  context.clearRect(0, 0, window.innerWidth, window.innerHeight)
  particles = particles.filter((particle) => (particle.age += dt) < particle.life)
  rings = rings.filter((ring) => (ring.age += dt) < ring.life + ring.delay)
  for (const particle of particles) {
    const damping = Math.exp(-particle.drag * dt)
    particle.vx *= damping
    particle.vy = particle.vy * damping + particle.gravity * dt
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.rotation += particle.spin * dt
    const progress = particle.age / particle.life
    context.globalAlpha = particle.alpha * (progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4)
    context.fillStyle = particle.color
    context.save()
    context.translate(particle.x, particle.y)
    context.rotate(particle.rotation)
    context.beginPath()
    if (particle.kind === 'dust') {
      context.arc(0, 0, particle.size * (1 + progress * 0.8), 0, Math.PI * 2)
    } else {
      const radius = Math.min(particle.size, particle.length) / 2
      context.roundRect(
        -particle.size / 2,
        -particle.length / 2,
        particle.size,
        particle.length,
        radius,
      )
    }
    context.fill()
    context.restore()
  }
  for (const ring of rings) {
    const progress = Math.max(0, (ring.age - ring.delay) / ring.life)
    if (progress <= 0) continue
    const eased = 1 - (1 - progress) ** 3
    context.globalAlpha = (1 - progress) * 0.9
    context.strokeStyle = ring.color
    context.lineWidth = 6 * (1 - progress) + 0.5
    context.beginPath()
    context.arc(ring.x, ring.y, ring.radius + eased * ring.grow, 0, Math.PI * 2)
    context.stroke()
  }
  context.globalAlpha = 1
  if (particles.length > 0 || rings.length > 0) {
    frame = requestAnimationFrame(draw)
  } else {
    frame = 0
    last = 0
  }
}

function run() {
  if (frame === 0) frame = requestAnimationFrame(draw)
}

// Chalk: a small puff around a completed set's check.
export function chalk(element: Element) {
  if (celebrationsOff()) return
  const { x, y, radius } = centre(element)
  const color = token('--chalk')
  for (let index = 0; index < 16; index += 1) {
    const angle = random(0, Math.PI * 2)
    const speed = random(50, 150)
    particles.push({
      kind: 'dust',
      x: x + Math.cos(angle) * radius * 0.8,
      y: y + Math.sin(angle) * radius * 0.8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20,
      gravity: -30,
      drag: 5,
      size: random(1.6, 4),
      length: 0,
      rotation: 0,
      spin: 0,
      age: 0,
      life: random(0.4, celebrationTiming.chalkS + 0.15),
      alpha: random(0.5, 0.9),
      color,
    })
  }
  run()
}

// Plates: cobalt and ink fragments thrown up and falling back. `power` scales
// the throw (1 for a record, less for a finished exercise).
export function plates(element: Element, count = 18, power = 1) {
  if (celebrationsOff()) return
  const { x, y } = centre(element)
  const colors = [token('--accent'), token('--accent'), token('--ink'), token('--chalk')]
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + random(-1.15, 1.15)
    const speed = random(240, 430) * power
    particles.push({
      kind: 'plate',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 1100,
      drag: 1.4,
      size: random(3, 4.5),
      length: random(9, 15),
      rotation: random(0, Math.PI * 2),
      spin: random(-12, 12),
      age: 0,
      life: random(0.85, 1.25),
      alpha: 1,
      color: colors[index % colors.length] ?? token('--accent'),
    })
  }
  run()
}

// Ripple: two rings pulse out from `element`, then plates.
export function ripple(element: Element) {
  if (celebrationsOff()) return
  const { x, y, radius } = centre(element)
  const color = token('--accent')
  rings.push(
    { x, y, radius, grow: 46, age: 0, delay: 0, life: 0.75, color },
    { x, y, radius, grow: 70, age: 0, delay: 0.12, life: 0.85, color },
  )
  plates(element, 26, 1.1)
}

// The "New PR" tag rising above a record set's check, then fading. `text` is
// already translated.
export function recordBadge(element: Element, text: string) {
  if (celebrationsOff()) return
  const { x, y } = centre(element)
  const badge = document.createElement('div')
  badge.className =
    'record-badge rounded-full bg-accent px-12 py-4 text-label font-semibold text-accent-ink'
  badge.textContent = text
  badge.setAttribute('aria-hidden', 'true')
  document.body.append(badge)
  const half = badge.offsetWidth / 2
  const left = Math.max(half + 16, Math.min(window.innerWidth - half - 16, x)) - half
  badge.style.left = `${String(left)}px`
  badge.style.top = `${String(y - badge.offsetHeight / 2)}px`
  void (async () => {
    await animate(badge, { opacity: [0, 1], scale: [0.6, 1], y: [0, -48] }, pop)
    await animate(badge, { opacity: 0, y: -60 }, { ...fade, delay: celebrationTiming.badgeHoldS })
    badge.remove()
  })()
}
