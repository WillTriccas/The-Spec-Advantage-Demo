# Evidence

This directory holds benchmark evidence artifacts: reports assembled by the
`benchmark` engine (see `benchmark/src/report.js`) from imported run data,
validated against `contracts/report.schema.json`.

## `illustrative/`

Contains **fabricated, illustrative-only** data used to exercise the
dashboard and report schema before any real benchmark runs have been
executed. See `evidence/illustrative/README.md` for details.

## Measured evidence

No measured evidence has been generated yet. When real runs are executed
(prepared, imported, and scored via the `benchmark` CLI — see
`benchmark/README.md`), their reports must be written with
`metadata.dataKind: "measured"` and placed in a sibling directory such as
`evidence/measured/`, never mixed into `evidence/illustrative/`.

Every report's `claim.status` is derived mechanically by
`benchmark/src/claim.js` from the actual scored runs and the rules in
`benchmark/config/scoring.json`. Illustrative reports are hard-coded to
always resolve to `"not-evaluated"` regardless of their (fabricated)
numbers — this is enforced in code, not just by convention — so illustrative
data can never be mistaken for, or misquoted as, support for or against the
benchmark's pre-registered claim.
