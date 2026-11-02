import { describe, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('country_code seed', () => {
  it('contains exactly the 249 official ISO 3166-1 alpha-2 codes', async () => {
    const rows = await prisma.country_code.findMany({ select: { country_code: true } })
    expect(rows.length).toBe(249)
    expect(new Set(rows.map((r) => r.country_code)).size).toBe(249)
  })

  it('includes representative codes and excludes common non-ISO spellings', async () => {
    const codes = new Set((await prisma.country_code.findMany()).map((r) => r.country_code))
    for (const code of ['AD', 'US', 'GB', 'FR', 'ES', 'ZW']) {
      expect(codes.has(code)).toBe(true)
    }
    expect(codes.has('UK')).toBe(false)
    expect(codes.has('XK')).toBe(false)
  })
})
