# Entity authority readiness

This repository audit is intentionally conservative. It does not prove a Google Business Profile or any third-party account exists.

## VERIFIED

| Item | Repository evidence | Safe use |
|---|---|---|
| Public name | `Finding Stories` is consistently used by the site and existing Organization/WebSite schema. | Organization name and branded anchors. |
| Production website | `https://www.finding-stories.com` is the canonical origin. | Organization URL and directory website field. |
| Advisory context | Existing reviewed copy describes buyer-focused UAE property information and private advisory support. | Conservative service descriptions. |
| Project identity | Approved manifests supply project name, developer, location, facts and source notes. | Project schema and source-driven external copy. |

## MISSING

- Verified legal entity name and registration details.
- Verified public phone number, email, office address, service area and opening hours.
- Verified Google Business Profile URL and ownership evidence.
- Verified social/profile URLs and account ownership.
- Verified team/author profiles and credentials suitable for public schema.
- Verified reviews or aggregate rating evidence.

`LocalBusiness` / `RealEstateAgent`, postal address, opening hours, reviews and `sameAs` must remain absent until this evidence is supplied and approved. The existing conservative Organization, WebSite and project schema should not be weakened or expanded speculatively.

## HUMAN ACTION REQUIRED

1. The business owner must provide legal/contact data with current documentary evidence and approve which fields are public.
2. An authorized account owner must provide each exact public social or Google Business Profile URL and demonstrate control.
3. A reviewer must compare entity wording across the website and profiles, resolve discrepancies, and record the review date.
4. Only after those gates pass should a developer add corresponding schema fields and test the production rendered JSON-LD.
