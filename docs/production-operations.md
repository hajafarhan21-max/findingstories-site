# Production operations

The **Production Guardian** workflow runs after the repository's Production workflow succeeds and can also be dispatched manually. It checks `/api/health` and public event routes, then runs the authenticated production acceptance journey. The journey creates a uniquely identified synthetic RSVP under the reusable TEST event, verifies its CRM lead, idempotency, capacity, assignment, meeting, site visit, status, activity, report, and CSV export, and archives the synthetic RSVP in a `finally` block.

The acceptance API uses a dedicated machine secret rather than an administrator session. Every read and mutation is constrained by both TEST-event and TEST-RSVP predicates. The guardian stops before acceptance when health fails, preserves both logs as a 14-day artifact, and creates or updates one marker-identified GitHub incident with the failing stage and log tail. A later successful run comments on and closes the open incident.

## Operations-agent decision

An OpenAI Agents SDK layer is intentionally not installed. Health assertions, acceptance interpretation, incident classification, and recovery are deterministic and safer as versioned scripts and GitHub Actions. Adding an LLM would introduce a production secret, cost, latency, and nondeterministic incident handling without improving the constrained workflow. Remediation remains a reviewed code change; the guardian has no database credential, admin session, deployment permission, or unrestricted mutation tool. An advisory agent can be reconsidered if incident volume produces multiple recurring failure classes that cannot be classified deterministically.
