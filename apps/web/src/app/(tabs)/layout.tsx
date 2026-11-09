import type { ReactNode } from 'react'

import { TabBar } from './tab-bar'

// The three tab screens share this layout, so the tab bar persists while the
// page under it changes (and animates, see tab-screen.tsx).
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tab-content">
      {children}
      <TabBar />
    </div>
  )
}
