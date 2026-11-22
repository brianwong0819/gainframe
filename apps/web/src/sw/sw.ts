import { type PrecacheEntry, Serwist } from 'serwist'

declare const self: ServiceWorkerGlobalScope & {
  // Replaced with this release's file list by scripts/build-sw.ts.
  __SW_MANIFEST: (PrecacheEntry | string)[]
}

// Precaches every file of the static export, so the app opens offline.
// Nothing else is cached: API requests always go to the network.
// No skipWaiting: a new release takes over once every window of the previous
// one is closed, so an open page never mixes files from two releases, or when
// the user taps "Update" (src/pwa/update.ts): Serwist then calls skipWaiting on
// a `SKIP_WAITING` message.
//
// A client-side navigation fetches the page's RSC payload (`summary.txt`) with
// an `_rsc` cache-busting parameter. The precache keys have no parameters, so
// without ignoring it every offline navigation missed the precache, failed, and
// Next fell back to loading the whole page.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { ignoreURLParametersMatching: [/^_rsc$/] },
})

serwist.addEventListeners()
