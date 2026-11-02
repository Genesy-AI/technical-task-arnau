import { CountryCodesGetManyInput, CountryCodesGetManyOutput } from '../types/countryCodes/getMany'
import { ApiModule, endpoint } from '../utils'

export const countryCodesApi = {
  getMany: endpoint<CountryCodesGetManyOutput, CountryCodesGetManyInput>('get', '/country_codes'),
} as const satisfies ApiModule
