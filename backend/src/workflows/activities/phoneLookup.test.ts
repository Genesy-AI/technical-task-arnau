import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  astraDialerLookup,
  numbusLookup,
  orionConnectLookup,
} from './phoneLookup'
import type { FindPhoneInput } from '../phoneFinder'

const input: FindPhoneInput = {
  nameSurname: 'Ada Lovelace',
  companyName: 'example.com',
  email: 'ada@example.com',
  jobTitle: 'CTO',
}

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
  }))
}

describe('phone lookup activities', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('orionConnectLookup', () => {
    it('sends fullName and companyWebsite with the x-auth-me header', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ phone: '+34600000000' }),
      })

      const phone = await orionConnectLookup(input)

      expect(phone).toBe('+34600000000')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.enginy.ai/api/tmp/orionConnect')
      expect(init.method).toBe('POST')
      expect(init.headers['x-auth-me']).toBe('mySecretKey123')
      expect(JSON.parse(init.body)).toEqual({
        fullName: 'Ada Lovelace',
        companyWebsite: 'example.com',
      })
    })

    it('returns null when the response has no phone', async () => {
      fetchMock.mockImplementation(mockFetchResponse({ phone: null }))

      await expect(orionConnectLookup(input)).resolves.toBeNull()
    })

    it('throws on a failed response', async () => {
      fetchMock.mockImplementation(mockFetchResponse({}, false, 500))

      await expect(orionConnectLookup(input)).rejects.toThrow()
    })
  })

  describe('astraDialerLookup', () => {
    it('sends the email with the apiKey header', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ phoneNmbr: ' +34600000001 ' }),
      })

      const phone = await astraDialerLookup(input)

      expect(phone).toBe('+34600000001')
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.enginy.ai/api/tmp/astraDialer')
      expect(init.headers['apiKey']).toBe('1234jhgf')
      expect(JSON.parse(init.body)).toEqual({ email: 'ada@example.com' })
    })

    it('returns null when phoneNmbr is null or undefined', async () => {
      fetchMock.mockImplementation(mockFetchResponse({ phoneNmbr: undefined }))

      await expect(astraDialerLookup(input)).resolves.toBeNull()
    })

    it('returns null without calling the API when the lead has no email', async () => {
      const phone = await astraDialerLookup({ ...input, email: null })

      expect(phone).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('throws on a failed response', async () => {
      fetchMock.mockImplementation(mockFetchResponse({}, false, 503))

      await expect(astraDialerLookup(input)).rejects.toThrow()
    })
  })

  describe('numbusLookup', () => {
    it('sends email and jobTitle with the api key as query parameter', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ number: 600000002, countryCode: '34' }),
      })

      const phone = await numbusLookup(input)

      expect(phone).toBe('+34600000002')
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.enginy.ai/api/tmp/numbusLookup?api=000099998888')
      expect(JSON.parse(init.body)).toEqual({
        email: 'ada@example.com',
        jobTitle: 'CTO',
      })
    })

    it('normalizes a countryCode that already includes the plus sign', async () => {
      fetchMock.mockImplementation(mockFetchResponse({ number: 600000003, countryCode: '+34' }))

      await expect(numbusLookup(input)).resolves.toBe('+34600000003')
    })

    it('returns null when the response has no number', async () => {
      fetchMock.mockImplementation(mockFetchResponse({ number: null, countryCode: 'ES' }))

      await expect(numbusLookup(input)).resolves.toBeNull()
    })

    it('returns null without calling the API when the lead has no email', async () => {
      const phone = await numbusLookup({ ...input, email: '   ' })

      expect(phone).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('throws on a failed response', async () => {
      fetchMock.mockImplementation(mockFetchResponse({}, false, 401))

      await expect(numbusLookup(input)).rejects.toThrow()
    })
  })
})
