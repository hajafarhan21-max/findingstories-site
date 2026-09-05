# Project source uploads

## Architecture and platform constraint

Vercel Functions have a 4.5 MB request-body limit, so increasing the former 10 MB browser constant would not make large ingestion requests reliable. Project sources now use Vercel Blob client uploads:

1. An authenticated `SUPER_ADMIN` selects one or more sources.
2. The browser asks `/api/admin/leads/update?view=project-source-upload` for a short-lived, pathname-scoped token (sharing the existing consolidated CRM function to stay within the Vercel function-count limit).
3. The browser uploads each file directly to **private** Vercel Blob storage with a multipart upload and independent progress/retry state.
4. Project ingestion receives only filename, declared media type, byte size, source kind, and the generated Blob pathname.
5. Before persistence, ingestion retrieves the private object with server credentials, compares Blob metadata, detects its type from file signatures/content, enforces the configured limit, and hashes it for provenance.
6. `project_sources` permanently associates the private storage reference, ETag, SHA-256, original display filename, type, kind, and size with the ingestion/project history. Blob URLs are never returned by the Projects list API.

Legacy base64 ingestion remains available only for files up to 4 MB. This preserves existing small-file callers without pretending the serverless request path supports large bodies.

## Deployment requirements

Before deploying:

- Create/connect a **private Vercel Blob store** for the project.
- Add `BLOB_READ_WRITE_TOKEN` to every applicable Vercel environment (Production, Preview, and local development as needed). It is server-only and must never use a public prefix.
- Apply `database/migrations/015_large_project_sources.sql` before enabling the UI. It makes legacy inline content optional, adds private Blob reference fields, and raises the database metadata limit to 100 MB.
- Optionally override `PROJECT_SOURCE_DOCUMENT_MAX_MB`, `PROJECT_SOURCE_SPREADSHEET_MAX_MB`, `PROJECT_SOURCE_IMAGE_MAX_MB`, and `PROJECT_SOURCE_MAX_FILES`. Defaults are respectively 100, 100, 50, and 20.

The TEST checkbox and database `is_test` boundary are unchanged. Uploading never publishes: every imported project, unit type, and inventory row remains inactive/`needs_review` until an explicit `SUPER_ADMIN` approval.

## Operational notes

- Only PDF, CSV, XLS, XLSX, PNG, and JPEG are authorized. File extensions are a browser convenience; server-side signature/content detection is authoritative.
- Storage pathnames are UUID-based and receive a provider-generated suffix. User filenames are metadata only and never determine a path.
- Each upload is independent. Failed files can be retried or removed without uploading successful files again.
- Removing an uploaded file before submission deletes its staged private Blob.
