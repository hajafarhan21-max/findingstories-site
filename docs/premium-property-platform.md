# Premium property discovery platform

## Audit and delivery priorities

The September 2026 audit found a proven Florence server-rendered funnel, a static corporate homepage, a strict approved-project manifest, database-backed acquisition pages, generated SEO/distribution/authority/operations assets, and a protected `POST /api/leads` workflow. The lead path already persists before background Gmail notification and AI qualification, retains UAE timestamps and human-readable numbering in the database, suppresses duplicate submission IDs, and records first/latest attribution. These systems remain unchanged.

### P0 — revenue blocking

- **Resolved:** discovery pages now use the existing lead endpoint and attach page, CTA, area, developer, project, UTM and first/latest-touch context.
- **Protected:** lead persistence, numbering, Gmail SMTP, qualification, duplicate suppression, Florence form/WhatsApp journey and canonical production host were not replaced.
- **Human dependency:** production database/campaign acceptance and Gmail delivery still require the authorised production environment; never test with real personal data.

### P1 — launch required

- **Resolved:** premium shared design tokens, scalable navigation, homepage discovery, URL-filterable project browsing, neutral comparison, substantive verified area/developer/type hubs, service pages, sitemap relationships, governance schema and brand-first social queue.
- **Resolved:** empty launch categories explicitly refuse to invent inventory and remain useful paths to private advisory rather than thin project claims.
- **Human dependency:** review all copy/creative, confirm asset rights, approve the nine-post brand sequence, and reconfirm mutable Florence commercial facts before campaign publication.

### P2 — optimisation

- Add save/compare persistence only after consent and demand evidence.
- Add more area/developer pages only when each has substantive approved records.
- Measure filter use and qualified-enquiry completion before changing hierarchy or animation.
- Consider responsive image variants for future project imagery.

## Architecture

`platform/catalog.js` is the approved discovery projection. `projects/*/manifest.json` remains the source of truth for project publishing and now supports a strict `platform` governance record. `scripts/generate-platform.mjs` creates deterministic, crawlable HTML; `scripts/generate-seo.mjs` owns registry and sitemap generation. `public/platform.css` is the tokenised visual system and `public/platform.js` provides navigation, URL filter history and lead payload enrichment without a framework.

Azizi Florence remains at `/azizi-florence` with its existing database-driven page engine. `/projects/azizi-florence` is a compatibility alias to that engine; the canonical remains unchanged.

## Adding and publishing content

1. **Project:** create `projects/<slug>/manifest.json`, supply source-reviewed assets, fill `platform`, SEO and distribution fields, and keep status `draft` until review.
2. **Developer or area:** add a catalog entity only after an approved project supplies enough substantive relationship content. Never generate empty locality lists as indexed claims.
3. **Verification:** identify source references, list approved and pending fields, record reviewer/date/confidence, and progress through `DRAFT → RESEARCHED → VERIFIED → APPROVED → PUBLISHED → ARCHIVED`. Only a source-backed, verified record explicitly moved to `PUBLISHED` is exposed publicly.
4. **Generation:** run `npm run platform:generate`, `npm run seo:generate`, the distribution/authority/operations commands, and `npm run brand:generate`.
5. **Social:** review `generated/brand-authority/linkedin-brand-launch.json` in sequence. No adapter posts automatically. Capture approval, rights and public URL outside the generated draft only after a human publishes.

## SEO and acquisition

Every generated route has a stable production canonical, social metadata, breadcrumbs and CollectionPage data where appropriate. The sitemap includes only intentional platform routes and approved projects. Preview noindex logic in the build and dynamic endpoints remains protected. Filters use search parameters, while canonical pages omit query strings.

Forms send to `/api/leads` and retain entry/current page, first/latest touch, UTM values, content source/CTA and contextual area/developer/project fields. Do not add another form backend or client-side notification service.

## Protected systems and deployment checklist

- Do not modify lead numbering, persistence, idempotency, Gmail SMTP variables, qualification or UAE time formatting without dedicated migration and regression review.
- Do not add Resend, auto-publishing, invented commercial fields, fake urgency, ratings, returns or partnerships.
- Run install, lint, typecheck, tests, build and every generator/validator listed in the root task.
- Review homepage and route screenshots at desktop/mobile sizes, then inspect Florence form, WhatsApp and media behaviour independently.
- Deploy only through the existing Git/Vercel flow. Confirm production canonical, robots, sitemap, database health and notification delivery with authorised credentials.
