import { describe, it, expect } from 'vitest'
import { sanitizeCountryCode } from './countryCodes'

const valid = new Set(['US', 'GB', 'FR'])

describe('sanitizeCountryCode', () => {
  it('normalizes to uppercase and accepts a valid code', () => {
    expect(sanitizeCountryCode('us', valid)).toBe('US')
  })
  it('trims surrounding whitespace', () => {
    expect(sanitizeCountryCode('  fr ', valid)).toBe('FR')
  })
  it('returns null for a code not in the approved list', () => {
    expect(sanitizeCountryCode('UK', valid)).toBeNull()
    expect(sanitizeCountryCode('XX', valid)).toBeNull()
  })
  it('returns null for empty or non-string values', () => {
    expect(sanitizeCountryCode('', valid)).toBeNull()
    expect(sanitizeCountryCode(undefined, valid)).toBeNull()
    expect(sanitizeCountryCode(42, valid)).toBeNull()
  })
})
