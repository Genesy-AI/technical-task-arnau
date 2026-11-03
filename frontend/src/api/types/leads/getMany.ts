export type LeadsGetManyInput = undefined

export type LeadsGetManyOutput = {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  phone: string | null
  yearsAtCurrentCompany: string | null
  linkedinProfileUrl: string | null
  message: string | null
  emailVerified: boolean | null
}[]
