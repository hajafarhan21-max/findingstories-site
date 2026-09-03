# CRM Foundation V1

## Architecture

CRM Foundation extends the existing `leads` record and connects it to users, teams, tasks, opportunities, activities, audit records, saved views, and disabled-by-default assignment rules. Existing RSVP, acquisition, verified inventory, matching, SEO/Search Console, revenue, and admin tables are unchanged. CRM requests are multiplexed through the existing `/api/admin/leads` serverless function to remain within the deployment function limit:

* `GET /api/admin/leads?crm=me`
* `GET /api/admin/leads?crm=leads`
* `GET|POST /api/admin/leads?crm=tasks`
* `GET|POST /api/admin/leads?crm=opportunities`

Every CRM route authenticates an active individual user, resolves permissions from `crm_role_permissions`, and applies a recursive reporting scope. Super administrators receive global scope; everyone else receives their own and all descendant user IDs. Unowned historic leads remain visible so they can be safely triaged.

## Roles and permission defaults

| Role | Operational scope | Default capabilities |
| --- | --- | --- |
| SUPER_ADMIN | All records | All actions on all V1 resources |
| ADMIN | Hierarchy | Lead, opportunity, task administration; reporting, user and audit visibility |
| BUSINESS_HEAD | Hierarchy | Pipeline visibility, assignment and reporting |
| MANAGER | Hierarchy | Lead assignment; opportunity and task management; reporting |
| TEAM_LEADER | Hierarchy | Team lead, opportunity, task, meeting and site-visit operations |
| PROPERTY_ADVISOR | Own records | Lead updates; opportunity/task/meeting/site-visit creation and management |
| MARKETING | Hierarchy | Lead/report visibility and controlled imports |
| OPERATIONS | Hierarchy | Lead/inventory/EOI/booking operations |

Permissions are database rows over resource/action pairs (`view`, `create`, `edit`, `delete`, `assign`, and `export` where granted), not hard-coded role branches. Team and reporting scope further restricts a granted permission.

## Security and deployment

Passwords use salted scrypt hashes. Signed, HTTP-only, Secure, SameSite=Strict cookies expire after eight hours. Login is rate-limited, uses a generic error, updates last login, and writes success/failure audit entries. Mutation routes require a same-origin HTTPS request. SQL values use Neon tagged-template parameters. Password-reset records store token hashes, expiry, and single-use timestamps; outbound reset delivery is deliberately left to the production transactional-email integration.

Run migration `010_crm_foundation.sql` through the controlled production migration job before deploying application code. It contains only additive/idempotent DDL and conflict-safe reference seeds; it neither rewrites nor deletes production data. Then create the first named account without putting its password on a command line:

```sh
CRM_USER_PASSWORD='from-secret-manager' npm run crm:user:create -- admin@example.com 'Named Administrator' SUPER_ADMIN
```

Remove the legacy `ADMIN_PASSWORD` environment variable after cutover. Keep `SESSION_SECRET` at 32 or more random bytes, rotate it to revoke all old sessions, and retain separate production and TEST database credentials. No assignment rule is enabled by the migration.

## V2 roadmap toward benchmark-class scope

1. Add user/team administration UI, permission overrides, reset-email delivery, MFA/WebAuthn, session registry/revocation, and SSO.
2. Add full lead workspace tabs and mutation APIs for profile, qualification, ownership and normalized calls/messages/documents while backfilling historic activity without changing source records.
3. Add task completion, reminder workers, recurring workflows, calendar sync, queues and notifications.
4. Add meeting/site-visit, EOI, payment and booking domain tables tied to opportunities, inventory and the existing revenue ledger.
5. Add a dry-run assignment-rule simulator, availability schedules and concurrency-safe round robin before any production rule can be activated.
6. Add saved-view authoring, sharing, column preferences, bulk actions, guarded import/export jobs and export audit trails.
7. Add hierarchy-scoped advisor/team/source/project dashboards, cohort funnels, targets, forecasting and scheduled reports.
8. Add approved WhatsApp/email/SMS/telephony providers with consent, templates, delivery receipts and immutable communication events.
9. Add automation versioning, approvals, idempotent job execution, dead-letter handling and operational observability.
10. Complete accessibility, mobile workflows, database-level row security evaluation, retention controls, encryption/key rotation, security review and production load/restore drills.

## Generic launch command center

Migration `011_launch_command_center.sql` adds empty, project-agnostic campaign,
project, attribution, EOI, and immutable funnel-history structures. Apply it with
the same controlled production migration job used for `010`; it is additive and
does not seed business records. The authenticated `GET
/api/admin/leads?crm=launch` dashboard excludes TEST rows and applies CRM
reporting hierarchy scope. EOI payment-link and payment-confirmation states are
tracking fields only: the application does not process payments, send messages,
or confirm financial actions automatically.
