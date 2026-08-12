# Benchmark engine

A dependency-free (Node 20+, `node:*` built-ins only) engine that plans,
prepares, imports, scores, aggregates, and reports on the 24-run experiment
defined by `benchmark/config/experiment.json` — 2 episodes ×
4 lanes (efficient/frontier model × raw brief/approved spec) × 3 repetitions.

## Why this exists

The experiment's whole point is a controlled comparison: does an efficient
model given an approved spec (`efficient-spec`) match or beat a frontier
model given only a raw brief (`frontier-raw`)? That only works if:

- every run starts from an identical, hashed baseline snapshot;
- raw lanes structurally cannot see the spec (and vice versa);
- run/report artifacts conform to the committed contracts
  (`contracts/run.schema.json`, `contracts/report.schema.json`);
- costs stay `null` until real, dated pricing is configured
  (`benchmark/config/costs.json`), so a claim is never quietly backed by
  invented dollar figures;
- the pre-registered claim rule (`benchmark/config/scoring.json`'s
  `claimRule`) is evaluated mechanically from scored runs, not asserted by
  hand — and illustrative data can **never** produce anything but
  `"not-evaluated"`.

This engine also incorporates a set of independent design-review corrections
(see "Design-review corrections" below) covering evaluator/author blindness,
per-episode hard gates, non-completed-run handling, per-episode claims with
quality/efficiency verdict separation, spread-aware inconclusiveness, cost as
the primary efficiency metric (including amortized spec-authoring cost), an
explicit execution policy, prepare/import consistency + hash provenance,
pre-registered secondary comparisons, gradeable raw-lane traceability, and
richer cost-config provenance.

## Pipeline

```sh
node bin/benchmark.js list-runs [--randomized]
# Lists all 24 planned runs (episode × lane × repetition), derived purely
# from experiment.json — nothing hardcoded. --randomized additionally stamps
# and sorts by a deterministic, seeded execution order (see
# executionPolicy.runOrder / assignRandomizedOrder in runs.js) so runs are
# interleaved across lanes/episodes rather than executed lane-by-lane.

node bin/benchmark.js prepare --run <runId> --baseline <dir> --out <dir>
# Validates lane -> inputMode -> model tier/id consistency against
# experiment.json (validateRunConsistency), then copies <dir> into an
# isolated workspace under <out>/<runId>/workspace, writes PROMPT.md (the
# raw brief for `raw` lanes, or the rendered approved spec for `spec` lanes
# — never both), a plan.json describing the run, and a provenance.json
# recording task-brief/spec-manifest/scoring-config/experiment-config/
# baseline hashes plus a snapshot of the execution policy in effect.

node bin/benchmark.js import --run-dir <out>/<runId> --execution <execution.json> [--benchmark-version <v>] [--skip-frozen-check]
# Merges plan.json with execution/source/evidence metadata (from
# <execution.json>, produced after the agent actually runs) into a
# contracts/run.schema.json-valid run.json. Failed runs are preserved
# (status: "failed"), never discarded, per executionPolicy.preserveFailedRuns.
# Also validates lane/inputMode/spec-presence and model tier/id consistency
# a second time (post-schema-validation), merges evaluator/costs-config
# hashes and the "frozen versions" actually used (benchmarkVersion,
# baseline ref, pinned agent version, model build id/effort params) into
# provenance.json, and auto-computes execution.estimatedCostUsd from token
# usage + benchmark/config/costs.json (including an amortized spec-authoring
# share for spec-lane runs) unless the caller already supplied a non-null
# value. Any benchmarkVersion other than "unfrozen" requires a clean,
# committed working tree (git status --porcelain) unless --skip-frozen-check
# is passed.

node bin/benchmark.js score --evaluator <evaluator.json> --episode-id <id> [--execution-status <status>] [--input-mode <raw|spec>]
# Requires evaluator.attestation.independentFromSpecAuthors === true (throws
# otherwise — the evaluator must be a disjoint set of people from that
# episode's spec authors). Computes a weighted 0-100 qualityScore from
# evaluator dimension scores and a per-gate state (passed/failed/
# not-applicable) scoped to --episode-id's applicable hard gates
# (benchmark/config/scoring.json's hardGatesByEpisode) — a gate outside the
# episode's applicable set is always "not-applicable", never silently
# "passed". A non-"completed" --execution-status always forces qualityScore
# to 0 and every applicable gate to "failed". --input-mode raw additionally
# surfaces a non-blocking warning if scopeTraceability scored exactly 0 (see
# benchmark/rubrics/scope-traceability.md).

node bin/benchmark.js aggregate --runs <runs.json>
# Groups scored runs by laneId and computes median/min/max quality,
# hard-gate pass count, median elapsed time, and costMedianUsd (null
# whenever any run in the lane has a null cost — currently always, since
# no dated pricing exists yet).

node bin/benchmark.js report --runs <runs.json> --data-kind <illustrative|measured> --out <report.json>
# Builds and validates a full contracts/report.schema.json report, writes
# it to <report.json>, and writes a supplementary, non-contract
# <report>.claim-detail.json alongside it. Illustrative data is hard-forced
# to claim.status "not-evaluated" (and empty episodeClaims/secondaryClaims)
# regardless of the numbers.
```

