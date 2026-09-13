# Organic authority execution system

## Audit and priorities

The existing system already automates approved-project loading, canonical/sitemap/robots generation, homepage discovery, structured data, factual distribution copy, stable `{slug}-project-launch` UTMs and lead attribution. The Florence form, WhatsApp route, durable lead handling, numbering, duplicate suppression, Gmail notification, UAE timestamps and qualification are protected and were not modified.

### P0 — lead/revenue attribution

No repository blocker was found. Existing first/latest-touch attribution and conversion event names remain unchanged. Authority links use the established production canonical and campaign convention.

### P1 — authority execution

- **Resolved:** a reusable evidence-gated target registry distinguishes opportunity, verified target, submission and live citation.
- **Resolved:** deterministic per-project queues, natural anchors, scoring, social/editorial/submission/outreach packs, citation workflow, weekly plan and dashboard-ready counters.
- **Resolved:** unsafe tactics, unsupported facts, preview hosts, internal identifiers, unstable campaigns and false publication states are validated.
- **Evidence blocked:** no verified social/GBP/profile URLs, publisher contacts, directory targets, office/contact/legal facts or relationships exist in repository evidence. Candidates remain `needs_verification`; empty execution queues are safer than invented targets.

### P2 — deliberately deferred

- Live analytics/Search Console/CRM dashboard integration; generated counters use `null` rather than fabricated values.
- A public authority hub while only one approved project exists.
- Organization schema expansion until legal/contact/profile evidence is approved.
- Automated citation checking, because authentication, robots rules, dynamic pages and editorial context require careful human review.
- A bespoke 1200×630 share image pending creative approval; the existing approved hero remains referenced.

## Architecture and lifecycle

`authority/targets.json` is the sole opportunity registry; it is not a claim database. `scripts/generate-authority.mjs` joins it to `loadPublicProjects()`, so the project manifest remains the project source of truth. For every approved, public project with distribution data it creates review-only files under `generated/authority/{slug}/`:

- priority targets and transparent evidence-based score;
- submission and relationship queues (verified targets only);
- social, LinkedIn and editorial assets;
- verified-business-only directory fields;
- relationship-first outreach templates;
- natural brand/project/descriptive/URL anchors;
- empty citation evidence log and a weekly operating plan;
- dashboard-ready operational counters without invented analytics.

Lifecycle terms are strict: **GENERATED** means code produced an asset; **PREPARED** means a human-review asset exists; **VERIFIED** means target evidence was checked; **SUBMITTED** means an authorized human actually submitted it; **PUBLISHED** means a publisher made it public; **LIVE** means the public URL and destination were subsequently verified. No earlier state implies a later one.

## Scoring, safety and revenue

Unverified candidates are unscored. Verified opportunities receive visible factor values for topical/UAE/real-estate/project relevance, buyer intent, editorial legitimacy, discoverability, referral/citation potential, relationship availability, effort and spam risk. No DA/DR value is invented. Tier A is the highest legitimate priority, B is secondary, C is experimental, and Reject is unsafe/irrelevant.

The engine never submits or sends. It rejects manipulative claims/tactics including guaranteed outcomes, false urgency, PBNs, comment/forum spam, irrelevant or bulk link packages, paid dofollow schemes, spun posts, link farms, hacked/hidden links, doorway pages, stuffed anchors and fabricated coverage. Every queued action states buyer intent, landing page, CTA, conversion events, approval owner, evidence and publication verification. UTMs feed the unchanged lead attribution chain.

## Citation verification

A citation record requires source domain, public live URL, destination URL, natural anchor/context, follow/nofollow/unknown, discovered date, last verification date, project, campaign and accurate status. Use only `pending`, `live`, `removed`, `changed` or `unreachable`. Outreach and submission never count as citations. Re-open live citations during the weekly pass.

## HUMAN ACTIONS REQUIRED

| WHAT | WHY | WHERE | INFORMATION REQUIRED | HOW TO VERIFY SUCCESS |
|---|---|---|---|---|
| Verify named targets | Repository evidence does not establish publishers, fit or submission routes. | `authority/targets.json` | Real domain/URL, audience and moderation evidence, current contact/submission route, review date. | Target has evidence fields and passes generation; verification still makes no listing claim. |
| Approve and publish social assets | The repository cannot impersonate an account owner. | Generated `social-pack.json` and verified business account | Exact owned account URL, owner authorization, current fact check, image rights. | Authorized operator records the public post URL; citation is separately verified. |
| Send individual outreach | Sending requires recipient relevance, authorization and human judgment. | Generated queues/templates and verified recipient route | Named recipient, public/consented contact, specific audience value, approved wording. | Operator records sent date and response; no citation is claimed. |
| Submit a legitimate profile/directory entry | Business entitlement and required entity fields are unverified. | Verified target's official submission route | Approved legal/contact/address fields as required, platform terms, submission approval. | Record submission evidence; mark published/live only after public URL inspection. |
| Contact developer, partner, event or journalist | No relationship or representation is evidenced. | Verified official or consented contact route | Identity, relationship basis, permissions, tailored audience rationale. | Written response/permission is retained and any public wording is checked. |
| Supply entity evidence | Conservative schema cannot support GBP/LocalBusiness/`sameAs` yet. | Entity readiness checklist and later reviewed schema change | Legal identity, registration, public phone/email/address/hours, exact controlled URLs. | Owner approval plus production JSON-LD/profile consistency test. |
| Monitor Search Console and revenue | Private live systems are not available to static generation. | Search Console and existing safe reporting | Weekly date range, project/campaign filters, referral source and downstream lead disposition. | Record index/performance data and trace qualified enquiries without exposing personal/internal IDs. |
| Verify citations | Preparation or submission is not publication. | `citation-log.json` operator record | Public URL, destination, context, attribute and dates. | Open the page and confirm the evidence; recheck weekly. |

Never auto-post, auto-submit, mass-email, scrape private contacts, invent accounts/relationships, use third-party assets without permission, or buy/manipulate links.
