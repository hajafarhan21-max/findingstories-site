# Finding Stories intelligence, media and newsletter engine

## Governance and data sources

Sources are classified as Tier 1 government/open data, Tier 2 official company, Tier 3 established media/research, or Tier 4 third-party portal/research. Only an explicitly approved Tier 1 feed may automatically create metrics. Every displayed record must retain its source name and URL, source type, retrieval and transformation timestamps, upstream update time when supplied, confidence, and official/third-party status.

The DLD adapter accepts an owner-configured `DLD_OPEN_DATA_URL`; no undocumented endpoint is assumed. It validates payloads, uses an eight-second timeout, atomically stores the last-known-good snapshot, and returns a visibly stale snapshot after a refresh failure. With no validated snapshot it returns `unavailable` and the UI displays no numeric zero or invented metric. “Today” must remain preliminary while an upstream period is incomplete. Add a UAE source by documenting license and fields, assigning a tier, adding schema/provenance validation, and receiving automation approval before enabling its endpoint.

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
