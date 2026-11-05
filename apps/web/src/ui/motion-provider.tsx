'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

// With the system's Reduce Motion on, Motion skips transform and layout
// animations and keeps opacity, so only fades remain.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
