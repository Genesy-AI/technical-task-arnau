export type LeadsFindPhonesEntry = {
  id: number
  nameSurname: string
  companyName: string
  email: string | null
  jobTitle: string | null
}

export type LeadsFindPhonesInput = {
  leads: LeadsFindPhonesEntry[]
}

export type LeadsFindPhonesOutput = {
  success: boolean
  updatedCount: number
  results: Array<{
    leadId: number
    phone: string | null
  }>
  errors: Array<{
    leadId: number
    leadName: string
    error: string
  }>
}
