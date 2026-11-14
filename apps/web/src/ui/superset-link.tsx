import { Pressable } from './pressable'

// The toggle between two exercises in a list: pressed, they form a superset
// (or belong to the same one); a tap joins them or splits the superset there.
// Linked, it shows in the accent wash, so a run of linked cards stands out.
// `label` names both exercises for screen readers.
export function SupersetLink({
  linked,
  text,
  label,
  onToggle,
}: {
  linked: boolean
  text: string
  label: string
  onToggle: (linked: boolean) => void
}) {
  return (
    <div className="flex justify-center py-4">
      <Pressable
        aria-pressed={linked}
        aria-label={label}
        onClick={() => {
          onToggle(linked)
        }}
        className={`flex items-center gap-4 rounded-full px-12 py-8 text-label ${
          linked ? 'bg-accent-wash font-semibold text-accent' : 'text-ink-3'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-16 fill-none stroke-current"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
        </svg>
        {text}
      </Pressable>
    </div>
  )
}
