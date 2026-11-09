// The prototype's outlined chevron, drawn in the current text colour.
export function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`size-16 shrink-0 fill-none stroke-current ${direction === 'left' ? 'rotate-180' : ''}`}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
