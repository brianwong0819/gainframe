'use client'

import { useEffect } from 'react'

import { Pressable } from '../ui/pressable'

import { reportError } from './report'

export interface ErrorScreenText {
  title: string
  body: string
  retry: string
}

/**
 * What a crashed screen shows instead of a blank page: the error is recorded
 * once, and "Try again" re-renders the failed part (Next.js `retry`).
 */
export function ErrorScreen({
  error,
  retry,
  text,
}: {
  error: unknown
  retry: () => void
  text: ErrorScreenText
}) {
  useEffect(() => {
    reportError('boundary', error)
  }, [error])

  return (
    <main role="alert" className="flex flex-col items-start gap-20">
      <h1 className="text-title">{text.title}</h1>
      <p className="text-body text-ink-2">{text.body}</p>
      <Pressable onClick={retry} className="rounded-ctl bg-sunk px-20 py-12 text-body">
        {text.retry}
      </Pressable>
    </main>
  )
}
