'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'

import { PressableLink } from '@/ui/pressable'

// Icons from the prototype: outlined, with a filled part that pops in when
// the tab is selected (`.tab-fill` in globals.css).
function TodayIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8.25" />
      <circle className="tab-fill" cx="12" cy="12" r="4.25" />
    </svg>
  )
}

function WorkoutIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M2.5 12h19" />
      <rect x="5" y="7" width="3" height="10" rx="1" />
      <rect x="16" y="7" width="3" height="10" rx="1" />
      <rect className="tab-fill" x="5" y="7" width="3" height="10" rx="1" />
      <rect className="tab-fill" x="16" y="7" width="3" height="10" rx="1" />
    </svg>
  )
}

function FoodIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" />
      <path className="tab-fill" d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" />
      <path d="M9 8.5c-.8-1 .8-2 0-3.5M13 8.5c-.8-1 .8-2 0-3.5" />
    </svg>
  )
}

const tabs = [
  { href: '/', label: 'today', Icon: TodayIcon },
  { href: '/workout', label: 'workout', Icon: WorkoutIcon },
  { href: '/food', label: 'food', Icon: FoodIcon },
] as const

export function TabBar() {
  const t = useTranslations('tabs')
  // CloudFront also serves `/workout/`; the tab is the same. A page below a
  // tab (`/workout/exercises`) keeps that tab selected.
  const pathname = usePathname().replace(/(.)\/$/, '$1')
  const active = tabs.findIndex((tab) =>
    tab.href === '/'
      ? // Settings and Progress open from Today, so Today stays selected there.
        pathname === '/' || /^\/(settings|progress)(\/|$)/.test(pathname)
      : pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  )

  return (
    <nav className="tab-bar" aria-label={t('label')}>
      <div className="tab-row" data-active={active}>
        <span className="tab-knob" aria-hidden />
        {tabs.map(({ href, label, Icon }, index) => (
          <PressableLink
            key={href}
            href={href}
            aria-current={index === active ? 'page' : undefined}
            className="tab"
          >
            <Icon />
            <span className="text-caption">{t(label)}</span>
          </PressableLink>
        ))}
      </div>
    </nav>
  )
}
