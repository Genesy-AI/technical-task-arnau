import type { FindPhoneInput } from '../phoneFinder'

const ORION_CONNECT_URL = 'https://api.enginy.ai/api/tmp/orionConnect'
const ASTRA_DIALER_URL = 'https://api.enginy.ai/api/tmp/astraDialer'
const NIMBUS_LOOKUP_URL = 'https://api.enginy.ai/api/tmp/numbusLookup'

const ORION_CONNECT_API_KEY = 'mySecretKey123'
const ASTRA_DIALER_API_KEY = '1234jhgf'
const NIMBUS_LOOKUP_API_KEY = '000099998888'

async function postJson(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Phone lookup request to ${url} failed with status ${response.status}`)
  }

  return await response.json()
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const phone = value.trim()
  return phone ? phone : null
}

/**
 * Orion Connect: best data in the market, but slow and fails sometimes.
 * Request: { fullName, companyWebsite } -> Response: { phone: string | null }
 */
export async function orionConnectLookup(input: FindPhoneInput): Promise<string | null> {
  const data = await postJson(
    ORION_CONNECT_URL,
    { fullName: input.nameSurname, companyWebsite: input.companyName },
    { 'x-auth-me': ORION_CONNECT_API_KEY }
  )

  return normalizePhone(data?.phone)
}

/**
 * Astra Dialer: worst data in the market, but the fastest one.
 * Request: { email } -> Response: { phoneNmbr: string | null | undefined }
 */
export async function astraDialerLookup(input: FindPhoneInput): Promise<string | null> {
  const email = input.email?.trim()
  if (!email) {
    return null
  }

  const data = await postJson(ASTRA_DIALER_URL, { email }, { apiKey: ASTRA_DIALER_API_KEY })

  return normalizePhone(data?.phoneNmbr)
}

/**
 * Nimbus Lookup: new provider in the market.
 * Request: { email, jobTitle } -> Response: { number: number, countryCode: string }
 */
export async function numbusLookup(input: FindPhoneInput): Promise<string | null> {
  const email = input.email?.trim()
  if (!email) {
    return null
  }

  const data = await postJson(
    `${NIMBUS_LOOKUP_URL}?api=${NIMBUS_LOOKUP_API_KEY}`,
    { email, jobTitle: input.jobTitle?.trim() ?? '' },
    {}
  )

  if (data?.number === null || data?.number === undefined) {
    return null
  }

  const number = String(data.number).trim()
  if (!number) {
    return null
  }

  const countryCode =
    typeof data.countryCode === 'string' ? data.countryCode.trim().replace(/^\+/, '') : ''

  return countryCode ? `+${countryCode}${number}` : number
}
