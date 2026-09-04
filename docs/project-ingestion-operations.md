# Project ingestion operations

Apply `database/migrations/013_project_ingestion.sql` once through the normal production migration process before using the control. It is additive and does not update existing business rows.

SUPER_ADMIN users can use **CRM → Project ingestion** to enter sourced project facts and attach PDF, CSV, or XLSX files. CSV/XLSX inventory headers support unit/reference, property type, bedrooms, price ranges, area ranges, price per sqft, handover, payment plan, construction status, and suitability. Files are limited to 10 MB each and retained with SHA-256 provenance.

Every import begins `needs_review`; inventory begins `inactive`, `advisory`, and unverified. Missing facts remain empty and appear as validation issues. An import with issues cannot be approved. Approval changes only that ingestion's project and inventory to verified/active, making it visible to the existing matching, acquisition, dynamic-page, sitemap, and revenue systems. Rejection keeps it inactive. Project and unit identities are deterministically upserted separately for TEST and production.

Google Search Console remains independently configured through its existing importer and credentials. It is not a prerequisite for project ingestion.
