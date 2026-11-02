import { describe, it, expect, vi } from 'vitest'
import {
  findPhoneWithProviders,
  findPhoneWithRetries,
  PHONE_LOOKUP_MAX_ATTEMPTS,
  PHONE_LOOKUP_RETRY_DELAY_MS,
  type FindPhoneInput,
  type PhoneLookup,
} from './phoneFinder'

const input: FindPhoneInput = {
  nameSurname: 'Ada Lovelace',
  companyName: 'Example',
  email: 'ada@example.com',
  jobTitle: 'CTO',
}

function makeSleep() {
  return vi.fn(async (_ms: number) => {})
}

describe('findPhoneWithRetries', () => {
  it('returns the phone number on the first successful attempt', async () => {
    const lookup = vi.fn<PhoneLookup>(async () => '+34600000000')
    const sleep = makeSleep()

    const phone = await findPhoneWithRetries(lookup, input, sleep)

    expect(phone).toBe('+34600000000')
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries after a failed attempt and succeeds', async () => {
    const lookup = vi
      .fn<PhoneLookup>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('+34600000001')
    const sleep = makeSleep()

    const phone = await findPhoneWithRetries(lookup, input, sleep)

    expect(phone).toBe('+34600000001')
    expect(lookup).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(sleep).toHaveBeenCalledWith(PHONE_LOOKUP_RETRY_DELAY_MS)
  })

  it('treats an empty response as a failed attempt', async () => {
    const lookup = vi
      .fn<PhoneLookup>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('+34600000002')
    const sleep = makeSleep()

    const phone = await findPhoneWithRetries(lookup, input, sleep)

    expect(phone).toBe('+34600000002')
    expect(lookup).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('returns null after exhausting all attempts, waiting between each one', async () => {
    const lookup = vi.fn<PhoneLookup>(async () => {
      throw new Error('boom')
    })
    const sleep = makeSleep()

    const phone = await findPhoneWithRetries(lookup, input, sleep)

    expect(phone).toBeNull()
    expect(lookup).toHaveBeenCalledTimes(PHONE_LOOKUP_MAX_ATTEMPTS)
    expect(sleep).toHaveBeenCalledTimes(PHONE_LOOKUP_MAX_ATTEMPTS - 1)
    expect(sleep).toHaveBeenCalledWith(PHONE_LOOKUP_RETRY_DELAY_MS)
  })
})

describe('findPhoneWithProviders', () => {
  it('returns the phone from the first provider without calling the others', async () => {
    const first = vi.fn<PhoneLookup>(async () => '+34600000010')
    const second = vi.fn<PhoneLookup>(async () => '+34600000011')
    const sleep = makeSleep()

    const phone = await findPhoneWithProviders(input, [first, second], sleep)

    expect(phone).toBe('+34600000010')
    expect(second).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
  })

  it('falls back to the next provider after 3 failed attempts', async () => {
    const first = vi.fn<PhoneLookup>(async () => {
      throw new Error('boom')
    })
    const second = vi.fn<PhoneLookup>(async () => '+34600000012')
    const sleep = makeSleep()

    const phone = await findPhoneWithProviders(input, [first, second], sleep)

    expect(phone).toBe('+34600000012')
    expect(first).toHaveBeenCalledTimes(PHONE_LOOKUP_MAX_ATTEMPTS)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('returns null when every provider fails', async () => {
    const first = vi.fn<PhoneLookup>(async () => null)
    const second = vi.fn<PhoneLookup>(async () => {
      throw new Error('boom')
    })
    const sleep = makeSleep()

    const phone = await findPhoneWithProviders(input, [first, second], sleep)

    expect(phone).toBeNull()
    expect(first).toHaveBeenCalledTimes(PHONE_LOOKUP_MAX_ATTEMPTS)
    expect(second).toHaveBeenCalledTimes(PHONE_LOOKUP_MAX_ATTEMPTS)
    expect(sleep).toHaveBeenCalledTimes(2 * (PHONE_LOOKUP_MAX_ATTEMPTS - 1))
  })
})
