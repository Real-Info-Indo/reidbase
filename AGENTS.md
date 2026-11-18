# Architecture rules

- Launch campaign totals are aggregated by a service-role-only database function behind the verified Wix admin endpoint, so visitor profiles are never exposed publicly.
- Campaign report downloads are audited when the public report endpoint successfully issues a signed URL, so anonymous requests are counted without trusting client-declared completion or identity.