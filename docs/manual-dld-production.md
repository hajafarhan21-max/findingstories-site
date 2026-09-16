# Manual DLD production source

The owner-supplied official Dubai Land Department CSV is the production intelligence source until a separately approved integration exists. No API credentials are required.

Run:

```sh
npm run dld:import -- --file=/secure/path/Transactions.csv --dataset=Transactions --source-url=https://www.dubaipulse.gov.ae/data/dld-transactions/dld_transactions-open-api --reporting-period=YYYY-MM-DD/YYYY-MM-DD
npm run intelligence:generate
npm run build
```

Raw files remain outside Git. A successful import validates and normalizes rows, deduplicates transaction numbers, records row rejections by reason, retains otherwise-unmapped official columns, writes source filename/checksum/import date/reporting period, creates a machine-readable dataset coverage report at `generated/mappings/dld-dataset-coverage.json`, and atomically replaces the last-known-good snapshot. A failed refresh does not delete that snapshot.

The importer supports the official Transactions export fields documented in the coverage artifact. Each additional official subsheet must be imported with its own dataset name; fields without a governed canonical mapping remain in `additionalOfficialFields` and in the coverage report rather than being discarded. Unsupported measures—including ROI, yield, appreciation, forecasts and rankings—are never inferred.
