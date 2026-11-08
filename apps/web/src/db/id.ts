// A UUIDv7 (RFC 9562): 48 bits of Unix time in milliseconds, the version, the
// variant and 74 random bits. IDs made on the device sort roughly by creation
// time, which keeps IndexedDB and Postgres B-tree inserts close together.
export function newId(nowMs: number): string {
  const time = nowMs.toString(16).padStart(12, '0')
  const random = Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  // The variant takes the top two bits of its hex digit (binary 10xx).
  const variant = (0x8 | (Number.parseInt(random.slice(3, 4), 16) & 0x3)).toString(16)
  return [
    time.slice(0, 8),
    time.slice(8, 12),
    `7${random.slice(0, 3)}`,
    `${variant}${random.slice(4, 7)}`,
    random.slice(8, 20),
  ].join('-')
}
