# Benchmark freeze checklist

Measured agent runs must not begin until each area below has an identified reviewer and recorded approval.

## Scenario

- Both baselines build in the approved environment.
- Synthetic fixtures are deterministic and contain no customer or personal data.
- Public characterization behavior is stable.
- Episode tasks are credible, bounded, and similar in expected engineering effort.
- Baseline commits and source archives have recorded hashes.

## Specifications

- Raw briefs contain no hidden spec content.
- Approved bundles pass the quality threshold.
- No critical ambiguity remains.
- Requirements map to acceptance evidence.
- Reviewer identity, approval time, and bundle hash are recorded.

## Isolation

- Prepared workspaces include only allowed baseline and prompt content.
- Raw workspaces exclude every spec file.
- All workspaces exclude evaluator source, expected results, prior outputs, and scoring configuration.
- Sessions start without cross-run memory.
- Permissions, tools, and stop rules are equal across lanes.

## Evaluator and scoring

- Hidden checks pass against the relevant canonical baseline.
- Public and hidden checks do not contradict each other.
- Hard-gate semantics are explicit.
- Weights sum to 100.
- Claim thresholds match the registered decision.
- Failed and incomplete runs receive deterministic treatment.
- A blind reviewer rubric has examples and tie-breaking guidance.

## Evidence and presentation

- Run and report artifacts validate against versioned contracts.
- Illustrative data is visibly marked and produces `not-evaluated`.
- Unknown costs render as unavailable.
- Dashboard calculations match benchmark-engine calculations.
- Evidence links cannot escape the evidence root.
- The facilitator guide states limitations and prohibited claims.

## Freeze record

The freeze command must produce:

- Benchmark version.
- Git commit and dirty-state check.
- Baseline refs, commits, and archive hashes.
- Task-brief and spec-bundle hashes.
- Evaluator and scoring hashes.
- Model IDs, repetitions, and execution policy.
- Pricing source date or an explicit unavailable state.
- Reviewer approvals.

Any post-freeze change invalidates the record and requires a new benchmark version before measured runs continue.
