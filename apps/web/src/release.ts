import { z } from 'zod'

// The git SHA of this build. CD sets NEXT_PUBLIC_RELEASE at build time and
// Next.js inlines it into the bundle; local builds report `local`.
export const release = z.string().min(1).default('local').parse(process.env.NEXT_PUBLIC_RELEASE)
