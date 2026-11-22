'use client'

// Sign-in redirect check (M2-02 part b). Built only for `next dev` and the dev
// deploy; a test instrument for the developer, so its labels are not in the
// i18n catalogues. The log is kept in localStorage, so the copy in the
// installed app shows what happened in any other window that shares it.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { readAuthConfig } from '@/auth/config'
import { codeChallenge, randomToken } from '@/auth/pkce'
import { release } from '@/release'
import { BackLink } from '@/ui/back-link'
import { Pressable } from '@/ui/pressable'

import {
  appendLog,
  authorizeUrl,
  channelName,
  clearLog,
  describeContext,
  exchangeCode,
  loadPending,
  logSnapshot,
  type ProbeMode,
  savePending,
  serverLogSnapshot,
  subscribeLog,
} from './probe'

const config = readAuthConfig()

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error'
}

function redirectUri(): string {
  return `${window.location.origin}/dev/sign-in-probe`
}

export default function SignInProbePage() {
  const log = useSyncExternalStore(subscribeLog, logSnapshot, serverLogSnapshot)
  const [copied, setCopied] = useState(false)

  // On every load: where the page runs, and the result of a redirect back.
  useEffect(() => {
    appendLog(`loaded (${describeContext()}, release ${release.slice(0, 7)})`)
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    if (code === null && error === null) return
    window.history.replaceState(null, '', window.location.pathname)
    if (error !== null) {
      appendLog(`redirect back with error ${error}`)
      return
    }
    const pending = loadPending()
    if (pending === null) {
      appendLog('redirect back: no pending sign-in in this storage (storage is not shared)')
      return
    }
    if (pending.state !== state) {
      appendLog('redirect back: state does not match the pending sign-in')
      return
    }
    appendLog(`redirect back (${pending.mode}): pending sign-in found, exchanging the code`)
    savePending(null)
    if (config === null || code === null) return
    const channel = new BroadcastChannel(channelName)
    exchangeCode(config, redirectUri(), code, pending.verifier)
      .then((email) => {
        appendLog(`signed in as ${email}`)
        channel.postMessage(`signed in as ${email} (${pending.mode})`)
      })
      .catch((exchangeError: unknown) => {
        appendLog(`code exchange failed (${errorText(exchangeError)})`)
      })
      .finally(() => {
        channel.close()
      })
  }, [])

  // A popup that finished reports back to the window that opened it.
  useEffect(() => {
    const channel = new BroadcastChannel(channelName)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      appendLog(`message from another window: ${String(event.data)}`)
    }
    return () => {
      channel.close()
    }
  }, [])

  const start = useCallback((mode: ProbeMode) => {
    if (config === null) return
    // A popup must open in the tap itself; the challenge is computed after.
    const popup = mode === 'popup' ? window.open('about:blank', '_blank') : null
    if (mode === 'popup' && popup === null) {
      appendLog('popup blocked')
      return
    }
    const state = randomToken()
    const verifier = randomToken()
    savePending({ mode, state, verifier, startedAt: Date.now() })
    appendLog(`starting ${mode} sign-in`)
    void codeChallenge(verifier).then((challenge) => {
      const url = authorizeUrl(config, redirectUri(), state, challenge)
      if (popup === null) window.location.assign(url)
      else popup.location.href = url
    })
  }, [])

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(log.join('\n')).then(() => {
      setCopied(true)
    })
  }, [log])

  const button = 'rounded-full bg-sunk px-20 py-12 font-semibold text-ink'

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-28 px-20 py-40">
      <header className="flex flex-col gap-8">
        <BackLink href="/" label="Today" />
        <h1 className="text-title">Sign-in redirect test</h1>
        <p className="text-label text-ink-2">
          Run each sign-in from the installed app. After the account page, note where you land (this
          app or a Safari sheet), close any sheet, and check the log here.
        </p>
      </header>

      {config === null ? (
        <p className="text-body text-ink-2">This build has no Cognito settings.</p>
      ) : (
        <section className="flex flex-col gap-12">
          <Pressable
            className={button}
            onClick={() => {
              start('navigate')
            }}
          >
            Sign in (full-page navigation)
          </Pressable>
          <Pressable
            className={button}
            onClick={() => {
              start('popup')
            }}
          >
            Sign in (window.open)
          </Pressable>
        </section>
      )}

      <section className="flex flex-col gap-12">
        <div className="flex items-center justify-between gap-12">
          <h2 className="text-section">Log</h2>
          <div className="flex gap-8">
            <Pressable className={button} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Pressable>
            <Pressable
              className={button}
              onClick={() => {
                clearLog()
                setCopied(false)
              }}
            >
              Clear
            </Pressable>
          </div>
        </div>
        <ol className="flex flex-col gap-4 rounded-group bg-surface p-16 num text-label">
          {log.map((line, index) => (
            <li key={`${String(index)}-${line}`}>{line}</li>
          ))}
        </ol>
      </section>
    </main>
  )
}
