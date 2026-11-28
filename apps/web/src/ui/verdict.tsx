import type { ReactNode } from 'react'

// `ok` marks progress toward the goal (`--accent`), `attention` a shortfall the
// user can act on (`--short`), `plain` anything else.
export type VerdictTone = 'ok' | 'attention' | 'plain'

const toneClass: Record<VerdictTone, { dot: string; word: string }> = {
  ok: { dot: 'bg-accent', word: 'text-accent' },
  attention: { dot: 'bg-short', word: 'text-short' },
  plain: { dot: 'bg-ink-3', word: 'text-ink' },
}

// The one-line conclusion under a large number ("Verdict line" in
// docs/design-system.md): a dot and a word in the tone's colour, then the
// figures behind it. The words come from rules, never from a model.
export function Verdict({
  tone,
  word,
  children,
  className = '',
}: {
  tone: VerdictTone
  word: string
  children?: ReactNode
  className?: string
}) {
  const { dot, word: wordClass } = toneClass[tone]
  return (
    <p className={`flex items-baseline gap-8 text-label ${className}`}>
      <span aria-hidden className={`size-8 shrink-0 self-center rounded-full ${dot}`} />
      <span>
        <span className={`font-semibold ${wordClass}`}>{word}</span>
        {children !== undefined && <span className="num text-ink-2"> · {children}</span>}
      </span>
    </p>
  )
}
