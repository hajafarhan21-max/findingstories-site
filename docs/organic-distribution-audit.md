# Organic distribution audit

## Scope and evidence
Reviewed the homepage, approved Florence manifest and runtime template, generated registry, sitemap/robots generator, structured data, project client analytics, enquiry and WhatsApp routes, and repository social/business evidence. This is a repository audit; no backlink or third-party-profile claim is made.

## Current strengths
- The `www` canonical, indexable project route, sitemap and robots automation are established.
- Homepage discovery links to Florence with descriptive copy. Florence has buyer FAQs, contextual sections, `RealEstateListing`, `WebPage`, breadcrumb and FAQ data.
- Verified runtime records supply prices, payment plan and completion; changing commercial facts are not hard-coded.
- The enquiry, brochure/floor-plan request and WhatsApp routes are clear. Existing first/latest-touch UTM capture and conversion telemetry remain intact.

## Findings and priorities
### P0 — revenue/discovery blocking
None found in repository scope. Do not change the lead endpoint or availability gate. Search Console's “Discovered – currently not indexed” is not evidence of a technical block or a guarantee that distribution will cause indexing.

### P1 — launch required
- Social metadata used generic SEO copy and lacked explicit Twitter title/description/image and OG image dimensions. **Resolved.**
- No reviewable, manifest-driven distribution/editorial output or stable UTM set existed. **Resolved.**
- No safe copy-link/project-share surface existed. **Resolved** with direct canonical URLs and UTMs.
- Citation, outreach, editorial and launch governance were not documented. **Resolved** by the accompanying playbooks.
- Conversion naming differs from the requested vocabulary: current equivalents are `page_view`, `cta_click` + conversion, `enquiry_started`, conversion event after success, and `whatsapp`. Preserved to avoid analytics/reporting regression; UTMs distinguish distribution.

### P2 — optimization
- A dedicated hub is not justified with one approved project. The existing substantive homepage Projects surface is the smallest non-thin discovery surface; let future approved manifests populate it.
- No verified corporate social URLs, Google Business Profile URL, office address or service-area evidence exists. Do not add `sameAs`, `LocalBusiness`, address, or GBP integration until owners verify them.
- Brochure/floor plans are request-led; no approved public downloadable brochure is exposed.
- Validate social preview rendering after production deployment and obtain an intentionally composed 1200×630 social asset if editorial review prefers it. The current 1600×900 approved hero is suitable for a large-image preview.

## Safety decision
Organization schema remains address-free and has no invented `sameAs`. No public developer/location hub, auto-publication, directory submission, account creation, backlink claim or relationship claim was added.
