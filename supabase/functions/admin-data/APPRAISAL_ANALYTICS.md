# Authoritative appraisal analytics

The `appraisal_requests` table is the single source of truth for submitted
appraisals on the analytics dashboard. The `appraisal_submitted` analytics
event is retained as a UX/CTA interaction signal only and is surfaced
separately as "Appraisal CTA events".

## Implementation

`public.admin_analytics_summary(p_from, p_to)` returns:

- `summary.appraisal_requests` — count of `appraisal_requests` rows whose
  `created_at` falls in `[p_from, p_to]`.
- `summary.appraisal_cta_events` — count of `analytics_events` with
  `event_type = 'feature'` and `event_name = 'appraisal_submitted'` in range.
- `summary.appraisal_submissions` — back-compat alias of
  `appraisal_requests` (now sourced from the table, not events).
- `appraisals_by_day` — per-WITA-day request counts from
  `appraisal_requests.created_at`.
- `funnel.appraisal_submitted` — also sourced from `appraisal_requests`.
- `funnel.appraisal_cta_events` — sourced from analytics events.

## Manual verification

1. **Appraisal exists without analytics event still counted**
   - Insert a row directly into `appraisal_requests` with a recent
     `created_at`.
   - Do **not** log an `appraisal_submitted` analytics event.
   - Refresh `/admin/analytics`. The "Appraisal requests" KPI and the
     funnel "Appraisal requests" step must both increment by 1. The
     "Appraisal CTA events" sub-line must remain unchanged.

2. **Analytics event without appraisal row does not inflate the count**
   - Insert one `analytics_events` row with
     `event_type = 'feature'`, `event_name = 'appraisal_submitted'`, recent
     `created_at`. Do not insert into `appraisal_requests`.
   - Refresh `/admin/analytics`. The "Appraisal requests" KPI must not
     change. The "CTA events" sub-line must increment by 1.

3. **Date range respected**
   - Insert an `appraisal_requests` row dated 200 days ago.
   - With the "Last 30 days" preset, the count must not include it.
   - Switch to "Last 12 months", and the count must include it.