`<execution.json>` shape for `import`:

```json
{
  "baselineCommit": "<git commit the baseline ref pointed to>",
  "execution": {
    "status": "completed",
    "startedAt": "...", "endedAt": "...", "elapsedSeconds": 0,
    "agentVersion": "...", "toolCalls": 0,
    "inputTokens": null, "outputTokens": null,
    "cachedInputTokens": 0, "reasoningOutputTokens": 0,
    "estimatedCostUsd": null
  },
  "source": { "commit": null, "diffPath": "diffs/<runId>.patch" },
  "evidence": { "directory": "...", "transcriptPath": "...", "evaluatorPath": "..." }
}
```

`estimatedCostUsd: null` in the input is not necessarily what ends up in
`run.json` — `importRun` auto-computes it from `inputTokens`/`outputTokens`
(and `cachedInputTokens`/`reasoningOutputTokens` if present) via
`cost.js`'s `computeCostUsd`, unless the caller supplies an explicit non-null
value (which always wins). The computed value stays `null` until
`benchmark/config/costs.json` carries dated, sourced per-model pricing.

## Design-review corrections

The following independent design-review corrections are implemented. Items
whose full intent would require adding fields to `contracts/run.schema.json`
or `contracts/report.schema.json` (both `additionalProperties: false`, and
out of this engine's ownership scope — see repo-level ownership notes) are
implemented as far as possible using supplementary, non-contract artifacts
(`provenance.json`, `<report>.claim-detail.json`) instead; those spots are
called out explicitly below.

1. **Spec/evaluator author separation + blindness attestation.** Spec
   approval (`spec-factory`'s `signoff.json`) records
   `blindnessAttestation`, `authors`/`reviewers`, `authoringEffort`
   (elapsed/tokens/cost), and the bundle hash; an unattested or
   `false`-attested bundle cannot be approved. The mirror-image check lives
   in `scoring.js`: `scoreRun` throws unless
   `evaluator.attestation.independentFromSpecAuthors === true`.
2. **Per-episode hard gates with explicit states.** `scoring.js` computes
   `gateStates` per gate (`passed`/`failed`/`not-applicable`) scoped by
   `scoring.json`'s `hardGatesByEpisode`; modernization's applicable gates
   are `build`, `essential-business-invariants`,
   `no-critical-security-findings`; audit-feature additionally requires
   `maker-checker-separation` and `audit-integrity`. A gate outside the
   episode's applicable set is always `not-applicable`, never silently
   folded into `passed`.
3. **Non-completed runs always included, score 0, fail applicable gates.**
   `scoreRun` forces `qualityScore = 0` and every applicable gate to
   `failed` whenever `executionStatus !== "completed"`, regardless of what
   the evaluator's raw scores/gate entries say.
4. **Per-episode claims; overall = weakest, never averaged; quality vs.
   efficiency verdict separation.** `claim.js`'s `computeEpisodeClaim`
   returns one claim per episode with a `qualityVerdict`
   (better/equivalent/worse/indeterminate) and a separate `efficiencyVerdict`
   (better/equivalent/worse/unavailable) plus `drivingMetric`.
   `determineClaim` computes one `computeEpisodeClaim` per episode and
   combines them via `weakestStatus` — the overall status is always the
   weaker episode's status, never an average. Comparison-lane hard gates
   are load-bearing; control-lane gate failures are computed and reported
   (`comparisonGatesPassed`/`controlGatesPassed`) but never block a
   comparison-lane "better" result. Because
   `contracts/report.schema.json`'s `claim` object only allows
   `{status, qualityDelta, costSavingPercent, message}`, the full per-episode
   breakdown is returned as `claimDetail` from `buildReport` and written to a
   supplementary `<report>.claim-detail.json` by the CLI's `report` command
   — this richer detail cannot be added to `report.json` itself without a
   `contracts/report.schema.json` change.
5. **Spread-aware inconclusive determination.** Before applying the
   ±margin checks, `computeEpisodeClaim` compares the observed quality delta
   against `max(comparisonLaneSpread, controlLaneSpread)` (each lane's
   `qualityMax - qualityMin`); if the delta doesn't exceed that spread, the
   episode claim is `"inconclusive"` with `qualityVerdict: "indeterminate"`,
   since the difference isn't distinguishable from ordinary run-to-run
   variation. Gate counts and both lanes' quality ranges are included in the
   claim message.
6. **Cost (incl. amortized spec-authoring effort) as primary efficiency
   metric; elapsed-only must be labeled.** `determineEfficiencyVerdict` in
   `claim.js` prefers `costMedianUsd` whenever available for both lanes;
   only falls back to `elapsedMedianSeconds` when cost is unavailable for
   either lane, and always labels that fallback explicitly in the claim
   message (`elapsedOnly: true` / "cost is unavailable ... must not be read
   as a cost comparison"). `cost.js`'s `computeCostUsd` accepts a
   `specAuthoringShareUsd` (via `amortizedSpecAuthoringShareUsd`, dividing
   the spec's one-time authoring cost across `repetitionsPerLane`), which
   `import.js` folds into a spec-lane run's auto-computed cost so the
   comparison reflects the one-time authoring investment amortized across
   its reuse, not just each run's own execution cost.
7. **Explicit execution policy.** `experiment.json`'s `executionPolicy`
   carries `timeoutSeconds`, `toolCallCap`, `runOrder`/`runOrderNotes`, and
   `captureQueueAndThrottleTime`/`queueAndThrottleNotes`; each model entry
   carries `buildId`/`agentVersion`/`effortParams` (pinned, null until dated
   for a frozen measurement). `runs.js`'s `assignRandomizedOrder` stamps a
   deterministic, seeded shuffle (`executionOrder`) onto planned runs so the
   randomized/interleaved order is itself reproducible and auditable rather
   than an unrecorded one-off; `list-runs --randomized` exposes it.
   **Note:** `buildId`/`agentVersion`/`effortParams` are recorded on
   `plan.json` and in each run's `provenance.json` (`frozenVersions`), but
   *not* on `run.json`'s `model` object — `contracts/run.schema.json`'s
   `model` schema only allows `{id, displayName, tier}`
   (`additionalProperties: false`), so `import.js` deliberately trims to
   that subset for the contract-validated artifact.
8. **Prepare/import enforce lane → inputMode → spec-presence and model
   tier/id consistency; hash provenance; frozen-clean-version check.**
   `prepare.js`'s `validateRunConsistency` and `import.js`'s
   `validateImportedRunConsistency` both throw on any lane/inputMode
   mismatch, raw-lane-with-non-null-spec, spec-lane-with-null-spec, or
   model tier/id mismatch against `experiment.json`. `prepareRunWorkspace`
   writes `provenance.json` with task-brief/spec-manifest/scoring-config/
   experiment-config/baseline hashes; `importRun` merges in
   evaluator/costs-config hashes and the frozen versions actually used.
   `assertFrozenForMeasuredData` (called by the CLI's `import` command
   unless `--skip-frozen-check`) requires a clean, committed working tree
   (`git status --porcelain`) for any `benchmarkVersion` other than
   `"unfrozen"`. `list-runs` has no dedicated "list all frozen versions
   used" report yet beyond what each run's `provenance.json` records
   individually — aggregating that across a full measured run set is left
   to whoever assembles the final evidence report, by reading each run's
   `provenance.json`.
9. **Pre-registered secondary within-model spec effects.**
   `scoring.json`'s `secondaryClaimRules` (e.g. comparing `efficient-spec`
   against `efficient-raw` within the same model) are evaluated by
   `claim.js`'s `evaluateSecondaryRule` and returned as `secondaryClaims` —
   informational only, they never gate or average into the primary claim.
   Written to `<report>.claim-detail.json` (again, not `report.json`,
   for the same schema reason as item 4).
10. **Raw-lane scope/traceability gradeable, not ID-presence-only.**
    `benchmark/rubrics/scope-traceability.md` defines "inferred requirement
    coverage" scoring for raw lanes (does the delivered change address the
    same underlying scope a competent reading of the task brief implies,
    even without explicit requirement-ID citations) so raw lanes are
    equally gradeable on this dimension rather than structurally capped
    near 0. `scoring.js` surfaces a non-blocking warning whenever a raw-lane
    run's `scopeTraceability` scores exactly 0, pointing back to the rubric.
11. **Cost config supports cached/reasoning tokens and flat charges;
    pricing provenance required.** `costs.json`'s per-model entries carry
    `pricingAsOf`/`source`/`rateType` plus
    `cachedInputPerMillionTokens`/`reasoningOutputPerMillionTokens`/
    `flatChargeUsd`. `cost.js`'s `computeCostUsd` returns `null` unless the
    base rate provenance is fully present, and additionally returns `null`
    (rather than silently pricing at the base rate) if cached/reasoning
    tokens are reported but their own rate isn't configured.
12. **"Worse" = strictly below the -3 margin, not merely outside it.**
    `computeEpisodeClaim` only returns `qualityVerdict: "worse"` when
    `qualityDelta < -claimRule.equivalentWithinPoints`; this is a strict
    less-than, tested at the exact boundary in `claim.test.js`.

## Claim logic

`benchmark/src/claim.js` computes one claim per episode (comparing that
episode's `efficient-spec` runs against its `frontier-raw` runs, per
`benchmark/config/scoring.json`'s `claimRule`), then combines them via
`weakestStatus` — the overall status is always the *weaker* of the two
episode statuses, never an average:

- **not-evaluated** — illustrative data (always), or an episode has zero
  runs in either lane.
- **not-supported** — the comparison lane failed a hard gate on any run, or
  its median quality is strictly more than `equivalentWithinPoints` below
  the control lane's (i.e. `qualityVerdict: "worse"`).
- **inconclusive** — the quality delta is within the observed within-lane
  spread (not distinguishable from run-to-run noise), or quality is
  non-inferior/better but efficiency (cost, or elapsed-time if cost is
  unavailable) did not favor the comparison lane.
- **supported** — quality is non-inferior or better, all comparison-lane
  hard gates passed, and cost (or, if labeled, elapsed time) was lower for
  the comparison lane.

The full per-episode breakdown (`qualityVerdict`, `efficiencyVerdict`,
`drivingMetric`, gate visibility for both lanes) plus pre-registered
secondary within-model comparisons are in `claimDetail`
(`<report>.claim-detail.json`), not in `report.json`'s schema-constrained
flat `claim` object.

## Testing

```sh
node --test
```

Covers: 24-run planning including randomized-order stamping
(`runs.test.js`), workspace preparation including the raw/spec no-leakage
guarantee, provenance hashing, and lane/model consistency enforcement
(`prepare.test.js`), the hand-rolled schema validator against both contract
schemas (`schema-lite.test.js`), run import including preserved-failure,
baseline/source commit separation, consistency enforcement, provenance
merging, and cost auto-computation/amortization (`import.test.js`), weighted
run scoring, per-episode gate states, the evaluator-blindness requirement,
and non-completed-run forcing (`scoring.test.js`), lane aggregation
including the null-cost rule (`aggregate.test.js`), cost computation
including cached/reasoning-token and flat-charge provenance rules
(`cost.test.js`), per-episode claim outcomes including the spread-based
inconclusive check, the strict "worse" boundary, elapsed-only labeling,
control-gate non-blocking, secondary-rule evaluation, and weakest-status
combination (`claim.test.js`), full report assembly/schema
validation/claim-detail separation (`report.test.js`), and CLI command
wiring end-to-end including prepare→import round-trips and the
frozen-clean-version check (`cli.test.js`).

## Illustrative evidence

See `../evidence/illustrative/` for a fabricated example report
(`dataKind: "illustrative"`, `claim.status: "not-evaluated"`, empty
`episodeClaims`/`secondaryClaims`) used only to exercise the dashboard
before any real runs exist, generated by
`benchmark/scripts/generate-illustrative-evidence.js`.
