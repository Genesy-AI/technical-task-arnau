import { countryCodesApi } from './modules/countryCodes'
import { leadsApi } from './modules/leads'
import { ApiModule } from './utils'

export const api = {
  leads: leadsApi,
  countryCodes: countryCodesApi,
} as const satisfies ApiModule

export { useApiMutation } from './mutations/useApiMutation'
export type { ApiInput, ApiOutput } from './utils'
