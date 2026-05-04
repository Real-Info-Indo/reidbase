# cleanup-appraisal-uploads

Internal maintenance Edge Function that removes orphaned files from the
private `appraisals` storage bucket.

## What counts as an orphan

A storage object is removed only if **all** of the following are true:

1. Its path is under `appraisal-requests/{requestId}/`.
2. No row in `appraisal_requests.files` references its exact storage path.
3. It is older than the 24-hour grace period (so we never race with an
   in-progress submission that uploaded files but has not yet inserted the
   row).

The function uses the service-role client to bypass RLS for both the
storage listing and the `appraisal_requests` read.

## Authorisation

The function refuses to run unless the caller proves they are internal:

- `x-cleanup-secret` header matches the `APPRAISAL_CLEANUP_SECRET` secret, **or**
- `Authorization: Bearer <service-role key>` (used by pg_cron / pg_net), **or**
- A valid Wix bearer for a user listed in `admin_users`.

It is never safe to expose this endpoint without one of those.

## Setup

1. Add the shared secret in Lovable Cloud → Secrets:
   - Name: `APPRAISAL_CLEANUP_SECRET`
   - Value: any long random string (e.g. `openssl rand -hex 32`).

2. Schedule it. Run the SQL below in Lovable Cloud → SQL editor (NOT as a
   migration, as it embeds the project URL and service-role key):

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   select cron.schedule(
     'cleanup-appraisal-uploads-daily',
     '15 3 * * *', -- 03:15 UTC daily
     $$
     select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-appraisal-uploads',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cleanup-secret', '<APPRAISAL_CLEANUP_SECRET value>'
       ),
       body := '{}'::jsonb
     ) as request_id;
     $$
   );
   ```

   To unschedule later: `select cron.unschedule('cleanup-appraisal-uploads-daily');`

## Manual run

```bash
curl -X POST \
  -H "x-cleanup-secret: $APPRAISAL_CLEANUP_SECRET" \
  https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-appraisal-uploads
```

Response shape:

```json
{
  "ok": true,
  "scanned": 42,
  "deleted": 3,
  "skippedReferenced": 38,
  "skippedYoung": 1,
  "gracePeriodHours": 24,
  "durationMs": 812
}
```
