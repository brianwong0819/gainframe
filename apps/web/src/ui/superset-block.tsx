import type { ReactNode } from 'react'

import { Chevron } from './chevron'
import { Pressable } from './pressable'

const headingClass =
  'flex items-center justify-between gap-8 px-8 text-label font-semibold text-accent'

// A superset drawn as one unit: its exercises sit together on an accent-wash
// panel under a heading ("Superset A · alternate"), so the exercises done in
// turn read as one block at a glance, in the workout and in the plan editor.
// With `onEdit`, the heading opens the superset's own settings (its rounds and
// rest), which belong to the whole superset rather than to one exercise.
export function SupersetBlock({
  title,
  detail,
  onEdit,
  children,
}: {
  title: string
  // A second line beside the title, such as the current round or the rest.
  detail?: string
  onEdit?: () => void
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-8 rounded-group bg-accent-wash p-8">
      {onEdit ? (
        <Pressable onClick={onEdit} className={`${headingClass} -mb-4 rounded-ctl py-8 text-left`}>
          <span>{title}</span>
          <span className="flex items-center gap-4 font-normal">
            {detail}
            <Chevron direction="right" />
          </span>
        </Pressable>
      ) : (
        <p className={`${headingClass} pt-4`}>
          <span>{title}</span>
          {detail !== undefined && <span className="font-normal">{detail}</span>}
        </p>
      )}
      {children}
    </section>
  )
}
