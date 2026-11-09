import Link from 'next/link'

import { Chevron } from './chevron'

// The way back from a page below a tab, at the top of the page. Every such
// page has one (docs/design-system.md, "Navigation"; e2e/layout.spec.ts checks).
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      data-back-link
      className="flex items-center gap-4 self-start py-8 text-label text-ink-2"
    >
      <Chevron direction="left" />
      {label}
    </Link>
  )
}
