# Country Code Validation for CSV Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV imports validate `countryCode` against the ISO 3166-1 alpha-2 codes stored in SQLite — bad codes import as leads without a country code, with a yellow warning shown before anything is saved.

**Architecture:** A `country_code` whitelist table is seeded by a Prisma migration and served by `GET /country_codes`. The CSV modal fetches that list and injects it into `parseCsv`, which normalizes each row's code to uppercase and stamps a warning (never an error) on rows whose code is not approved, dropping the code from the payload. `POST /leads/bulk` re-applies the same normalize-and-null rule server-side before any insert.

**Tech Stack:** TypeScript, React 18, TanStack Query v5, Vite + Tailwind, papaparse (frontend); Express 5, Prisma 6, SQLite, vitest (backend).

**Spec:** `docs/superpowers/specs/2026-11-02-country-code-validation-design.md`

## Global Constraints

- Codes are the official ISO 3166-1 alpha-2 set: exactly 249, uppercase. `'UK'` and `'XK'` must NOT be present (`GB` is the United Kingdom).
- Normalization order: trim, then uppercase, then membership check.
- A bad country code NEVER invalidates or rejects a lead: the lead is imported with an empty/`null` `countryCode`.
- Row helper copy is exactly `invalid country code`; pre-import notice copy is exactly `<N> leads will be imported without a country_code` (N substituted). No toast for this message.
- Table naming: table `country_code`, single column `country_code TEXT PRIMARY KEY` (no `name` column).
- API shape: `GET /country_codes` → `200 { "countryCodes": ["AD", "AE", ...] }` (sorted, codes only).
- Empty `countryCode` stays optional and produces no warning.

## Review Focus

1. CSV contains `UK` (common spelling, not ISO) — must warn and import without code, never store `UK`. Pinned by Task 1 seed test (absent from table) and Task 3 parser test.
2. Lowercase/whitespace input (` us `, `Us`) must normalize to `US` and pass silently — pinned by Task 2 `sanitizeCountryCode` tests and Task 3 parser test.
3. A row whose ONLY problem is a bad country code must remain importable (`isValid: true`, payload without code) — pinned by Task 3 parser test asserting `isValid === true`.
4. A direct `POST /leads/bulk` with a garbage code must store `null` (no bypass around the modal) — rule pinned by Task 2 unit tests; reviewer confirms the create call actually uses `sanitizeCountryCode`.
5. The notice/summary count must include only rows that will be imported (valid rows with warnings), not invalid rows that also carry warnings — no test harness for components; pinned by the exact filter expression in Task 4 and reviewer attention.

---

## File Structure

**Create:**
- `backend/prisma/migrations/<timestamp>_add_country_code/migration.sql` — table + 249-code seed (generated, then hand-edited)
- `backend/prisma/countryCodeSeed.test.ts` — integration test pinning the seed
- `backend/src/utils/countryCodes.ts` — `sanitizeCountryCode` rule
- `backend/src/utils/countryCodes.test.ts` — unit tests for the rule
- `frontend/src/api/types/countryCodes/getMany.ts` — endpoint types
- `frontend/src/api/modules/countryCodes.ts` — endpoint module

**Modify:**
- `backend/prisma/schema.prisma` — add `country_code` model
- `backend/src/index.ts` — `GET /country_codes` route; bulk-import wiring
- `frontend/src/utils/csvParser.ts` — signature + warning logic
- `frontend/src/utils/csvParser.test.ts` — updated calls + new cases
- `frontend/src/api/index.ts` — register `countryCodes` module
- `frontend/src/components/CsvImportModal.tsx` — fetch, guard, warning UI, notice, summary stat

---

