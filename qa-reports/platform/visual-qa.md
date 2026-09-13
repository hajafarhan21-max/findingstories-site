# Premium platform visual QA

**Review date:** 2026-09-13  
**Build reviewed:** production-like output from `npm run build`, served locally from `dist/`  
**Browser:** Playwright Chromium  
**Evidence policy:** text-only report; screenshot binaries are deliberately not committed.

## Results

| Page | Viewport | Result | Major observations |
| --- | --- | --- | --- |
| Homepage (`/index.html`) | 1440 × 1000 | PASS | Hero crop remained legible beneath the dark overlay; serif/sans hierarchy, champagne accents and ivory sections were consistent; discovery controls stayed aligned; project card, service cards, insights CTA, enquiry form and footer rendered without overlap or visible layout shift. |
| Homepage (`/index.html`) | 390 × 844 | PASS | Content collapsed to one column; hero copy and CTAs remained within the viewport; discovery controls stacked correctly; cards and enquiry controls remained readable and tappable; no horizontal overflow was observed. |
| Project listing (`/projects.html`) | 1440 × 1000 | PASS | Breadcrumb, editorial page hero, accessible filter row, Florence card, verification label, image treatment, empty-state container and advisory form followed the shared design system. |
| Sharjah area (`/areas-sharjah.html`) | 1440 × 1000 | PASS | Canonical area context and the single approved Florence relationship rendered coherently; the page did not manufacture additional area inventory or unsupported commercial details. |
| Azizi developer (`/developers-azizi-developments.html`) | 1440 × 1000 | PASS | Developer context, Florence relationship, navigation, card treatment and enquiry route rendered consistently; no unsupported developer claims were visible. |

## Shared interface checks

- **Navigation:** Desktop navigation and CTA remained aligned and readable. Mobile breakpoints expose the dedicated menu control and collapse desktop navigation.
- **Filters:** Controls have visible labels, remain keyboard-addressable, and update URL search parameters through the tested client implementation.
- **Footer:** Discovery, browse, service and advisory destinations remained visible and grouped at both desktop and mobile breakpoints.
- **Forms:** Labels, consent, status region and submit action rendered without clipping. Submission behavior was validated programmatically against the existing `/api/leads` client path; no production lead was submitted during visual QA.
- **WhatsApp:** The footer advisory link remained present. No outbound WhatsApp message was sent.
- **Typography and color:** Italiana/DM Sans pairing, warm ivory surfaces, charcoal text and restrained champagne accents were consistent across reviewed generated pages.
- **Motion and accessibility:** Focus styling and reduced-motion CSS are present. The review did not identify animation-dependent content.

## Florence regression

**PASS — automated and source-level regression, not a new binary screenshot.** The existing `/azizi-florence` server-rendered engine and its production assets were not replaced. The complete test suite covered Florence rendering, verified-fact suppression, asset classification, maps, floor plans, forms, conversion types, attribution, canonical metadata, WhatsApp behavior, lead persistence ordering, duplicate handling and Gmail SMTP notification structure. The clean project alias continues to resolve to the existing Florence handler. No production form submission, database write or social publication was performed as part of this QA pass.

## Human deployment review still required

Before production promotion, an authorised reviewer should repeat the homepage mobile/desktop review through the actual Vercel preview, inspect the live database-backed Florence response using approved production-like records, and confirm real Gmail delivery and WhatsApp destinations without exposing personal data. Mutable pricing, availability, payment-plan and handover facts must be reconfirmed separately.
