'use client'

import { useEffect } from 'react'

import { startBackup } from '@/sync/backup'

// Runs the backup triggers while the app is open (src/sync/backup.ts).
export function BackupOnLaunch() {
  useEffect(() => startBackup(), [])
  return null
}
