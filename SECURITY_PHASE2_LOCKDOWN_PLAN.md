# Phase 2 — RLS Lockdown Plan (DRAFT, NOT APPLIED)

Status: **Draft for review.** No migration has been executed. The SQL below
lives in `SECURITY_PHASE2_LOCKDOWN.sql` (outside `supabase/migrations/`) so
it will not be auto-applied. Once you approve, we'll move it into a real
timestamped migration file and run it.

## Goal

Revoke the permissive `USING (true)` / `WITH CHECK (true)` policies on the
9 tables still exposed to `anon`/`authenticated`, and harden the
`execute_readonly_query` RPC at the DB layer, now that all owner-scoped
and admin-scoped traffic flows through service-role Edge Functions
(`user-data`, `admin-data`, `admin-mutate`, `shared-conversation`,
`send-appraisal`, `chat-*`, `summarise-conversation`, etc.).

After lockdown, direct `supabase.from(...)` reads/writes from the browser
against these tables will fail. Service-role calls inside Edge Functions
bypass RLS and continue to work.

## Phase 2A — RPC hardening (runs FIRST in the same migration)

`public.execute_readonly_query` is a `SECURITY DEFINER` function used by
the four `chat-*` Edge Functions (and the legacy `chat` function) to run
LLM-generated SQL against `properties_2025` / `rentals_2025`. Even though
it blocks non-`SELECT` statements with a string check, it must not be
callable by anon/authenticated clients directly — that surface area is
exactly what an attacker would target.

Action:
- `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`
- `GRANT EXECUTE ... TO service_role`
- Edge Functions create their Supabase client with the service role key
  (`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`), so `supabase.rpc(...)`
  calls continue to work unchanged.

Verified callers (all service-role):
- `supabase/functions/chat-data-analyst/index.ts`
- `supabase/functions/chat-sales-assistant/index.ts`
- `supabase/functions/chat-marketing-assistant/index.ts`
- `supabase/functions/chat-portfolio-analyst/index.ts`
- `supabase/functions/chat/index.ts` (legacy)

No frontend caller exists.

## Per-table strategy (Phase 2B)

| Table | After Phase 2 | Rationale |
|---|---|---|
| `analytics_events` | INSERT public kept (write-only beacon). SELECT/UPDATE/DELETE: no policy (denied). | Front-end fires-and-forgets analytics; admin reads via `admin-data`. Tracked for future move behind an Edge Function. |
| `appraisal_requests` | All anon/authenticated policies dropped. | Inserts via `send-appraisal` (service role). Admin reads/updates via `admin-data` / `admin-mutate`. |
| `chat_feedback` | All anon/authenticated policies dropped. | Verified: inserts already route through `user-data` `submit_feedback_comment`, and the like/dislike/copy counters use the `increment_chat_feedback_counter` RPC. Public INSERT was a spam/storage abuse vector because of free-text `comment`; now fully behind the Edge Function. |
| `chat_flags` | All anon/authenticated policies dropped. | Inserts happen server-side via moderation in `chat-*` (service role). Admin reads/updates via `admin-data` / `admin-mutate`. |
| `chat_logs` | All anon/authenticated policies dropped. | All reads/writes routed through `user-data` (owner) and `admin-data` (admin). |
| `folders` | All anon/authenticated policies dropped. | Routed through `user-data`. |
| `shared_conversations` | All anon/authenticated policies dropped. | Reads via public `shared-conversation` Edge Function (service role, filtered columns). Writes via `user-data` `share_conversation`. |
| `user_profiles` | All anon/authenticated policies dropped. | Routed through `user-data` (`upsert_profile`, hydrate). |
| `user_sessions` | All anon/authenticated policies dropped. | Routed through `user-data` (`register_session`, `check_session`). |

RLS stays **enabled** on every table. We just drop the permissive policies.
Service-role bypasses RLS, so all Edge Function paths keep working.

## Pre-flight verification (do BEFORE running the migration)

1. Grep the frontend for any remaining direct table access. Expected: zero
   non-analytics direct calls to these 9 tables.
   ```
   rg -P "supabase\.from\((['\"])(chat_logs|folders|user_profiles|user_sessions|shared_conversations|chat_feedback|chat_flags|appraisal_requests)\1\)" src/
   ```
   (`analytics_events` direct inserts are intentionally retained — see
   `src/lib/analytics.ts`.) **Status as of plan v2: clean (zero hits).**

