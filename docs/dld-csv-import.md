# Official DLD CSV ingestion

Finding Stories accepts only owner-supplied official DLD exports or lawfully downloadable Dubai Pulse CSV resources. It never automates CAPTCHA, protected forms, authentication, or anti-bot controls.

## Owner runbook

1. Download the official transaction CSV yourself from DLD or Dubai Pulse.
2. Keep it outside Git (or under `data-import/dld/current/`, where CSV files are ignored).
3. Run `npm run dld:import -- --file=/absolute/path/Transactions.csv --source-url=https://official-download-page`.
4. Review the reported unmapped counts and governed alias files before publishing. Uncertain names remain `UNMAPPED`.

The importer reads 64 KiB chunks, supports UTF-8 BOM, quoted multiline fields, comma/semicolon/tab delimiter validation, strict required headers, malformed-row rejection, deterministic transaction-number deduplication, optional `--start`/`--end` date slicing, progress without row contents, SHA-256 manifests, source health, normalized JSONL, governed aggregates, and a last-known-good snapshot. Raw CSV is never copied into generated output or committed.

Area mappings live in `area-aliases.json`; project mappings live in `project-aliases.json`. Only `EXACT` and owner-reviewed `ALIAS_VERIFIED` project mappings may contribute to project or developer metrics. Each project entry must record its developer, verification date, and verification source.
