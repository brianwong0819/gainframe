import { describe, expect, it } from 'vitest'

import { directConnectionUrl } from './migrate.ts'

describe('directConnectionUrl', () => {
  it("drops Neon's -pooler suffix from the endpoint ID", () => {
    expect(
      directConnectionUrl(
        'postgresql://app:secret@ep-cool-darkness-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
      ),
    ).toBe(
      'postgresql://app:secret@ep-cool-darkness-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
    )
  })

  it('keeps a direct or local connection string as it is', () => {
    const local = 'postgres://gainframe:gainframe@localhost:5432/gainframe'
    expect(directConnectionUrl(local)).toBe(local)
  })
})
