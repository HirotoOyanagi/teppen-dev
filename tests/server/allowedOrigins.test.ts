import { describe, expect, it } from 'vitest'
import { isOriginAllowed, parseAllowedOrigins } from '../../server/allowedOrigins'

describe('allowedOrigins', () => {
  it('trims comma-separated origin entries', () => {
    expect(parseAllowedOrigins(' http://localhost:3000 , https://example.com/ ')).toEqual([
      'http://localhost:3000',
      'https://example.com/',
    ])
  })

  it('matches normalized exact origins', () => {
    const allowedOrigins = parseAllowedOrigins('https://Example.com/, http://localhost:3000')

    expect(isOriginAllowed('https://example.com', allowedOrigins)).toBe(true)
    expect(isOriginAllowed('https://example.com/', allowedOrigins)).toBe(true)
  })

  it('supports wildcard subdomain origins with scheme', () => {
    const allowedOrigins = parseAllowedOrigins('https://*.vercel.app')

    expect(isOriginAllowed('https://teppen-preview.vercel.app', allowedOrigins)).toBe(true)
    expect(isOriginAllowed('https://teppen.vercel.app', allowedOrigins)).toBe(true)
    expect(isOriginAllowed('http://teppen.vercel.app', allowedOrigins)).toBe(false)
  })

  it('rejects origins not present in the allowlist', () => {
    const allowedOrigins = parseAllowedOrigins('http://localhost:3000')

    expect(isOriginAllowed('https://teppen-game.vercel.app', allowedOrigins)).toBe(false)
  })
})
