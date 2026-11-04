import { describe, expect, it } from 'vitest'

import { loadLambdaEnv, parseEnv, readRelease } from './env.ts'

describe('parseEnv', () => {
  it('accepts a postgres connection string', () => {
    const url = 'postgres://gainframe:gainframe@localhost:5432/gainframe'

    expect(parseEnv({ DATABASE_URL: url })).toEqual({ DATABASE_URL: url })
  })

  it('accepts the postgresql scheme used by Neon', () => {
    const url = 'postgresql://app:secret@example.neon.tech/gainframe?sslmode=require'

    expect(parseEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url)
  })

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/)
  })

  it('rejects a non-postgres URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'https://example.com' })).toThrow(/DATABASE_URL/)
  })
})

describe('loadLambdaEnv', () => {
  const url = 'postgresql://app:secret@example.neon.tech/gainframe?sslmode=require'

  it('reads DATABASE_URL from the SSM parameter named in the environment', async () => {
    const getParameter = (name: string) =>
      name === '/gainframe/dev/database-url'
        ? Promise.resolve(url)
        : Promise.reject(new Error(`unexpected parameter ${name}`))

    const env = await loadLambdaEnv(
      { DATABASE_URL_PARAMETER: '/gainframe/dev/database-url' },
      getParameter,
    )

    expect(env).toEqual({ DATABASE_URL: url })
  })

  it('rejects a parameter name outside the project prefix', async () => {
    await expect(
      loadLambdaEnv({ DATABASE_URL_PARAMETER: '/other/database-url' }, () => Promise.resolve(url)),
    ).rejects.toThrow(/DATABASE_URL_PARAMETER/)
  })

  it('rejects the placeholder value Terraform writes before the owner sets the real one', async () => {
    await expect(
      loadLambdaEnv({ DATABASE_URL_PARAMETER: '/gainframe/dev/database-url' }, () =>
        Promise.resolve('placeholder'),
      ),
    ).rejects.toThrow(/DATABASE_URL/)
  })
})

describe('readRelease', () => {
  it('returns the git SHA from RELEASE', () => {
    expect(readRelease({ RELEASE: '3f2c1ab' })).toBe('3f2c1ab')
  })

  it('reports local when RELEASE is not set', () => {
    expect(readRelease({})).toBe('local')
  })
})
