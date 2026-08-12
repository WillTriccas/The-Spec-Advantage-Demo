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

## Pipeline

```sh
node bin/benchmark.js list-runs
# Lists all 24 planned runs (episode × lane × repetition), derived purely
# from experiment.json — nothing hardcoded.

node bin/benchmark.js prepare --run <runId> --baseline <dir> --out <dir>
# Copies <dir> into an isolated workspace under <out>/<runId>/workspace,
# writes PROMPT.md (the raw brief for `raw` lanes, or the rendered approved
# spec for `spec` lanes — never both), and a plan.json describing the run.

node bin/benchmark.js import --run-dir <out>/<runId> --execution <execution.json>
# Merges plan.json with execution/source/evidence metadata (from
# <execution.json>, produced after the agent actually runs) into a
# contracts/run.schema.json-valid run.json. Failed runs are preserved
# (status: "failed"), never discarded, per executionPolicy.preserveFailedRuns.

node bin/benchmark.js score --evaluator <evaluator.json>
# Computes a weighted 0-100 qualityScore from evaluator dimension scores
# and checks every benchmark/config/scoring.json hard gate. A missing or
# unlisted gate counts as failed, not passed.

node bin/benchmark.js aggregate --runs <runs.json>
# Groups scored runs by laneId and computes median/min/max quality,
# hard-gate pass count, median elapsed time, and costMedianUsd (null
# whenever any run in the lane has a null cost — currently always, since
# no dated pricing exists yet).

node bin/benchmark.js report --runs <runs.json> --data-kind <illustrative|measured> --out <report.json>
# Builds and validates a full contracts/report.schema.json report and
# determines claim.status via benchmark/src/claim.js. Illustrative data is
# hard-forced to "not-evaluated" regardless of the numbers.
```

`<execution.json>` shape for `import`:

```json
{
  "baselineCommit": "<git commit the baseline ref pointed to>",
  "execution": {
    "status": "completed",
    "startedAt": "...", "endedAt": "...", "elapsedSeconds": 0,
    "agentVersion": "...", "toolCalls": 0,
    "inputTokens": null, "outputTokens": null, "estimatedCostUsd": null
  },
  "source": { "commit": null, "diffPath": "diffs/<runId>.patch" },
  "evidence": { "directory": "...", "transcriptPath": "...", "evaluatorPath": "..." }
}
```

## Claim logic

`benchmark/src/claim.js` compares the pooled `efficient-spec` runs (both
episodes) against the pooled `frontier-raw` runs, per
`benchmark/config/scoring.json`'s `claimRule`:

- **not-evaluated** — illustrative data (always), or either lane has zero
  runs.
- **not-supported** — a hard gate failed anywhere in either lane, or
  `efficient-spec`'s median quality is more than `equivalentWithinPoints`
  below `frontier-raw`'s.
- **inconclusive** — quality is non-inferior, but `efficient-spec` didn't
  show a lower median cost or elapsed time.
- **supported** — quality is non-inferior (or better), all hard gates
  passed, and cost or time was lower.

## Testing

```sh
node --test
```

Covers: 24-run planning (`runs.test.js`), workspace preparation including
the raw/spec no-leakage guarantee (`prepare.test.js`), the hand-rolled
schema validator against both contract schemas (`schema-lite.test.js`),
run import including preserved-failure and baseline/source commit
separation (`import.test.js`), weighted run scoring and hard gates
(`scoring.test.js`), lane aggregation including the null-cost rule
(`aggregate.test.js`), all four claim outcomes including the illustrative
guarantee (`claim.test.js`), and full report assembly/schema validation
(`report.test.js`).

## Illustrative evidence

See `../evidence/illustrative/` for a fabricated example report
(`dataKind: "illustrative"`, `claim.status: "not-evaluated"`) used only to
exercise the dashboard before any real runs exist.
