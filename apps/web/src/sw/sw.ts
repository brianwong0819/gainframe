import { type PrecacheEntry, Serwist } from 'serwist'

declare const self: ServiceWorkerGlobalScope & {
  // Replaced with this release's file list by scripts/build-sw.ts.
  __SW_MANIFEST: (PrecacheEntry | string)[]
}

// Precaches every file of the static export, so the app opens offline.
// Nothing else is cached: API requests always go to the network.
// Client-side navigation fetches the page payloads (`__next.*.txt`) with a
// cache-busting `_rsc` parameter. The payloads are precached files, so the
// parameter is ignored when matching: a tap navigates from the cache instead
// of waiting on the network, and the payload always comes from the same
// release as the open page.
// No skipWaiting: a new release takes over once every window of the previous
// one is closed, so an open page never mixes files from two releases.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { ignoreURLParametersMatching: [/^_rsc$/] },
})

serwist.addEventListeners()
