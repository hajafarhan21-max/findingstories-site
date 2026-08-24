# Finding Stories AI — Phase 1

Phase 1 adds a conversational lead adviser and a private, AI-qualified CRM to the existing single-page Finding Stories website without changing its visual identity or removing its Web3Forms delivery.

## Discovered architecture

The original repository was a single 1,343-line static `index.html` with embedded CSS/JavaScript, externally hosted Google Fonts and Unsplash imagery, two HTML forms posting directly to Web3Forms, and WhatsApp/tel links. There was no package manifest, server code, database, test suite, deployment configuration, or authentication. The Git repository had no configured remote. It is now still a static frontend, enhanced by Vercel Node Functions under `api/`.

## Phase 1 architecture

- **UI:** Existing page plus a framework-free, accessible floating adviser (`public/advisor.js` and CSS). It asks one concise question at a time and obtains explicit contact consent.
- **Unified capture:** Adviser and both existing forms call `POST /api/leads`. Existing forms also continue sending to Web3Forms after CRM capture, avoiding disruption to current notifications.
- **Qualification:** The API persists the validated lead first and immediately acknowledges capture. OpenAI qualification then runs with Vercel `waitUntil`, updates the saved row, and uses a clearly labelled deterministic fallback if OpenAI is unavailable. Follow-up dates are calculated server-side from the lead capture date: Hot today, Warm next day, and Cold in three days.
- **Persistence:** Neon serverless Postgres. It is durable, relational, Vercel-friendly, supports indexed CRM queries, and avoids browser storage. The API creates the idempotent schema; `database/schema.sql` is also provided for explicit setup.
- **CRM:** `/admin.html` calls cookie-protected admin APIs. The password is never stored in the browser; an HMAC-signed, HttpOnly, Secure, SameSite=Strict session expires after eight hours.
- **Operations:** `GET /api/health` reports API, database, and OpenAI configuration state without revealing secrets.

## Environment variables

Copy `.env.example` to `.env.local` for local development:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon pooled Postgres connection string with SSL. |
| `OPENAI_API_KEY` | Yes for AI scoring | Server-only OpenAI credential. Never prefix it with `VITE_`, `NEXT_PUBLIC_`, or expose it to client code. |
| `OPENAI_MODEL` | No | Responses API model; defaults to `gpt-4.1-mini`. |
| `ADMIN_PASSWORD` | Yes | CRM login password; must be at least 16 characters. |
| `SESSION_SECRET` | Yes | Random secret of at least 32 characters used to sign sessions. Generate with `openssl rand -base64 48`. |
| `ACCEPTANCE_TEST_SECRET` | Yes for automated production acceptance | A separate random bearer credential (at least 32 characters) accepted only by `/api/acceptance/events`. It cannot create or replace an administrator session. Generate and rotate it independently. |

## Database setup

1. Create a Neon project in the same region as the Vercel project where possible.
2. Copy its **pooled** connection string into `DATABASE_URL`.
3. Either run `psql "$DATABASE_URL" -f database/schema.sql`, or call `/api/health` once after deployment; the server performs the same idempotent setup.
4. Use a dedicated database role and rotate credentials if exposed. Neon backups/retention should match the business privacy policy.

The migration is safe to repeat and preserves existing records. It adds stable submission IDs, capture and qualification timestamps, qualification status/source, and supporting indexes. Existing qualified rows are marked as `completed` with source `legacy`; their original `created_at` is retained as `captured_at`. New rows progress from `pending` to `processing` and then `completed`, with source `openai` or `deterministic_fallback`.

## Local development and checks

```bash
npm install
cp .env.example .env.local     # replace placeholders
npm run dev                    # Vercel CLI serves static files and functions
npm run lint
npm run typecheck
npm test
npm run build
```

Open the website at the URL printed by Vercel CLI, the CRM at `/admin.html`, and health status at `/api/health`.

## Automated production deployment and verification

Vercel's existing GitHub integration is the only production deployment system. Merging to `main` causes Vercel to build and promote the commit using the variables configured in Vercel's Production environment. GitHub Actions neither invokes the Vercel CLI nor reads production credentials, initializes the database, or modifies production data.

After each merge, `.github/workflows/production.yml` runs tests, lint, typecheck, and a production build. It then waits for the Git-triggered deployment by polling `https://finding-stories.com/api/health` for up to ten minutes. Verification succeeds only when the endpoint returns HTTP 200 with `api=ok` and `database=ok`; it also confirms `/open-house` and `/event-admin.html` return their expected HTML. These smoke checks are strictly read-only and never submit, update, or delete client records.

Failures include the last HTTP status and sanitized health states in the Actions log and job summary. No GitHub production secrets are required. The linked Vercel Production environment remains responsible for `DATABASE_URL`, `OPENAI_API_KEY`, `ADMIN_PASSWORD`, and `SESSION_SECRET`; their values must never be copied into Actions or logs. Repository branch protections remain the authority for required pull-request checks.

## Vercel preview deployment

1. Push branch `codex/add-ai-property-advisor-and-crm-system` to the Git remote and update pull request #1; do not merge it into `main`.
2. In Vercel, connect/import the repository if it is not already connected. Framework preset can remain **Other**. The committed `vercel.json` runs `npm run build` and serves `dist/` as the static output directory; Vercel continues to discover the root `api/` directory as serverless functions.
3. Add every environment variable above to the **Preview** environment only. Do not paste secrets into source files or build arguments.
4. Trigger the Git-based preview by pushing the branch, or install/use the Vercel CLI separately and run `vercel` (not `vercel --prod`) from this branch. The CLI is intentionally not an application dependency.
5. Verify the generated `*.vercel.app` preview: `/api/health`, an adviser submission, each existing form, and `/admin.html` login/lead display.
6. Inspect function logs for status errors only; do not add request-body logging. Delete test leads after acceptance if they contain personal data.

