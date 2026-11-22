import { describe, expect, it } from 'vitest'

import { loadLambdaEnv, parseEnv, readRelease } from './env.ts'

const auth = {
  AUTH_ISSUER: 'https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_test',
  AUTH_CLIENT_ID: 'web-client',
}

describe('parseEnv', () => {
  it('accepts a postgres connection string', () => {
    const url = 'postgres://gainframe:gainframe@localhost:5432/gainframe'

    expect(parseEnv({ DATABASE_URL: url, ...auth })).toEqual({ DATABASE_URL: url, ...auth })
  })

  it('accepts the postgresql scheme used by Neon', () => {
    const url = 'postgresql://app:secret@example.neon.tech/gainframe?sslmode=require'

    expect(parseEnv({ DATABASE_URL: url, ...auth }).DATABASE_URL).toBe(url)
  })

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({ ...auth })).toThrow(/DATABASE_URL/)
  })

  it('rejects a non-postgres URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'https://example.com', ...auth })).toThrow(/DATABASE_URL/)
  })

  it('rejects a missing token issuer or client', () => {
    const url = 'postgres://gainframe:gainframe@localhost:5432/gainframe'
    expect(() => parseEnv({ DATABASE_URL: url })).toThrow(/AUTH_ISSUER[\s\S]*AUTH_CLIENT_ID/)
  })
})

describe('loadLambdaEnv', () => {
  const url = 'postgresql://app:secret@example.neon.tech/gainframe?sslmode=require'

  const names = {
    DATABASE_URL_PARAMETER: '/gainframe/dev/database-url',
    AUTH_CONFIG_PARAMETER: '/gainframe/dev/auth-config',
  }
  const authConfig = JSON.stringify({ issuer: auth.AUTH_ISSUER, clientId: auth.AUTH_CLIENT_ID })

  it('reads the database URL and the auth settings from the SSM parameters named in the environment', async () => {
    const values: Record<string, string> = {
      '/gainframe/dev/database-url': url,
      '/gainframe/dev/auth-config': authConfig,
    }
    const getParameter = (name: string) =>
      values[name] === undefined
        ? Promise.reject(new Error(`unexpected parameter ${name}`))
        : Promise.resolve(values[name])

    expect(await loadLambdaEnv(names, getParameter)).toEqual({ DATABASE_URL: url, ...auth })
  })

  it('rejects a parameter name outside the project prefix', async () => {
    await expect(
      loadLambdaEnv({ ...names, DATABASE_URL_PARAMETER: '/other/database-url' }, () =>
        Promise.resolve(url),
      ),
    ).rejects.toThrow(/DATABASE_URL_PARAMETER/)
  })

  it('rejects the placeholder value Terraform writes before the owner sets the real one', async () => {
    await expect(
      loadLambdaEnv(names, (name) =>
        Promise.resolve(name === names.AUTH_CONFIG_PARAMETER ? authConfig : 'placeholder'),
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
