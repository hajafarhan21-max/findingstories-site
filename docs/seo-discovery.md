# Automated production SEO discovery

The canonical production origin is `https://www.finding-stories.com`. A production audit on 12 September 2026 found that `https://finding-stories.com/` and its Florence path each return a `307` redirect to the same path on `www`; `https://www.finding-stories.com/` and its Florence path return `200` directly. Canonical, Open Graph, schema, sitemap, robots, registry URLs and internal links therefore use only that final host. The Search Console Domain property covers both hostnames and does not determine which application hostname is canonical.

## Launch pipeline

`projects/*/manifest.json` is the source of truth. An approved, indexable manifest must contain its public path, title and description. `npm run build` validates those manifests and generates the project registry plus a standards-compliant sitemap at the existing `/sitemap.xml` location. Adding an approved project through this pipeline therefore requires no separate sitemap edit or Search Console submission. Google can re-read the sitemap already registered for the Domain property.

The sitemap endpoint always includes approved projects and optionally expands with verified, active inventory landing pages. Database failure cannot remove approved projects. APIs, admin pages, tests, aliases, query variants and previews are never registry entries.

## Audit finding

The previous sitemap was a database-gated runtime query. It emitted the homepage plus Florence only when exactly one verified, active project/campaign row existed, then added landing pages only for eligible verified inventory. Production currently returns exactly those two URLs, including Florence; therefore Florence was **not** missing at audit time. The two-page Search Console count reflected that gate and the absence of additional eligible inventory pages, not a sitemap parsing failure.

## Preview and post-deploy checks

Vercel preview sitemap requests return 404 with `noindex`; preview robots disallows all crawling; dynamic pages emit `X-Robots-Tag: noindex, nofollow`; preview build output adds homepage `noindex` and removes its static sitemap. Canonical output remains pinned to production and never uses `VERCEL_URL` or `PUBLIC_SITE_URL`.

Run `npm run seo:verify` after deployment. It first proves that non-`www` redirects to the direct-`200` `www` origin, then checks sitemap, robots and Florence status, host, sitemap membership, canonical and `noindex`. It does not contact Google. Search Console API credentials and the Google Indexing API are intentionally unnecessary.
