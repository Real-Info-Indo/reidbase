# Phase 2C — Private Reports Migration Plan (Review Only)

Status: **DRAFT — no uploads, no deletions, no code changes yet.**
Depends on: Phase 2 (RLS lockdown) — accepted.

## 1. Current state

### 1.1 Public assets (anyone with the URL can fetch)
Located under `public/reports/` and served from the app origin:

**Market reports (2 PDFs)**
- `Bali_Annual_2025.pdf`
- `Bali_Q3_2025.pdf`

**Location reports (10 PDFs)**
- `Berawa_2025.pdf`
- `Bingin_2025.pdf`
- `Canggu_2025.pdf`
- `Kerobokan_2025.pdf`
- `Pererenan_2025.pdf`
- `Sanur_2025.pdf`
- `Seminyak_2025.pdf`
- `Ubud_2025.pdf`
- `Uluwatu_2025.pdf`
- `Umalas_2025.pdf`

**Thumbnails (12 JPGs)** under `public/reports/thumbnails/` — these are intentionally
public (small cover images used as card art) and **stay public**.

### 1.2 Server side (already in place)
- Private Storage bucket `reports` exists (Is Public: No).
- Edge Function `download-report` is implemented:
  - Verifies Wix token via `verifyWixToken`.
  - Reads canonical tier from `user_entitlements`.
  - Enforces `reid_base_pro` and above for both `market` and `location`.
  - Returns a 60-second signed URL from `reports` bucket.
  - Audit logs to `report_downloads`.
  - Expects keys at `market/<slug>.pdf` and `location/<slug>.pdf`.

### 1.3 Frontend (NOT yet wired to private bucket)
`src/pages/MarketReports.tsx` and `src/pages/LocationReports.tsx` still link
directly to `/reports/*.pdf`. So even though the Edge Function exists, the UI
currently bypasses it. This must be fixed **before** the public files can be
removed.

## 2. Phase 2C scope (review only — do not execute)

Three independent steps. Each must pass its own checklist before the next.

### Step A — Upload PDFs to the private `reports` bucket

Mapping from current public filenames to required private bucket keys
(matches the Edge Function's `${reportType}/${reportKey}.pdf` layout and its
`/^[a-z0-9][a-z0-9_-]*$/i` slug rule):

| Current public file                      | Private bucket object key            |
|------------------------------------------|--------------------------------------|
| `public/reports/Bali_Annual_2025.pdf`    | `market/bali_annual_2025.pdf`        |
| `public/reports/Bali_Q3_2025.pdf`        | `market/bali_q3_2025.pdf`            |
| `public/reports/Berawa_2025.pdf`         | `location/berawa_2025.pdf`           |
| `public/reports/Bingin_2025.pdf`         | `location/bingin_2025.pdf`           |
| `public/reports/Canggu_2025.pdf`         | `location/canggu_2025.pdf`           |
| `public/reports/Kerobokan_2025.pdf`      | `location/kerobokan_2025.pdf`        |
| `public/reports/Pererenan_2025.pdf`      | `location/pererenan_2025.pdf`        |
| `public/reports/Sanur_2025.pdf`          | `location/sanur_2025.pdf`            |
| `public/reports/Seminyak_2025.pdf`       | `location/seminyak_2025.pdf`         |
| `public/reports/Ubud_2025.pdf`           | `location/ubud_2025.pdf`             |
| `public/reports/Uluwatu_2025.pdf`        | `location/uluwatu_2025.pdf`          |
| `public/reports/Umalas_2025.pdf`         | `location/umalas_2025.pdf`           |

Upload method (recommended): Lovable Cloud → Storage → `reports` bucket → upload
into `market/` and `location/` folders. Bucket stays private; no public policy
needed because access is brokered by the Edge Function using the service role.

**Step A acceptance:**
- [ ] All 12 objects exist at the keys above
- [ ] Bucket `reports` remains private (no public SELECT policy)
- [ ] Spot check: calling `download-report` with `{report_type:"location", report_key:"canggu_2025"}` as a Pro user returns a working signed URL that downloads the PDF

### Step B — Wire the frontend to `download-report`

Code change (separate PR, after Step A is green):

- `src/pages/MarketReports.tsx`: replace each report's `file` with a `report_key`
  (`bali_annual_2025`, `bali_q3_2025`) and a `report_type: "market"`.
- `src/pages/LocationReports.tsx`: same pattern with `report_type: "location"`
  and slug-cased keys (`berawa_2025`, `bingin_2025`, …).
- Replace any direct `<a href="/reports/...pdf">` with a click handler that:
  1. Calls `supabase.functions.invoke("download-report", { body, headers: wixAuthHeader() })`
  2. On success, opens `data.url` in a new tab (or triggers a download).
  3. Surfaces friendly errors for `401 / 403 tier_forbidden / 404 report_not_found`.
- Thumbnails (`/reports/thumbnails/*.jpg`) are unchanged — they remain in `public/`.

**Step B acceptance:**
- [ ] Pro/Enterprise user: every Market and Location card downloads its PDF via signed URL
- [ ] Free/Member user: download attempt returns `tier_forbidden` and the UI shows the upgrade prompt (existing pattern)
- [ ] No remaining references to `/reports/*.pdf` in `src/` (only thumbnails remain)
- [ ] `report_downloads` table gets a new row per successful download with the correct `wix_user_id`, `report_type`, `report_key`, `user_tier`

### Step C — Remove the public PDFs (only after explicit confirmation)

Once Steps A and B are confirmed in production:

- Delete `public/reports/*.pdf` (12 files).
- **Keep** `public/reports/thumbnails/` (12 JPGs) — these remain public card art.
- No migration required (filesystem-only change in the repo).

**Step C acceptance:**
- [ ] `public/reports/` contains only the `thumbnails/` directory
- [ ] `https://app.realinfo.id/reports/Canggu_2025.pdf` returns 404
- [ ] `https://reidbase.lovable.app/reports/Canggu_2025.pdf` returns 404
- [ ] All 12 download flows still work via the Edge Function
- [ ] Memory `mem://features/location-reports` and `mem://features/market-reports` updated to record the new private-bucket flow

## 3. Risks and mitigations

| Risk | Mitigation |
|---|---|
| PDF uploaded with wrong slug → 404 in download flow | Use the exact mapping table in §2 Step A; test one location and one market report end-to-end before uploading the rest |
| Frontend deploy lands before PDFs are uploaded | Do Step A fully before merging Step B |
| Public PDFs deleted before frontend is migrated → broken downloads for everyone | Step C is gated on user confirmation that Steps A and B are verified in production |
| Cached browser links to old `/reports/*.pdf` after deletion | Acceptable — these were public anyway; behaviour after Step C is "not found", not a security regression |
| Tier requirement changes (e.g. allow Member tier to download a free sample report) | Adjust `REQUIRED_TIER` in `supabase/functions/download-report/index.ts` only; no storage changes needed |

## 4. What this plan does NOT do

- Does **not** upload any files (Step A is manual / separate).
- Does **not** modify any source files (Step B is a separate change).
- Does **not** delete any public files (Step C is gated on user confirmation).
- Does **not** change RLS, Storage policies, or the `download-report` function.
- Does **not** touch thumbnails.

## 5. Approval gates

1. You review this plan.
2. You upload the 12 PDFs to the private bucket using the mapping in §2 Step A and confirm Step A acceptance.
3. You approve a frontend PR for Step B; you confirm Step B acceptance in preview and production.
4. You explicitly say "delete public report PDFs" → Step C runs.
