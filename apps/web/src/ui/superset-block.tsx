import type { ReactNode } from 'react'

// A superset drawn as one unit: its exercises sit together on an accent-wash
// panel under a heading ("Superset A · alternate"), so the exercises done in
// turn read as one block at a glance, in the workout and in the plan editor.
export function SupersetBlock({
  title,
  detail,
  children,
}: {
  title: string
  // A second line beside the title, such as the current round.
  detail?: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-8 rounded-group bg-accent-wash p-8">
      <p className="flex items-center justify-between gap-8 px-8 pt-4 text-label font-semibold text-accent">
        <span>{title}</span>
        {detail !== undefined && <span className="font-normal">{detail}</span>}
      </p>
      {children}
    </section>
  )
}
