# Finding Stories intelligence, media and newsletter engine

## Governance and data sources

Sources are classified as Tier 1 government/open data, Tier 2 official company, Tier 3 established media/research, or Tier 4 third-party portal/research. Only an explicitly approved Tier 1 feed may automatically create metrics. Every displayed record must retain its source name and URL, source type, retrieval and transformation timestamps, upstream update time when supplied, confidence, and official/third-party status.

The DLD adapter uses the official Dubai Pulse dataset and accepts only owner-configured `DUBAI_PULSE_DLD_API_URL` and `DUBAI_PULSE_TOKEN_URL` values because no undocumented endpoint is assumed. OAuth client credentials are read server-side from `DUBAI_PULSE_API_KEY` and `DUBAI_PULSE_API_SECRET` (plus optional `DUBAI_PULSE_SCOPE`), cached only in memory until shortly before expiry, and never written to generated files or logs. It validates payloads, follows bounded pagination, retries only rate-limit/server failures, uses an eight-second timeout, caps a run at 100 pages, atomically stores the last-known-good snapshot, and returns a visibly stale snapshot after a refresh failure. With no validated snapshot it returns `READY_FOR_CREDENTIALS`/`unavailable` and the UI displays no numeric zero or invented metric. “Today” must remain preliminary while an upstream period is incomplete.

To activate, the owner must obtain legitimate Dubai Pulse application access, set those four required environment variables in the production server/scheduler (not browser configuration), and run `npm run intelligence:generate`. A successful authenticated response is required before health becomes `HEALTHY`; do not manually edit that state. The normalized contract retains source ID, date/type, registration/freehold/usage, area, property type/subtype, amount, transaction/property area, rooms, parking, master project/project, and buyer/seller counts. Missing source fields stay null. Duplicate official source IDs are removed.

Validated datasets of at least five records can generate transaction count/value, median and average transaction value, median and average AED/sqft, community/property-type/apartment-villa activity, and monthly counts/sales value. Every aggregate carries its source, period, generation time, sample size, methodology, freshness, and provenance. Smaller samples and unavailable sources produce no public metric or newsletter observation. Newsletter output remains a review-required draft and is never delivered automatically.

DXBinteract is Tier 4. Its robots file was reviewed on 2026-09-13 and exposes crawl restrictions plus a third-party sitemap; no public integration permission, API, or reusable-data licence was established during this tranche. Finding Stories therefore does not scrape, reproduce charts, or ingest proprietary analytics. An integration remains disabled until the owner supplies written permission or documented API terms.

## Refresh, cache, health and editorial review

Run `npm run intelligence:generate` on an authorized daily scheduler. It writes dated deterministic draft artefacts and source health. Output labels distinguish `FACT`, `CALCULATED_METRIC`, `SOURCE_SUMMARY`, and `EDITORIAL_INTERPRETATION`. Content moves through `DISCOVERED`, `REVIEW_REQUIRED`, `APPROVED`, `PUBLISHED`, `REJECTED`, or `STALE`; public selectors require both approval and publication. Failed sources never break a build and never produce fake zeros. Review remains config/code-driven because no authenticated editorial admin has been approved.

News candidates retain canonical URL, source, dates, category, score, tier, verification and publication state. Editors write an original short Finding Stories summary and link out; full articles are not copied. Approve an article or video by verifying rights, setting `verificationState: APPROVED` and `publicationState: PUBLISHED`, and committing the reviewed record. Material risks must not be hidden under constructive editorial framing.

## YouTube

Only public, embeddable, reviewed videos may pass `approvedEmbeddableVideos`. Cards must retain video title and channel. The browser creates a privacy-enhanced YouTube iframe only after a click. To add the future Finding Stories channel, configure an authorized YouTube Data API key outside Git, query only that channel with embeddable/public filters, retain API metadata, and submit selections for review. No download, rehosting, bulk mirroring or automatic publishing is permitted.

## Newsletter and privacy

`/api/newsletter/subscribe` is separate from `/api/leads`. A valid email and explicit consent are mandatory. Email normalization and a unique database key suppress duplicates; attribution, landing page and UTMs are stored. A cryptographically random unsubscribe token is stored only as a SHA-256 hash. `/unsubscribe` posts the private token to `/api/newsletter/unsubscribe`, which changes the record to `SUPPRESSED`. Re-submission cannot silently override suppression. Delivery is deliberately absent until an authorized sending provider and owner approval exist.

The daily newsletter output is a draft only. Run `npm run intelligence:generate`, review provenance and each content classification, verify external usage rights, then separately approve delivery after infrastructure exists.

## Brand assets

`public/assets/brand/assets.json` is the role registry. Owner-provided artwork is stored as tracked Base64 text and deterministically materialized by `npm run assets:materialize`; generated PNGs remain ignored. Preserve aspect ratio, use the master mark on wide layouts and its unmodified monogram source on the smallest header breakpoint/favicon. The premium banner is approved for selective editorial/social use and must not be cropped or stretched.
