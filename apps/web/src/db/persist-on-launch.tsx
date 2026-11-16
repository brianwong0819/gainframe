'use client'

import { useEffect } from 'react'

import { requestPersistentStorage } from './persistent-storage'

// Mounted once in the root layout. Diagnostics shows the result through
// `readPersisted`.
export function PersistOnLaunch() {
  useEffect(() => {
    void requestPersistentStorage('storage' in navigator ? navigator.storage : undefined)
  }, [])
  return null
}
