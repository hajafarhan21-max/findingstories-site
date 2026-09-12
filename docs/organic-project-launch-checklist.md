# Organic Project Launch Checklist

## Purpose

Use this checklist for every approved Finding Stories project. The launch goal is a qualified enquiry—not an indexable URL or pageview. Closely related queries belong on one authoritative project page; create a supporting URL only when it answers a materially different intent with substantial verified information.

## Required verified inputs

1. Project and developer identity, public slug and launch status.
2. Approved brochure, renders and meaningful image descriptions.
3. Location and connectivity facts supported by reviewed material.
4. Residence types, bedrooms and areas.
5. Current pricing, only where verified; otherwise invite a current-price request.
6. Payment plan and handover, only where verified.
7. EOI or booking process, with a clear distinction between an enquiry and an official developer EOI.
8. Availability caveats and project-specific WhatsApp context.

## Manifest workflow

1. Add the verified project record once in `projects/<slug>/manifest.json`.
2. Set `status` to `approved` and `seo.indexable` to `true` only when the public experience is complete.
3. Provide a human title and description, primary intent, a small set of secondary intents, launch status, location, unit summary, hero image/alt text and visible FAQs. Do not duplicate facts already sourced from production inventory.
4. Run `npm run seo:generate`. The approved project then enters the generated registry, sitemap and homepage discovery section automatically.
5. Confirm canonical and schema URLs use `https://www.finding-stories.com`, with no preview hostname.

## Buyer and search quality review

- Group branded, price/payment, product, location, investment-decision and EOI intents on the main page unless a genuinely independent resource is warranted.
- Never publish an empty, placeholder, doorway or keyword-swapped page.
- Include an above-the-fold action, contextual mid-page action, final enquiry form and project-aware WhatsApp message.
- Keep uncertainty explicit: pricing and availability are subject to confirmation, and investment outcomes are not guaranteed.
- Confirm the FAQ is visible whenever FAQ schema is emitted.
- Confirm meaningful images have useful alt text, the hero is prioritised, and below-fold media is lazy-loaded.

## Release QA

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `npm run seo:generate`. Review the homepage, project HTML, sitemap and robots output. Verify one H1, sensible metadata, self-canonical URL, indexability, valid JSON-LD, internal discovery, enquiry attribution and WhatsApp project context. Preview deployments must remain noindex.

Do not resubmit already discovered URLs to Google, use the Indexing API for ordinary property pages, or alter lead persistence, numbering, duplicate suppression, Gmail notification or AI qualification as part of routine SEO work.
