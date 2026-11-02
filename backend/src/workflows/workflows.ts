import { proxyActivities, sleep } from '@temporalio/workflow'
import type * as activities from './activities'
import { findPhoneWithProviders, type FindPhoneInput, type PhoneLookup } from './phoneFinder'

const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 second',
})

const { orionConnectLookup, astraDialerLookup, numbusLookup } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  // Retries are handled manually inside the workflow (3 attempts per provider,
  // 3 seconds between failed attempts), so Temporal must not retry on its own.
  retry: { maximumAttempts: 1 },
})

export type { FindPhoneInput }

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}

/**
 * Looks for a lead's phone number trying the providers in order of data
 * quality: Orion Connect -> Astra Dialer -> Nimbus Lookup. The first
 * provider that returns a phone number wins.
 */
export async function findPhoneWorkflow(input: FindPhoneInput): Promise<string | null> {
  const lookups: PhoneLookup[] = [orionConnectLookup]

  if (input.email && input.email.trim()) {
    lookups.push(astraDialerLookup, numbusLookup)
  }

  return await findPhoneWithProviders(input, lookups, (ms) => sleep(ms))
}
