export type FindPhoneInput = {
  nameSurname: string
  companyName: string
  email?: string | null
  jobTitle?: string | null
}

export type PhoneLookup = (input: FindPhoneInput) => Promise<string | null>

export type Sleep = (ms: number) => Promise<void>

export const PHONE_LOOKUP_MAX_ATTEMPTS = 3
export const PHONE_LOOKUP_RETRY_DELAY_MS = 3000

/**
 * Tries a single provider up to PHONE_LOOKUP_MAX_ATTEMPTS times, waiting
 * PHONE_LOOKUP_RETRY_DELAY_MS between failed attempts of the same provider.
 * Both thrown errors and empty responses count as a failed attempt.
 */
export async function findPhoneWithRetries(
  lookup: PhoneLookup,
  input: FindPhoneInput,
  sleep: Sleep
): Promise<string | null> {
  for (let attempt = 1; attempt <= PHONE_LOOKUP_MAX_ATTEMPTS; attempt++) {
    try {
      const phone = await lookup(input)
      if (phone) {
        return phone
      }
    } catch {
      // Failed attempt, retry after the delay
    }

    if (attempt < PHONE_LOOKUP_MAX_ATTEMPTS) {
      await sleep(PHONE_LOOKUP_RETRY_DELAY_MS)
    }
  }

  return null
}

/**
 * Runs the providers in order and returns the first phone number found.
 * After PHONE_LOOKUP_MAX_ATTEMPTS failed attempts of one provider it moves
 * to the next one.
 */
export async function findPhoneWithProviders(
  input: FindPhoneInput,
  lookups: PhoneLookup[],
  sleep: Sleep
): Promise<string | null> {
  for (const lookup of lookups) {
    const phone = await findPhoneWithRetries(lookup, input, sleep)
    if (phone) {
      return phone
    }
  }

  return null
}
