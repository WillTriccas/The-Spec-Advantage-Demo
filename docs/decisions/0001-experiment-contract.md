# Decision 0001: Controlled four-lane benchmark

## Status

Accepted for implementation; not yet frozen for model execution.

## Decision

The demo compares MAI Code 1.1 Flash and Claude Opus 5 in a four-cell design:

- Efficient model with the raw brief.
- Efficient model with the approved spec.
- Frontier model with the raw brief.
- Frontier model with the approved spec.

Each lane runs three times for each of two independent episodes. Episode 1 starts from an immutable legacy baseline. Episode 2 starts from an immutable canonical .NET 8 baseline so that Episode 1 variation cannot contaminate the feature comparison.

Software quality and delivery efficiency remain separate. The pre-registered comparison is efficient/spec against frontier/raw, using a three-point non-inferiority margin and mandatory hard-gate passage.

## Rationale

The four cells isolate the effect of specification quality from model tier. Replication exposes agent variability. Separate baselines make each episode comparable. A pre-registered rule prevents the evaluator from being tuned after outputs are visible.

## Guardrails

- Benchmark agents cannot see approved specs in raw lanes or any hidden evaluator.
- Every run uses a clean workspace and a fresh conversation.
- Failed runs remain in the dataset.
- No human remediation is allowed during a scored run.
- Pricing inputs must be dated and approved before monetary claims are enabled.
- Illustrative data can exercise the dashboard but cannot support the benchmark claim.
