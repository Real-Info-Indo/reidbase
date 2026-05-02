# Phase 2 — RLS Lockdown Plan (DRAFT, NOT APPLIED)

Status: **Draft for review.** No migration has been executed. The SQL below
lives in `SECURITY_PHASE2_LOCKDOWN.sql` (outside `supabase/migrations/`) so
it will not be auto-applied. Once you approve, we'll move it into a real
timestamped migration file and run it.

## Goal

Revoke the permissive `USING (true)` / `WITH CHECK (true)` policies on the
9 tables still exposed to `anon`/`authenticated`, now that all owner-scoped
and admin-scoped traffic flows through service-role Edge Functions
(`user-data`, `admin-data`, `admin-mutate`, `shared-conversation`,
`send-appraisal`, `chat-*`, `summarise-conversation`, etc.).

After lockdown, direct `supabase.from(...)` reads/writes from the browser
against these tables will fail. Service-role calls inside Edge Functions
bypass RLS and continue to work.

## Per-table strategy

| Table | After Phase 2 | Rationale |
|---|---|---|
| `analytics_events` | INSERT public kept (write-only beacon). SELECT/UPDATE/DELETE: no policy (denied). | Front-end fires-and-forgets analytics; admin reads via `admin-data`. |
| `appraisal_requests` | All anon/authenticated policies dropped. | Inserts via `send-appraisal` (service role). Admin reads/updates via `admin-data` / `admin-mutate`. |
| `chat_feedback` | INSERT public kept. SELECT dropped. | Frontend can still write feedback rows directly (low-risk, no PII read-back). Admin reads via `admin-data`. NOTE: the atomic counter uses the `increment_chat_feedback_counter` RPC; the row insert path is what this policy covers. |
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
   non-admin direct calls to these 9 tables.
   ```
   rg "supabase\.from\((['\"])(chat_logs|folders|user_profiles|user_sessions|shared_conversations|chat_feedback|chat_flags|appraisal_requests)\1\)" src/
   ```
   (`analytics_events` direct inserts are intentionally retained — see
   `src/lib/analytics.ts`.)
2. Confirm `chat-data-analyst` posture decision (widget vs main app). The
   lockdown does NOT change auth on chat functions; that's a separate
   decision tracked in Phase 1C notes.
3. Confirm in preview that the following flows still work end-to-end:
   - sign-in -> hydrate (chat_logs, folders, user_profiles)
   - send a chat message in each of the 4 modes
   - rename / pin / delete / move-to-folder a conversation
   - feedback (like/dislike/copy + comment)
   - share a conversation, open the public link in incognito
   - submit an appraisal
   - admin pages (chat logs, analytics, appraisals, alerts, users, import)

## Draft SQL (in `SECURITY_PHASE2_LOCKDOWN.sql`)

See sibling file. Each `DROP POLICY` is `IF EXISTS` so the migration is
idempotent. RLS remains enabled on every table.

## Smoke tests AFTER applying

Run from a browser session with NO Wix token (incognito), and verify:

```
// Should all error with new row violates RLS / permission denied:
await supabase.from('chat_logs').select('*').limit(1)
await supabase.from('folders').select('*').limit(1)
await supabase.from('user_profiles').select('*').limit(1)
await supabase.from('user_sessions').select('*').limit(1)
await supabase.from('shared_conversations').select('*').limit(1)
await supabase.from('chat_flags').select('*').limit(1)
await supabase.from('appraisal_requests').select('*').limit(1)
await supabase.from('chat_feedback').select('*').limit(1)
await supabase.from('analytics_events').select('*').limit(1)

// Should still succeed (write-only beacons):
await supabase.from('analytics_events').insert({ event_type: 'test', event_name: 'lockdown_smoke' })
await supabase.from('chat_feedback').insert({ conversation_id: 'smoke', rating: 'like' })
```

Then in the app (logged in):
- hydrate, chat, rename, pin, delete, share, feedback, appraisal,
  admin pages — all should still work because they go through Edge Functions.

## Rollback

If anything breaks, re-run the corresponding `CREATE POLICY ... USING (true)`
from the previous state (preserved in git history, see migrations dated
before `20260501234633`). Lockdown is policy-only, so rollback is fast and
non-destructive.

## Out of scope for Phase 2

- Revoking `EXECUTE` on `public.execute_readonly_query` from anon (separate
  hardening pass; this RPC is already restricted by application code but
  should be locked at the DB layer too).
- Splitting `chat-data-analyst` widget vs main app auth (tracked in 1C notes).
- Removing legacy `wixClient.orders.memberListOrders` path (Phase 2 step 5).
- Cleaning paid PDFs out of `public/reports/` (Phase 2 step 4 sub-item).
