# Phase 2 Security Lockdown — TODO

Phase 1 added the trusted entitlement source of truth (`user_entitlements`),
the admin registry (`admin_users` + `has_admin()`), the private `reports`
storage bucket, and Edge Functions that verify the caller's Wix identity
server-side (`verify-wix-token`, `refresh-entitlements`, `download-report`).

To keep production working while we rewire the rest of the frontend through
new Edge Functions, **the following tables still have permissive
`USING (true)` / `WITH CHECK (true)` RLS policies for `anon` and
`authenticated`**. These MUST be revoked in Phase 2:

| Table | Current state | Phase 2 action |
|---|---|---|
| `analytics_events` | INSERT/SELECT public | Keep INSERT public (write-only beacon), revoke SELECT; admin reads via Edge Function |
| `appraisal_requests` | INSERT/SELECT/UPDATE public | Revoke SELECT/UPDATE; reads/updates via `admin-data` Edge Function only |
| `chat_feedback` | INSERT/SELECT public | Keep INSERT public, revoke SELECT |
| `chat_flags` | INSERT/SELECT/UPDATE public | Revoke SELECT/UPDATE; admin only |
| `chat_logs` | full CRUD public | Revoke all; route through `user-data` (owner) and `admin-data` (admin) |
| `folders` | full CRUD public | Revoke all; route through `user-data` |
| `shared_conversations` | INSERT/SELECT public | Revoke SELECT to non-owner; reads via signed token / Edge Function |
| `user_profiles` | INSERT/SELECT/UPDATE public | Revoke all; route through `user-data` |
| `user_sessions` | full CRUD public | Revoke all; session enforcement via Edge Function |

Tables already locked down in Phase 1 (no anon/authenticated policies):

- `admin_users`
- `user_entitlements`
- `report_downloads`

## Phase 2 checklist

1. Ship Phase 1B/1C/1D Edge Functions (`admin-data`, `admin-mutate`,
   `check-admin`, hardened import / chat / appraisal / session / user-data
   endpoints). Every direct `supabase.from(...)` call against the tables
   above must be replaced with a call to one of these functions before
   lockdown.
   - **Phase 1B (done):** `check-admin`, `admin-data`, `admin-mutate`
     deployed; admin pages (`AdminUsers`, `AdminAnalytics`, `AdminChatLogs`,
     `AdminAppraisals`, `AdminAlerts`, `ImportData`) all rewired off the
     hardcoded password and direct `supabase.from(...)` reads/writes.
     `import-csv` and `import-rentals` now require admin Wix bearer token.
2. Verify with the user that the new flows work end-to-end in preview.
3. Run the lockdown migration that, for each table above:
   - Drops the permissive `USING (true)` / `WITH CHECK (true)` policies.
   - Either disables RLS-exposed access entirely (writes via service-role
     only) or adds restrictive owner/admin policies where direct reads are
     still required.
4. Smoke test:
   - Old direct client reads of `chat_logs`, `user_profiles`, etc. fail with
     RLS errors.
   - All updated app flows still work through the new Edge Functions.
   - Free prompt limit cannot be bypassed by clearing localStorage.
   - Non-admin cannot read `appraisal_requests` or `chat_flags` directly.
   - Paid reports cannot be downloaded without a valid signed URL from
     `download-report`.
   - Paid PDFs are removed from `public/reports/` so direct URLs do not
     bypass entitlement.
5. Remove the legacy `wixClient.orders.memberListOrders` call path from
   the frontend once `refresh-entitlements` is the only tier source.

## Notes

- `public.has_admin(text)` already has `EXECUTE` revoked from
  `PUBLIC`/`anon`/`authenticated`. Only Edge Functions (service role) can
  call it. Do not re-grant.
- `user_entitlements` is the single source of truth for tier checks. Edge
  Functions must call `getEntitlement(wixUserId)` from
  `_shared/entitlements.ts` and never trust a tier sent by the client.
- The `reports` storage bucket is private. The only sanctioned way to
  download is via `download-report`, which issues a 60-second signed URL
  after verifying entitlement.
