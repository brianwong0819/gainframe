import type { ReactNode } from 'react'

import { ResumeOnLaunch } from '@/features/workout/resume-on-launch'

import { TabBar } from './tab-bar'

// The three tab screens share this layout, so the tab bar persists while the
// page under it changes.
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tab-content">
      {children}
      <ResumeOnLaunch />
      <TabBar />
    </div>
  )
}
