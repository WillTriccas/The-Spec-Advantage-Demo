# ⚠️ Illustrative evidence — not measured, not real

`report.json` in this directory is **entirely fabricated**. It was generated
by a deterministic script that invented plausible-looking quality scores,
elapsed times, and one illustrative hard-gate failure for all 24 planned
runs (2 episodes × 4 lanes × 3 repetitions), purely so the dashboard and
report schema could be exercised end-to-end before any real agent runs
exist.

**No agent has actually attempted either episode's task. No code was
written, reviewed, or evaluated to produce these numbers.**

## How to tell this isn't real

- `metadata.dataKind` is `"illustrative"`.
- `claim.status` is `"not-evaluated"` — and it always will be for
  illustrative data. `benchmark/src/claim.js` short-circuits to
  `not-evaluated` whenever `dataKind === "illustrative"`, before looking at
  any of the (fabricated) scores. This is a code-level guarantee, not just a
  label: illustrative data structurally cannot produce `"supported"`,
  `"not-supported"`, or `"inconclusive"`.
- `claim.qualityDelta` and `claim.costSavingPercent` are `null`.
- Every run's `estimatedCostUsd` is `null` — `benchmark/config/costs.json`
  has no dated pricing configured yet, so costs remain null throughout the
  engine (see `docs/decisions/0001-experiment-contract.md`).

## What this is for

- Verifying the dashboard renders 24 runs across 2 episodes and 4 lanes
  correctly, including a hard-gate failure and a "not-evaluated" claim
  banner.
- Verifying `report.json` validates against `contracts/report.schema.json`.

## What this must never be used for

- Citing as evidence that the efficient-model-with-spec lane is (or isn't)
  non-inferior to the frontier-model-with-raw-brief lane.
- Any claim about cost or time savings.
- Any statement implying real runs were executed.

To regenerate real evidence, run the actual benchmark pipeline (`prepare` →
execute the agent → `import` → `score` → `report --data-kind measured`) as
described in `benchmark/README.md`, and write the resulting report to a
`measured/` directory, not here.