Preview deployments must never receive production credentials. Production deploys are owned exclusively by Vercel's Git integration; do not run ad-hoc `vercel --prod` commands from developer machines or GitHub Actions.

## Security and privacy

- Zod validates lengths, types, phone syntax and consent; text is trimmed/sanitised, SQL is parameterised, and output shown by the CRM is HTML-escaped.
- Honeypot spam protection and IP-based best-effort function rate limits protect lead and login endpoints. For higher traffic, Phase 2 should use a shared durable rate limiter such as Vercel KV/Upstash and add Turnstile.
- Admin APIs independently verify a signed session. The HTML route is noindexed, but the API—not obscurity—is the security boundary.
- The CRM returns at most 500 recent records. Access should be limited to authorised staff, with strong unique secrets and periodic rotation.
- Consent text explains the contact channels and storage purpose. Finding Stories must publish/confirm a UAE-appropriate privacy notice, define retention/deletion procedures, and process data-subject requests.
- OpenAI receives lead details for qualification. Confirm the organisation's data-processing settings and privacy terms before production use.

## Recommended Phase 2

1. **Market research agent:** Ingest verified developer feeds, brochures and transaction data into a source-attributed knowledge base; require freshness timestamps and human approval before recommendations.
2. **SEO content agent:** Build keyword/topic clusters from Search Console data, with source citations, UAE compliance review and editorial approval.
3. **Automatic publishing:** Add a CMS staging workflow with drafts, schema markup, previews, approval gates, rollback and scheduled publishing—not unattended direct production posts.
4. **Social generation:** Derive channel-specific posts from approved articles, retain campaign/source IDs, and route all claims and creative through approval.
5. **CRM follow-up agent:** Add lead ownership, statuses, notes, tasks, reminders, audit trails and approved message sequences driven by consent and temperature.
6. **WhatsApp automation:** Use the official WhatsApp Business Platform, approved templates, opt-in/opt-out tracking, delivery webhooks and human handoff.
7. **Daily reporting:** Email/WhatsApp a permission-controlled digest of funnel conversion, response SLA, lead source, overdue follow-ups and data quality—aggregated to avoid unnecessary PII.

## Reusable event RSVP system

The public event page is `/open-house` and the authenticated event CRM is `/event-admin.html`. Schema initialization applies the additive event definitions in `database/migrations/003_event_rsvp.sql` and `004_reusable_events.sql`; it never drops, truncates, or deletes historical event/client records.

The public API chooses an active `OPEN` or `TEST` database event with future capacity, returns its dates and slots dynamically, and rejects expired appointments server-side. If none exists, the form is disabled with “No upcoming event is currently open for RSVP.” Admins can create and configure future events (name, venue/address, dates, hours, duration, capacity, status, active state, developers/projects, description, and test status) without editing source code.

On first initialization only when no test event exists, migration 004 creates **Finding Stories System Test Event** for the next two Dubai calendar days, from 10:00–19:00 in 30-minute slots with capacity 5. It and every RSVP captured against it carry `is_test=true` and are labelled TEST in both UIs and CSV exports. “Archive this event’s synthetic RSVPs” soft-archives only unarchived test records and recalculates their test-event occupancy; it cannot operate on a production event.

Public RSVP submission validates consent and fields, normalises UAE numbers, rate limits by visitor IP, deduplicates within the selected event, and uses a UUID idempotency key. Requested times are not bookings: authenticated staff confirm/reschedule them through the transactionally capacity-safe Postgres function. Qualification uses OpenAI when configured and the deterministic fallback otherwise. CRM status, assignment, attendance, activity, reporting, CSV import, and CSV export remain available per selected event.

### Post-deployment synthetic workflow

Automated verification uses `npm run acceptance:production` with `ACCEPTANCE_TEST_SECRET`. The dedicated endpoint requires that credential and independently constrains every read, update, activity, report, export, and archive query to both a TEST event and an RSVP carrying `is_test=true`. It exposes no admin cookie or session, cannot manage events or import records, and archives only the synthetic RSVP created by that run. The human workflow below remains protected by the unchanged admin authentication.

1. Confirm `/api/health` reports `api=ok` and `database=ok`, then open `/open-house?source=system-test&utm_campaign=reusable-event-e2e`.
2. Confirm the TEST banner, next-two-day date options, half-hour times, and capacity 5. Submit a unique identity such as `FS SYSTEM TEST 2026-08-12 <random suffix>` with a reserved synthetic phone/email; never reuse a client identity.
3. Sign into `/event-admin.html` using `ADMIN_PASSWORD`. The signed session also requires a production `SESSION_SECRET` of at least 32 characters.
4. Select `[TEST] Finding Stories System Test Event`; verify the RSVP, requested slot, qualification, temperature, and `TEST RECORD` label.
5. Assign an RM, confirm the requested slot, verify occupancy increments, reschedule to another future slot, and verify occupancy transfers.
6. Exercise contacted/attended/no-show/follow-up/booked states as required, record an activity, and check the list, calendar, associate reporting, and event-specific CSV export.
7. When finished, use **Event configuration → Archive this event’s synthetic RSVPs**. This soft-archives only `is_test=true` records for that test event; no production or historical records are deleted.
