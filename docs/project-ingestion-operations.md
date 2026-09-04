# Project ingestion operations

Apply `database/migrations/013_project_ingestion.sql` once through the normal production migration process before using the control. It is additive and does not update existing business rows.

SUPER_ADMIN users can use **CRM → Project ingestion** to enter sourced project facts and attach PDF, CSV, or XLSX files. CSV/XLSX inventory headers support unit/reference, property type, bedrooms, price ranges, area ranges, price per sqft, handover, payment plan, construction status, and suitability. Files are limited to 10 MB each and retained with SHA-256 provenance.

Every import begins `needs_review`; inventory begins `inactive`, `advisory`, and unverified. Unknown optional facts remain empty. Structural contradictions and LIVE_INVENTORY submissions without physical units appear as validation issues and cannot be approved. Approval changes only that ingestion's project and inventory to verified/active, making it visible to the existing matching, acquisition, dynamic-page, sitemap, and revenue systems. Rejection keeps it inactive. Project and unit identities are deterministically upserted separately for TEST and production.

Google Search Console remains independently configured through its existing importer and credentials. It is not a prerequisite for project ingestion.
# Pre-launch projects

Migration `014_pre_launch_projects.sql` is required before deploying this version. It is additive: it adds the project availability/launch fields, classified-source provenance, and `project_unit_types`. It does not update or delete existing inventory or other production data. Existing projects default to `LIVE_INVENTORY`; no unit rows are synthesized.

Use `PRE_LAUNCH` when physical inventory has not been released. Brochures, master plans, floor plans, price lists, payment plans, images, CSV, and XLSX sources may be submitted together. Record only source-supported facts in project fields and unit types. Leave unknown values empty. Every submission remains `needs_review`; only a SUPER_ADMIN can approve or reject it.

The deterministic developer/name key plus environment flag attaches later payment plans and released inventory to the same project. Select `LIVE_INVENTORY` on the later submission and supply real developer unit references. TEST and production identities remain separate.

Verified pre-launch unit types may be used for project/unit-type recommendations and factual SEO pages. They must always be labelled as project/unit-type matches and “unit inventory not released”; they are not evidence that a physical unit is available. The optional `launch_project_id` links an approved project to the existing launch campaign → leads → EOI funnel without creating campaign or EOI records automatically.
