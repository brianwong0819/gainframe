'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { workoutSession } from '@/db/client'

let checked = false

// iOS may end the home-screen app between sets. When it opens again on Today
// with a workout still in progress, go straight back to that workout. Only
// once per launch, so Today stays reachable during a workout.
export function ResumeOnLaunch() {
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    if (checked) return
    checked = true
    if (pathname !== '/') return
    void workoutSession.findActive().then((workout) => {
      if (workout !== undefined) router.replace('/workout')
    })
  }, [pathname, router])
  return null
}
