# Autonomous project launch runbook

## Minimum human input

Create one upload folder containing the official brochure, masterplan/location map, payment plan, price or unit sheet, and original project renders. Also provide the developer and project name, desired URL, CRM project/campaign identifiers, and (if used) the approved WhatsApp number. Humans do **not** copy public assets or edit HTML.

Every public fact must carry a source reference and `verified: true`. Unknown prices, availability, handover dates, payment terms and location claims stay absent. Approval is not extraction: a reviewer must compare the proposed fact to the source before marking it verified.

## Pipeline and gates

1. Uploads continue through the existing direct-to-Blob project ingestion control, preserving its review queue and additive database behavior.
2. The project agent writes `projects/<slug>/manifest.json`. This is the single project-specific configuration used by generation; developer-specific branches are forbidden.
3. Image decoding inspects magic bytes, MIME, dimensions and corruption with Sharp, then records SHA-256 and a visual difference hash. Semantic assignment requires visual-review classification, confidence, evidence and reviewer identity. Filenames are never classification evidence.
4. `npm run project:qa -- --manifest projects/<slug>/manifest.json` verifies integrity, metadata, semantic slots, exact and perceptual duplicates, lead attribution, and the non-substitution rule. A missing or low-confidence map/masterplan emits `LOCATION_MAP_MISSING_OR_UNVERIFIED` and blocks preview.
5. CI runs lint, typecheck, the existing and pipeline regression suites, and the production build. Only then may preview deployment run. Run the same command with `--preview https://…vercel.app` to verify each deployed asset is HTTP 200 with its declared image MIME. Browser automation must additionally exercise 390px mobile and 1440px desktop, broken-image detection, form validation/submission using TEST data, WhatsApp URL/attribution, and page console errors.
6. A human reviews the Vercel URL and JSON QA report. Promotion to production is a separate explicit approval. The project agent must never use `vercel --prod`, merge a PR, or mutate/delete CRM, project, campaign or lead rows.

After deployment, run `npm run acceptance:project -- --url https://preview.example --path /projects/developer/project --manifest projects/project/manifest.json`. The runner downloads the current deployed bytes and requires their SHA-256, MIME, dimensions, successful decode, rendered role and explicit visual-review classification to match the approved manifest. Historical filenames are never a rejection rule. Changing bytes at a reused URL therefore invalidates approval until the new materialized output is reviewed and its metadata committed. Add `--submit` only in an explicitly approved environment: it submits synthetic `TEST LEAD` data through the real form API and immediately repeats the same UUID to prove idempotency. WhatsApp validation inspects the URL and tracking hook without navigating to it or sending a message.

## Florence reference audit

Florence records the current PR #71 materialized Bardini Park render and Dubai/Sharjah connectivity map by immutable content hash, dimensions and semantic review. Earlier content at those filenames is not authoritative. The live renderer still leaves the visual location position empty rather than falling back to lifestyle, gallery, hero, or another project's imagery when an approved location asset is unavailable.

## Normal operation

`UPLOAD PROJECT MATERIAL → RUN PROJECT AGENT → AUTOMATED INGESTION → MANIFEST/PAGE GENERATION → QA → VERCEL PREVIEW → POST-DEPLOY SMOKE → HUMAN APPROVAL → PRODUCTION`

The command is an implementation/debug escape hatch; normal launches invoke the same agent from the authenticated ingestion UI. Preview credentials must be isolated from Production. Existing lead submission IDs, first/latest-touch attribution, database migrations, campaign gating, and duplicate protection remain authoritative.
