# Architecture rules

- Launch campaign totals are aggregated by a service-role-only database function behind the verified Wix admin endpoint, so visitor profiles are never exposed publicly.
- Campaign report downloads are audited when the public report endpoint successfully issues a signed URL, so anonymous requests are counted without trusting client-declared completion or identity.
- Campaign engagement rates use distinct visiting sessions as their denominator and downloading sessions as the download numerator, so repeat link requests do not inflate conversion.
- Campaign analytics uses a dedicated analytics tab and shared calculation/export helpers, so the platform overview remains separate from launch reporting.