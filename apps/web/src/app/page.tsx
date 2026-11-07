import Link from 'next/link'

// Dev builds only; English because these are developer tools outside the i18n
// catalogues (see next.config.ts).
const devPages = [
  { href: '/dev/rest-timer', label: 'Rest timer test' },
  { href: '/dev/kitchen-sink', label: 'Kitchen sink' },
] as const

export default function HomePage() {
  return (
    <main>
      <h1>Gainframe</h1>
      {process.env.NEXT_PUBLIC_DEV_PAGES === '1' && (
        <nav aria-label="Dev pages" className="flex flex-col gap-12 px-20 py-28">
          {devPages.map((page) => (
            <Link key={page.href} href={page.href} className="py-12 text-body text-accent">
              {page.label}
            </Link>
          ))}
        </nav>
      )}
    </main>
  )
}
