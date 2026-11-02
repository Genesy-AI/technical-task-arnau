export function sanitizeCountryCode(
  value: unknown,
  validCountryCodes: ReadonlySet<string>
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toUpperCase()

  if (!normalized) {
    return null
  }

  return validCountryCodes.has(normalized) ? normalized : null
}
