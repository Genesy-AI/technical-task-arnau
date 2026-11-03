import type { LeadsFindPhonesEntry } from '../api/types/leads/findPhones'

export type PhoneFinderLead = {
  id: number
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  companyName: string | null
  phone: string | null
}

export type PhoneFinderPartition = {
  leadsToFind: PhoneFinderLead[]
  skippedMissingInfo: PhoneFinderLead[]
  skippedWithPhone: PhoneFinderLead[]
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim())
}

/**
 * Splits the selected leads into:
 * - leadsToFind: leads to send to the phone finder
 * - skippedMissingInfo: leads without last name or company name
 * - skippedWithPhone: leads that already have a phone number
 */
export function partitionLeadsForPhoneFinder(leads: PhoneFinderLead[]): PhoneFinderPartition {
  const skippedWithPhone = leads.filter((lead) => hasText(lead.phone))
  const candidates = leads.filter((lead) => !hasText(lead.phone))

  return {
    leadsToFind: candidates.filter(
      (lead) => hasText(lead.lastName) && hasText(lead.companyName)
    ),
    skippedMissingInfo: candidates.filter(
      (lead) => !hasText(lead.lastName) || !hasText(lead.companyName)
    ),
    skippedWithPhone,
  }
}

export function toPhoneFinderEntry(lead: PhoneFinderLead): LeadsFindPhonesEntry {
  return {
    id: lead.id,
    nameSurname: `${lead.firstName} ${lead.lastName ?? ''}`.trim(),
    companyName: (lead.companyName ?? '').trim(),
    email: hasText(lead.email) ? lead.email!.trim() : null,
    jobTitle: hasText(lead.jobTitle) ? lead.jobTitle!.trim() : null,
  }
}
