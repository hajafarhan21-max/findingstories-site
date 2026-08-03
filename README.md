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
| `DATABASE_URL` | Yes* | Neon pooled Postgres connection string with SSL. Takes precedence when both database variables exist. |
| `PRODUCTION_DATABASE_URL` | Yes* | Production-specific Neon connection alias. Either this or `DATABASE_URL` is required. |
| `OPENAI_API_KEY` | Yes for AI scoring | Server-only OpenAI credential. Never prefix it with `VITE_`, `NEXT_PUBLIC_`, or expose it to client code. |
| `OPENAI_MODEL` | No | Responses API model; defaults to `gpt-4.1-mini`. |
| `ADMIN_PASSWORD` | Yes | CRM login password; must be at least 16 characters. |
| `SESSION_SECRET` | Yes | Random secret of at least 32 characters used to sign sessions. Generate with `openssl rand -base64 48`. |

## Database setup

1. Create a Neon project in the same region as the Vercel project where possible.
2. Copy its **pooled** connection string into `DATABASE_URL`, or use `PRODUCTION_DATABASE_URL` for a production-only connection. `DATABASE_URL` wins if both are configured.
3. Either run `psql "$DATABASE_URL" -f database/schema.sql` (substitute the production alias if used), or call `/api/health` once after deployment; the server performs the same idempotent setup.
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

## Vercel preview deployment (do not deploy production)

1. Push branch `codex/add-ai-property-advisor-and-crm-system` to the Git remote and update pull request #1; do not merge it into `main`.
2. In Vercel, connect/import the repository if it is not already connected. Framework preset can remain **Other**. The committed `vercel.json` runs `npm run build` and serves `dist/` as the static output directory; Vercel continues to discover the root `api/` directory as serverless functions.
3. Add every environment variable above to the **Preview** environment only. Do not paste secrets into source files or build arguments.
4. Trigger the Git-based preview by pushing the branch, or install/use the Vercel CLI separately and run `vercel` (not `vercel --prod`) from this branch. The CLI is intentionally not an application dependency.
5. Verify the generated `*.vercel.app` preview: `/api/health`, an adviser submission, each existing form, and `/admin.html` login/lead display.
6. Inspect function logs for status errors only; do not add request-body logging. Delete test leads after acceptance if they contain personal data.

Production deployment requires an explicit later approval, production-scoped environment variables, a privacy/retention review, and a successful preview acceptance test. Never use `vercel --prod` during Phase 1 review.

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
