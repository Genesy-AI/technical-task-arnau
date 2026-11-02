import { describe, it, expect } from 'vitest'
import {
  partitionLeadsForPhoneFinder,
  toPhoneFinderEntry,
  type PhoneFinderLead,
} from './phoneFinder'

function makeLead(overrides: Partial<PhoneFinderLead> = {}): PhoneFinderLead {
  return {
    id: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    jobTitle: 'CTO',
    companyName: 'Example',
    phone: null,
    ...overrides,
  }
}

describe('partitionLeadsForPhoneFinder', () => {
  it('sends leads with name and company that have no phone yet', () => {
    const lead = makeLead()

    const { leadsToFind, skippedMissingInfo, skippedWithPhone } =
      partitionLeadsForPhoneFinder([lead])

    expect(leadsToFind).toEqual([lead])
    expect(skippedMissingInfo).toEqual([])
    expect(skippedWithPhone).toEqual([])
  })

  it('skips leads that already have a phone number', () => {
    const withPhone = makeLead({ id: 2, phone: '+34600000000' })

    const { leadsToFind, skippedWithPhone } = partitionLeadsForPhoneFinder([withPhone])

    expect(leadsToFind).toEqual([])
    expect(skippedWithPhone).toEqual([withPhone])
  })

  it('skips leads without last name or company name and reports them as missing info', () => {
    const noLastName = makeLead({ id: 3, lastName: null })
    const blankCompany = makeLead({ id: 4, companyName: '   ' })

    const { leadsToFind, skippedMissingInfo, skippedWithPhone } = partitionLeadsForPhoneFinder([
      noLastName,
      blankCompany,
    ])

    expect(leadsToFind).toEqual([])
    expect(skippedMissingInfo).toEqual([noLastName, blankCompany])
    expect(skippedWithPhone).toEqual([])
  })

  it('counts a lead with phone only as skipped with phone, not as missing info', () => {
    const withPhoneAndNoCompany = makeLead({ id: 5, phone: '+34600000001', companyName: null })

    const { skippedMissingInfo, skippedWithPhone } = partitionLeadsForPhoneFinder([
      withPhoneAndNoCompany,
    ])

    expect(skippedMissingInfo).toEqual([])
    expect(skippedWithPhone).toEqual([withPhoneAndNoCompany])
  })
})

describe('toPhoneFinderEntry', () => {
  it('builds the payload entry from a lead', () => {
    const entry = toPhoneFinderEntry(makeLead())

    expect(entry).toEqual({
      id: 1,
      nameSurname: 'Ada Lovelace',
      companyName: 'Example',
      email: 'ada@example.com',
      jobTitle: 'CTO',
    })
  })

  it('trims the name and keeps missing optional fields as null', () => {
    const entry = toPhoneFinderEntry(
      makeLead({ firstName: '  Ada  ', lastName: '  ', email: '  ', jobTitle: null, companyName: ' Example ' })
    )

    expect(entry).toEqual({
      id: 1,
      nameSurname: 'Ada',
      companyName: 'Example',
      email: null,
      jobTitle: null,
    })
  })
})