2. Confirm `chat-data-analyst` posture decision (widget vs main app). The
   lockdown does NOT change auth on chat functions; that's a separate
   decision tracked in Phase 1C notes.

3. Confirm in preview that the following flows still work end-to-end:
   - sign-in -> hydrate (chat_logs, folders, user_profiles)
   - send a chat message in each of the 4 modes (this also exercises
     `execute_readonly_query` via service role — Phase 2A check)
   - rename / pin / delete / move-to-folder a conversation
   - feedback (like/dislike/copy + comment) — Phase 2B chat_feedback check
   - share a conversation, open the public link in incognito
   - submit an appraisal
   - admin pages (chat logs, analytics, appraisals, alerts, users, import)

## Phase 2C — Public reports cleanup (separate final step, do not skip)

The `reports` storage bucket is private and `download-report` issues
short-lived signed URLs. However, paid PDFs may still exist under
`public/reports/*.pdf` from before the bucket migration; those URLs would
bypass entitlement entirely.

Required before Phase 2 is considered complete:

1. Confirm every paid PDF currently referenced by `MarketReports`,
   `LocationReports`, etc. is uploaded to the private `reports` bucket
   and downloadable via `download-report`.
2. Inventory `public/reports/`:
   ```
   ls -la public/reports/ 2>/dev/null || echo "no public/reports dir"
   ```
3. Remove any paid PDFs from `public/reports/` (keep only assets that are
   genuinely public, e.g. sample/marketing previews — and document which
   are which in this plan before deletion).
4. Smoke test: previously-known direct URLs return 404; the in-app
   download flow still works for entitled users.

This step is intentionally separate from the SQL migration so it can be
reviewed and executed on its own.

## Draft SQL (in `SECURITY_PHASE2_LOCKDOWN.sql`)

See sibling file. Each `DROP POLICY` is `IF EXISTS` so the migration is
idempotent. RLS remains enabled on every table. Phase 2A (RPC hardening)
runs first in the same migration.

## Smoke tests AFTER applying

Run from a browser session with NO Wix token (incognito), and verify:

```
// Should all error with permission denied / RLS:
await supabase.from('chat_logs').select('*').limit(1)
await supabase.from('folders').select('*').limit(1)
await supabase.from('user_profiles').select('*').limit(1)
await supabase.from('user_sessions').select('*').limit(1)
await supabase.from('shared_conversations').select('*').limit(1)
await supabase.from('chat_flags').select('*').limit(1)
await supabase.from('appraisal_requests').select('*').limit(1)
await supabase.from('chat_feedback').select('*').limit(1)
await supabase.from('analytics_events').select('*').limit(1)

// chat_feedback INSERT should NOW also fail (changed in v2):
await supabase.from('chat_feedback').insert({ conversation_id: 'smoke', rating: 'like' })

// Should still succeed (write-only beacon, intentionally kept):
await supabase.from('analytics_events').insert({ event_type: 'test', event_name: 'lockdown_smoke' })

// Direct RPC call should fail with permission denied (Phase 2A):
await supabase.rpc('execute_readonly_query', { query_text: 'SELECT 1' })
```

Then in the app (logged in):
- hydrate, chat (all 4 modes), rename, pin, delete, share, feedback,
  appraisal, admin pages — all should still work because they go through
  Edge Functions.

## Rollback

If anything breaks, re-run the corresponding `CREATE POLICY ... USING (true)`
from the previous state (preserved in git history, see migrations dated
before `20260501234633`). For Phase 2A, re-grant EXECUTE to
`anon, authenticated`. Lockdown is policy/grant-only, so rollback is fast
and non-destructive.

## Out of scope for Phase 2

- Splitting `chat-data-analyst` widget vs main app auth (tracked in 1C notes).
- Removing legacy `wixClient.orders.memberListOrders` path (Phase 2 step 5).
- Moving `analytics_events` insert behind an Edge Function (deferred;
  current write-only beacon is acceptable, but revisit if abuse appears).

## Changelog

- **v2** (this revision):
  - Added Phase 2A `execute_readonly_query` REVOKE/GRANT step.
  - Moved `chat_feedback` from "keep public INSERT" to fully locked.
  - Added Phase 2C public reports cleanup as an explicit required step.
- **v1**: initial draft.
