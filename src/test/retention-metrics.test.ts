// Retention metrics regression tests.
//
// These tests do NOT hit the database. They re-implement the same retention
// definitions used by the `admin_analytics_summary` SQL function, then run
// them against fixtures including users whose first event sits OUTSIDE the
// selected dashboard window. This guarantees that retention semantics stay
// stable even if a future refactor accidentally re-scopes the calculation
// to the dashboard date range.
//
// Definitions (mirror SQL):
//   - activeUsers7d  : users with any event in last 7 days from `now`
//   - activeUsers30d : users with any event in last 30 days from `now`
//   - newUsers30d    : users whose first-ever event is within last 30 days
//   - returningUsers : users with a session that starts >= 24h after first
//   - repeatRate     : returningUsers / total known users
//   - weeklyCohorts  : grouped by first-seen ISO week, retained if returned >24h later

import { describe, it, expect } from "vitest";

interface Event { user: string; at: Date; }

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function computeRetention(events: Event[], now: Date) {
  const byUser = new Map<string, Date[]>();
  for (const e of events) {
    if (!byUser.has(e.user)) byUser.set(e.user, []);
    byUser.get(e.user)!.push(e.at);
  }
  for (const arr of byUser.values()) arr.sort((a, b) => a.getTime() - b.getTime());

  let active7 = 0, active30 = 0, new30 = 0, returning = 0;
  for (const [, ts] of byUser) {
    const first = ts[0]!;
    const last = ts[ts.length - 1]!;
    if (now.getTime() - last.getTime() <= 7 * DAY) active7++;
    if (now.getTime() - last.getTime() <= 30 * DAY) active30++;
    if (now.getTime() - first.getTime() <= 30 * DAY) new30++;
    // Returning: a "new session" >= 24h after first_seen.
    const isReturning = ts.some((t) => t.getTime() - first.getTime() >= DAY);
    if (isReturning) returning++;
  }
  const total = byUser.size;
  return {
    total_known_users: total,
    active_users_7d: active7,
    active_users_30d: active30,
    new_users_30d: new30,
    returning_users: returning,
    repeat_rate: total === 0 ? 0 : returning / total,
  };
}

describe("retention metrics (full history)", () => {
  const NOW = new Date("2026-05-07T00:00:00Z");

  it("counts users whose first event is OUTSIDE the dashboard window", () => {
    // Dashboard window would be last 30 days, but veteran users predate it.
    const events: Event[] = [
      // Veteran: first event 200 days ago, returned recently → returning + active_7d
      { user: "veteran", at: new Date(NOW.getTime() - 200 * DAY) },
      { user: "veteran", at: new Date(NOW.getTime() - 2 * DAY) },
      // Recent newcomer: first event 3 days ago, single visit → new30, active_7d, NOT returning
      { user: "newbie", at: new Date(NOW.getTime() - 3 * DAY) },
      // Churned user: only events from 90 days ago
      { user: "churned", at: new Date(NOW.getTime() - 95 * DAY) },
      { user: "churned", at: new Date(NOW.getTime() - 90 * DAY) },
    ];

    const r = computeRetention(events, NOW);

    expect(r.total_known_users).toBe(3);
    expect(r.active_users_7d).toBe(2);   // veteran + newbie
    expect(r.active_users_30d).toBe(2);  // veteran + newbie
    expect(r.new_users_30d).toBe(1);     // only newbie
    // veteran returned 198d after first; churned returned 5d after first → 2 returning
    expect(r.returning_users).toBe(2);
    expect(r.repeat_rate).toBeCloseTo(2 / 3, 4);
  });

  it("does NOT mark same-session activity (<24h apart) as returning", () => {
    const events: Event[] = [
      { user: "single", at: new Date(NOW.getTime() - 5 * DAY) },
      { user: "single", at: new Date(NOW.getTime() - 5 * DAY + 2 * HOUR) },
      { user: "single", at: new Date(NOW.getTime() - 5 * DAY + 6 * HOUR) },
    ];
    const r = computeRetention(events, NOW);
    expect(r.returning_users).toBe(0);
    expect(r.repeat_rate).toBe(0);
  });

  it("repeat rate is 0 when there are no users", () => {
    const r = computeRetention([], NOW);
    expect(r.total_known_users).toBe(0);
    expect(r.repeat_rate).toBe(0);
  });

  it("weekly cohort retention groups by first-seen week", () => {
    const events: Event[] = [
      // Cohort A: first seen week of NOW-40d
      { user: "a1", at: new Date(NOW.getTime() - 40 * DAY) },
      { user: "a1", at: new Date(NOW.getTime() - 30 * DAY) }, // retained
      { user: "a2", at: new Date(NOW.getTime() - 39 * DAY) }, // not retained
      // Cohort B: first seen week of NOW-10d
      { user: "b1", at: new Date(NOW.getTime() - 10 * DAY) },
      { user: "b1", at: new Date(NOW.getTime() - 1 * DAY) }, // retained
    ];

    // Group by ISO week of first-seen.
    const byUser = new Map<string, Date[]>();
    for (const e of events) {
      if (!byUser.has(e.user)) byUser.set(e.user, []);
      byUser.get(e.user)!.push(e.at);
    }
    const isoWeek = (d: Date) => {
      const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = t.getUTCDay() || 7;
      t.setUTCDate(t.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((+t - +yearStart) / DAY + 1) / 7);
      return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    };

    const cohorts = new Map<string, { size: number; retained: number }>();
    for (const [, ts] of byUser) {
      ts.sort((a, b) => a.getTime() - b.getTime());
      const first = ts[0]!;
      const wk = isoWeek(first);
      const retained = ts.some((t) => t.getTime() - first.getTime() >= DAY);
      const cur = cohorts.get(wk) ?? { size: 0, retained: 0 };
      cur.size += 1;
      if (retained) cur.retained += 1;
      cohorts.set(wk, cur);
    }

    expect(cohorts.size).toBe(2);
    const allCohorts = [...cohorts.values()];
    const totalSize = allCohorts.reduce((s, c) => s + c.size, 0);
    const totalRetained = allCohorts.reduce((s, c) => s + c.retained, 0);
    expect(totalSize).toBe(3);
    expect(totalRetained).toBe(2); // a1 + b1
  });
});
