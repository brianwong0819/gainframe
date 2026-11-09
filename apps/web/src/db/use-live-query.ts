'use client'

import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

// The result of a Dexie query, kept current as the rows it read change;
// undefined while loading. A failed read is rethrown during render, so the
// error screen records it. `query` must be stable (module-level or memoised).
export function useLiveQuery<T>(query: () => Promise<T>): T | undefined {
  const [result, setResult] = useState<{ value: T }>()
  const [failure, setFailure] = useState<Error | null>(null)
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (value) => {
        setResult({ value })
      },
      error: (reason: unknown) => {
        setFailure(reason instanceof Error ? reason : new Error(String(reason)))
      },
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [query])
  if (failure !== null) throw failure
  return result?.value
}
