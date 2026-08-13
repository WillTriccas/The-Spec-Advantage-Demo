# Evidence

This directory holds benchmark evidence artifacts: reports assembled by the
`benchmark` engine (see `benchmark/src/report.js`) from imported run data,
validated against `contracts/report.schema.json`.

## `illustrative/`

Contains **fabricated, illustrative-only** data (`report.json` and
`claim-detail.json`) used to exercise the dashboard and report contract
before any real benchmark runs have been executed. See
`evidence/illustrative/README.md` for details, and
`benchmark/scripts/generate-illustrative-evidence.js` to regenerate it.

## Measured evidence

No measured evidence has been generated yet. When real runs are executed
(prepared, imported, and scored via the `benchmark` CLI — see
`benchmark/README.md`), their reports must be written with
`metadata.dataKind: "measured"` and placed in a sibling directory such as
`evidence/measured/`, never mixed into `evidence/illustrative/`. The CLI's
`report` command writes both a schema-valid `report.json` and a
supplementary, non-contract `claim-detail.json` alongside it (see
`benchmark/src/report.js`); the same convention applies to measured evidence.

Every report's `overallClaim.status` is derived mechanically by
`benchmark/src/claim.js` from the actual scored runs and the rules in
`benchmark/config/scoring.json`. Per correction item 4, a claim is computed
per episode and the overall status is always the *weaker* of the two episode
statuses (never an average). The report contract carries the executive
episode claims directly, while the full quality/efficiency verdict data,
driving metric, gate visibility, and secondary analyses also live in
`claim-detail.json`. Illustrative reports are hard-coded so the overall and
every episode claim always resolve to `"not-evaluated"` regardless of their
fabricated numbers. This is enforced in code, not just by convention, so
illustrative data can never be mistaken for evidence supporting or rejecting
the benchmark's pre-registered claim.
