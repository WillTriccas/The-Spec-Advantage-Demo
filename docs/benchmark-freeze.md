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
- Spec author and reviewer attest they had no access to hidden evaluator source or expected results.
- Spec-authoring elapsed time, model usage, and human review effort are recorded.

## Isolation

- Prepared workspaces include only allowed baseline and prompt content.
- Raw workspaces exclude every spec file.
- All workspaces exclude evaluator source, expected results, prior outputs, and scoring configuration.
- Sessions start without cross-run memory.
- Permissions, tools, and stop rules are equal across lanes.
- Execution order is randomized and interleaved across lanes.
- Time limit, tool-call cap, reasoning-effort policy, agent build, model build IDs, and queue-time handling are pinned.
- Prepared repositories expose no excluded content through Git history or refs.

## Evaluator and scoring

- Hidden checks pass against the relevant canonical baseline.
- Public and hidden checks do not contradict each other.
- Hard-gate semantics are explicit.
- Gate applicability is episode-specific and never inferred from a skipped check.
- Weights sum to 100.
- Claim thresholds match the registered decision.
- Failed and incomplete runs receive deterministic treatment.
- A blind reviewer rubric has examples and tie-breaking guidance.
- Security scanner version, ruleset, and severity mapping are pinned.
- Failed, timed-out, and cancelled runs deterministically score zero and fail applicable gates.

## Evidence and presentation

- Run and report artifacts validate against versioned contracts.
- Illustrative data is visibly marked and produces `not-evaluated`.
- Unknown costs render as unavailable.
- Dashboard calculations match benchmark-engine calculations.
- Evidence links cannot escape the evidence root.
- The facilitator guide states limitations and prohibited claims.
- Episode claims and the weaker-episode roll-up are reproduced independently from report data.
- Spec-authoring effort is included in the efficiency view.

## Freeze record

The freeze command must produce:

- Benchmark version.
- Git commit and dirty-state check.
- Baseline refs, commits, and archive hashes.
- Task-brief and spec-bundle hashes.
- Evaluator and scoring hashes.
- Model IDs, repetitions, and execution policy.
- Pricing source date or an explicit unavailable state.
- Independent scenario, spec, evaluator, and claim-adjudicator approvals.
- Every earlier frozen version that has produced a measured run.

Any post-freeze change invalidates the record and requires a new benchmark version before measured runs continue.

If an evaluator defect is discovered after runs begin, all affected runs are rescored under a new evaluator hash. Partial correction of only selected runs is prohibited.
