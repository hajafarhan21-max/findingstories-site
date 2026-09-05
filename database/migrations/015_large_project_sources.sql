-- Durable private Blob references replace large BYTEA payloads. Legacy small
-- sources remain readable, while every new large source stays attached by row.
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS storage_url TEXT;
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS storage_etag TEXT;
ALTER TABLE project_sources ALTER COLUMN content DROP NOT NULL;
ALTER TABLE project_sources DROP CONSTRAINT IF EXISTS project_sources_byte_size_check;
ALTER TABLE project_sources ADD CONSTRAINT project_sources_byte_size_check CHECK (byte_size BETWEEN 1 AND 104857600);
ALTER TABLE project_sources DROP CONSTRAINT IF EXISTS project_sources_content_location_check;
ALTER TABLE project_sources ADD CONSTRAINT project_sources_content_location_check CHECK (content IS NOT NULL OR storage_path IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS project_sources_storage_path_unique ON project_sources(storage_path) WHERE storage_path IS NOT NULL;
