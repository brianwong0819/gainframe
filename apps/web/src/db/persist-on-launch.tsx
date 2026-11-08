'use client'

import { useEffect } from 'react'

import { requestPersistentStorage } from './persistent-storage'

// Mounted once in the root layout. The result is shown in Diagnostics (M1-11),
// which reads `navigator.storage.persisted()` itself.
export function PersistOnLaunch() {
  useEffect(() => {
    void requestPersistentStorage('storage' in navigator ? navigator.storage : undefined)
  }, [])
  return null
}