### Task 1: Backend — `country_code` table, seeded migration, `GET /country_codes`

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_country_code/migration.sql` (via `prisma migrate dev --create-only`, then edit)
- Create: `backend/prisma/countryCodeSeed.test.ts`
- Modify: `backend/src/index.ts` (new route)

**Interfaces:**
- Consumes: nothing.
- Produces: table `country_code(country_code TEXT PK)` with exactly 249 seeded rows; `GET /country_codes` → `{ countryCodes: string[] }`; Prisma access pattern `prisma.country_code.findMany({ select: { country_code: true } })` → `{ country_code: string }[]` (Task 2 relies on this).

- [ ] **Step 1: Write the failing seed test** in `backend/prisma/countryCodeSeed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('country_code seed', () => {
  it('contains exactly the 249 official ISO 3166-1 alpha-2 codes', async () => {
    const rows = await prisma.country_code.findMany({ select: { country_code: true } })
    expect(rows.length).toBe(249)
    expect(new Set(rows.map((r) => r.country_code)).size).toBe(249)
  })

  it('includes representative codes and excludes common non-ISO spellings', async () => {
    const codes = new Set((await prisma.country_code.findMany()).map((r) => r.country_code))
    for (const code of ['AD', 'US', 'GB', 'FR', 'ES', 'ZW']) {
      expect(codes.has(code)).toBe(true)
    }
    expect(codes.has('UK')).toBe(false)
    expect(codes.has('XK')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (in `backend/`): `pnpm exec vitest run prisma/countryCodeSeed.test.ts`
Expected: FAIL — `prisma.country_code` is undefined / table does not exist.

- [ ] **Step 3: Add the model** to `backend/prisma/schema.prisma`:

```prisma
model country_code {
  country_code String @id
}
```

- [ ] **Step 4: Create the migration without applying it**

Run (in `backend/`): `pnpm exec prisma migrate dev --name add_country_code --create-only`
Expected: a new folder `backend/prisma/migrations/<timestamp>_add_country_code/` containing `migration.sql` with a `CREATE TABLE "country_code"` statement.

- [ ] **Step 5: Seed the migration SQL**

Edit the generated `migration.sql`: keep the `CREATE TABLE`, then append a single `INSERT INTO "country_code" ("country_code") VALUES ('AD'), ('AE'), ... , ('ZW');` seeding **all 249 official ISO 3166-1 alpha-2 codes** in uppercase (AD=Andorra through ZW=Zimbabwe). Verify the list length is 249 before saving; `GB` present, `UK`/`XK` absent.

- [ ] **Step 6: Apply the migration**

Run (in `backend/`): `pnpm exec prisma migrate dev`
Expected: "Your database is now in sync with your schema migrations" and the Prisma client regenerated.

- [ ] **Step 7: Run the seed test to verify it passes**

Run (in `backend/`): `pnpm exec vitest run prisma/countryCodeSeed.test.ts`
Expected: PASS (both tests).

- [ ] **Step 8: Add `GET /country_codes`** to `backend/src/index.ts` (next to the other lead routes):

```ts
app.get('/country_codes', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.country_code.findMany({
      select: { country_code: true },
      orderBy: { country_code: 'asc' },
    })
    res.json({ countryCodes: rows.map((row) => row.country_code) })
  } catch (error) {
    console.error('Error fetching country codes:', error)
    res.status(500).json({ error: 'Failed to fetch country codes' })
  }
})
```

- [ ] **Step 9: Verify the build and full backend suite**

Run (in `backend/`): `pnpm build` then `pnpm exec vitest run`
Expected: both PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/prisma/countryCodeSeed.test.ts backend/src/index.ts
git commit -m "feat(backend): add country_code table with ISO seed and GET /country_codes"
```

---

### Task 2: Backend — `sanitizeCountryCode` rule wired into bulk import

**Files:**
- Create: `backend/src/utils/countryCodes.ts`
- Test: `backend/src/utils/countryCodes.test.ts`
- Modify: `backend/src/index.ts:170-254` (`POST /leads/bulk`)

**Interfaces:**
- Consumes: `prisma.country_code.findMany({ select: { country_code: true } })` → `{ country_code: string }[]` (Task 1).
- Produces: `sanitizeCountryCode(value: unknown, validCountryCodes: ReadonlySet<string>): string | null` exported from `backend/src/utils/countryCodes.ts`.

- [ ] **Step 1: Write the failing tests** in `backend/src/utils/countryCodes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sanitizeCountryCode } from './countryCodes'

const valid = new Set(['US', 'GB', 'FR'])

describe('sanitizeCountryCode', () => {
  it('normalizes to uppercase and accepts a valid code', () => {
    expect(sanitizeCountryCode('us', valid)).toBe('US')
  })
  it('trims surrounding whitespace', () => {
    expect(sanitizeCountryCode('  fr ', valid)).toBe('FR')
  })
  it('returns null for a code not in the approved list', () => {
    expect(sanitizeCountryCode('UK', valid)).toBeNull()
    expect(sanitizeCountryCode('XX', valid)).toBeNull()
  })
  it('returns null for empty or non-string values', () => {
    expect(sanitizeCountryCode('', valid)).toBeNull()
    expect(sanitizeCountryCode(undefined, valid)).toBeNull()
    expect(sanitizeCountryCode(42, valid)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `backend/`): `pnpm exec vitest run src/utils/countryCodes.test.ts`
Expected: FAIL — module `./countryCodes` not found.

- [ ] **Step 3: Implement `sanitizeCountryCode`** in `backend/src/utils/countryCodes.ts` with the exact signature from the Interfaces block. Body order is fixed by the spec: non-string → `null`; then `value.trim().toUpperCase()`; empty result → `null`; return the normalized code if `validCountryCodes.has(normalized)`, else `null`.

- [ ] **Step 4: Run the tests to verify they pass**

Run (in `backend/`): `pnpm exec vitest run src/utils/countryCodes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the rule into `POST /leads/bulk`** in `backend/src/index.ts`:

- Import `sanitizeCountryCode` from `./utils/countryCodes`.
- Just before the `for (const lead of uniqueLeads)` create loop, load the approved set once:

```ts
const countryRows = await prisma.country_code.findMany({ select: { country_code: true } })
const validCountryCodes = new Set(countryRows.map((row) => row.country_code))
```

- In the `prisma.lead.create` data, replace the `countryCode:` line with:

```ts
countryCode: sanitizeCountryCode(lead.countryCode, validCountryCodes),
```

- [ ] **Step 6: Verify build and full backend suite**

Run (in `backend/`): `pnpm build` then `pnpm exec vitest run`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/utils/countryCodes.ts backend/src/utils/countryCodes.test.ts backend/src/index.ts
git commit -m "feat(backend): normalize and validate countryCode before bulk insert"
```

---

### Task 3: Frontend — `parseCsv` validates and normalizes `countryCode`

**Files:**
- Modify: `frontend/src/utils/csvParser.ts`
- Test: `frontend/src/utils/csvParser.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseCsv(content: string, validCountryCodes: ReadonlySet<string>): CsvLead[]`; `CsvLead` gains `warnings: string[]`. Rules: code is trimmed + uppercased; if non-empty and not in the set → `countryCode` becomes `undefined` and `warnings` gains the string `'invalid country code'`; `isValid` is driven by `errors` only (warnings never invalidate). Task 4 relies on all of this.
- Scope note: the only call site (`CsvImportModal.tsx` calling `parseCsv`) is updated in Task 4, which passes the fetched set. Leave the modal untouched in this task; the transient type error there closes when Task 4 lands.

- [ ] **Step 1: Update and extend the tests** in `frontend/src/utils/csvParser.test.ts`. Pass `new Set([...])` as the second argument to every existing `parseCsv(...)` call (use a set containing the codes those fixtures use, e.g. `new Set(['US'])`), and add:

```ts
it('uppercases a lowercase country code without warning', () => {
  // csv row with countryCode 'us', validCountryCodes = new Set(['US'])
  // expect(result[0].countryCode).toBe('US')
  // expect(result[0].warnings).toEqual([])
})
it('flags a non-ISO code, keeps the row valid, and drops the code', () => {
  // csv row with countryCode 'UK', validCountryCodes = new Set(['GB', 'US'])
  // expect(result[0].warnings).toEqual(['invalid country code'])
  // expect(result[0].countryCode).toBeUndefined()
  // expect(result[0].isValid).toBe(true)
})
it('stays silent when countryCode is empty', () => {
  // csv row without countryCode
  // expect(result[0].warnings).toEqual([])
})
```

(Style the test bodies like the existing tests in the file — build the CSV string, call `parseCsv`, assert.)

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run (in `frontend/`): `pnpm exec vitest run src/utils/csvParser.test.ts`
Expected: new tests FAIL (`warnings` undefined / wrong value); existing tests still compile.

- [ ] **Step 3: Implement in `frontend/src/utils/csvParser.ts`**

- `CsvLead` interface: add `warnings: string[]`.
- Signature: `export const parseCsv = (content: string, validCountryCodes: ReadonlySet<string>): CsvLead[]`.
- In the `countrycode` switch case: `lead.countryCode = trimmedValue ? trimmedValue.toUpperCase() : undefined`.
- After the existing `errors` checks, compute warnings (exact copy `'invalid country code'`):

```ts
const warnings: string[] = []
if (lead.countryCode && !validCountryCodes.has(lead.countryCode)) {
  warnings.push('invalid country code')
  lead.countryCode = undefined
}
```

- Include `warnings` in the pushed lead; `isValid: errors.length === 0` stays as-is.

- [ ] **Step 4: Run the tests to verify they pass**

Run (in `frontend/`): `pnpm exec vitest run src/utils/csvParser.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/csvParser.ts frontend/src/utils/csvParser.test.ts
git commit -m "feat(frontend): validate and normalize countryCode in CSV parser"
```

---

### Task 4: Frontend — modal fetches the list and warns before import

**Files:**
- Create: `frontend/src/api/types/countryCodes/getMany.ts`
- Create: `frontend/src/api/modules/countryCodes.ts`
- Modify: `frontend/src/api/index.ts`
- Modify: `frontend/src/components/CsvImportModal.tsx`

**Interfaces:**
- Consumes: `GET /country_codes` (Task 1) via the new `api.countryCodes.getMany(): Promise<{ countryCodes: string[] }>`; `parseCsv(content, validCountryCodes: ReadonlySet<string>)` with `warnings: string[]` per lead (Task 3).
- Produces: `api.countryCodes` registered on the `api` object; `stats.warnings: number` = valid rows carrying warnings. The import payload needs no change — Task 3's parser already sets `countryCode: undefined` for bad codes, which the existing `lead.countryCode || undefined` mapping forwards.

- [ ] **Step 1: Add the endpoint types** in `frontend/src/api/types/countryCodes/getMany.ts` (mirror `types/leads/getMany.ts` style):

```ts
export type CountryCodesGetManyInput = undefined

export type CountryCodesGetManyOutput = {
  countryCodes: string[]
}
```

- [ ] **Step 2: Add the endpoint module** in `frontend/src/api/modules/countryCodes.ts` (mirror `modules/leads.ts` style):

```ts
export const countryCodesApi = {
  getMany: endpoint<CountryCodesGetManyOutput, CountryCodesGetManyInput>('get', '/country_codes'),
} as const satisfies ApiModule
```

- [ ] **Step 3: Register it** in `frontend/src/api/index.ts`: import `countryCodesApi` and add `countryCodes: countryCodesApi,` to the `api` object.

- [ ] **Step 4: Wire the modal to the live list** in `CsvImportModal.tsx`:

- `useQuery({ queryKey: ['countryCodes', 'getMany'], queryFn: () => api.countryCodes.getMany(), enabled: isOpen })` (import `useQuery` from `@tanstack/react-query`).
- Derived set: `useMemo(() => new Set(countryCodesQuery.data?.countryCodes ?? []), [countryCodesQuery.data])`.
- In `handleFileSelect`, before creating the `FileReader`, guard: if `countryCodesQuery.isPending || countryCodesQuery.isError`, `toast.error('Country code list unavailable. Please try again.')` and return. Pass the derived set as the second argument to `parseCsv(content, validCountryCodes)`.

- [ ] **Step 5: Warning row UI** in the results table of `CsvImportModal.tsx`:

- Row background: valid + no warnings → `bg-white`; valid + warnings → `bg-yellow-50`; invalid → `bg-red-50`.
- Status badge: invalid → existing red "Invalid"; valid + warnings → "Warning" with `bg-yellow-100 text-yellow-800`; valid + no warnings → existing green "Valid".
- Rename the "Errors" column header to "Issues"; in the cell show `lead.errors.join(', ')` in `text-red-600` and, below it, `lead.warnings.join(', ')` in `text-amber-600` (helper text `invalid country code`); show `-` only when both are empty.

- [ ] **Step 6: Count and notice** in `CsvImportModal.tsx`:

- Extend the `stats` memo with `warnings: validLeads.filter((lead) => lead.warnings.length > 0).length` (only rows that will be imported — never count `invalidLeads`).
- Add a fifth summary cell "Warnings" showing `stats.warnings` in `text-yellow-600`; change the grid to `grid-cols-2 md:grid-cols-5`.
- Above the results table, when `stats.warnings > 0`, render the notice (exact copy):

```tsx
<div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
  {stats.warnings} leads will be imported without a country_code
</div>
```

- [ ] **Step 7: Verify** (no component test harness exists in this repo; logic is covered by Task 3's parser tests)

Run (in `frontend/`): `pnpm exec vitest run` then `pnpm build` then `pnpm lint`
Expected: all PASS. Optionally run `pnpm dev`, open the import modal, and eyeball a CSV with one bad code (yellow row + notice) and one all-good CSV (no notice).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/api/types/countryCodes frontend/src/api/modules/countryCodes.ts frontend/src/api/index.ts frontend/src/components/CsvImportModal.tsx
git commit -m "feat(frontend): warn about invalid country codes in CSV import modal"
```
