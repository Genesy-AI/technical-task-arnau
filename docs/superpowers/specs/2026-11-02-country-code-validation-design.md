# Country Code Validation for CSV Import — Design

**Date:** 2026-11-02
**Status:** Approved as amended in review (2026-11-02)

## Intent

CSV imports must never store a garbage country code. Each import retrieves the approved ISO country codes from the backend, normalizes every row's `countryCode` to uppercase, and validates it — all before any lead is written. A bad code never blocks a lead: the lead is imported with an empty `countryCode`, and the preview warns the user in yellow that this will happen.

## Goals

- ISO 3166-1 alpha-2 codes (249) in a `country_code` table in SQLite, seeded by a Prisma migration.
- `GET /country_codes` serves the approved list; every CSV import fetches it and validates normalized codes against it.
- Invalid code → lead still imports, with empty `countryCode`; preview shows a yellow "warning" row advising the user.
- Backend re-applies the same normalize-and-null rule in `POST /leads/bulk`, so direct API calls can't bypass it.

## Non-goals

- Validating `countryCode` on single create (`POST /leads`) or update (`PATCH /leads/:id`) — same rule could be extended there later.
- Rejecting or blocking leads over country codes (never an error, always a warning).
- Country names, dial codes, or any country-picker UI.

## Anti-goals

- Letting an unvalidated `countryCode` reach the `lead` table.
- Letting a bad country code invalidate an otherwise good row.

## Constraints

- SQLite + Prisma migrations (`backend/prisma/migrations`); the existing `lead` model is untouched.
- Frontend check must happen at parse/preview time, before the import call.
- Existing parser tests (`frontend/src/utils/csvParser.test.ts`) describe current behavior and must be extended, not weakened.

## Approaches

- **A — validate inside `parseCsv`, approved set injected (CHOSEN).** The modal fetches `GET /country_codes` and passes the set into `parseCsv(content, countryCodes)`; all row rules (name, email, country) live in one place; `CsvLead` gains `warnings: string[]` beside `errors`. Cost: parser signature and its tests change. Chosen because `countryCode` is just one more row rule and one validation home is easier to reason about.
- **B — separate post-parse pass.** Parser untouched; a second function stamps warnings once the list arrives. Cost: row validation split across two places, modal juggling parse → fetch → annotate. Rejected.
- **C — backend-only validation after submit.** Rejected outright: it cannot warn before saving, which is the core requirement.

## Decided hows

- **Table:** `country_code(country_code TEXT PK)` — the code column only, no `name` column (per review).
- **Migration:** `prisma migrate dev` creates the table; the generated migration SQL gains `INSERT`s seeding all 249 codes (data lives with the schema migration).
- **Endpoint:** `GET /country_codes` → `200 { "countryCodes": ["AD", "AE", ...] }` (codes only).
- **Parser:** non-empty code is uppercased; if it still doesn't match the approved list, the row gets a warning with helper text *"invalid country code"* and `countryCode` becomes `undefined`, so the import payload carries no code. Empty code stays optional and silent.
- **Modal:** warning rows render yellow (`bg-yellow-50`, amber text) with a yellow "Warning" badge, alongside the existing green "Valid" / red "Invalid". When warnings exist, a notice states *"X leads will be imported without a country_code"* before the user confirms (per review — replaces the post-import toast). The import summary gains a yellow "Warnings" count (my call, kept from the reviewed draft).
- **Bulk endpoint:** uppercases the incoming code, reads the `country_code` table once per request, stores `null` for anything not found — before any insert.
- **Tests:** parser tests cover lowercase → uppercased valid, invalid → warning + `undefined`, empty → silent; backend gets a unit test for a small `sanitizeCountryCode` helper extracted into `backend/src/utils` (my call, keeps the express handler thin).

## Left to the builder

- Copy is fixed by review: row helper text *"invalid country code"*; notice *"X leads will be imported without a country_code"*.
- Minor layout details (helper text in the existing Errors cell, in amber; notice placed above the results table).
