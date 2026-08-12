# Experiment protocol

## Registered hypothesis

MAI Code 1.1 Flash with an approved specification will achieve equivalent or better software quality than Claude Opus 5 with only the raw task brief, while using less elapsed time or model cost.

The dashboard must not present this statement as a result until measured runs exist.

## Episodes

### Platform modernization

Starting point: frozen .NET Framework 4.6.2-style trade-reconciliation baseline.

Goal: migrate to .NET 8 while preserving domain behavior and improving architecture, testability, security posture, observability, and operational readiness.

### Explainable audit feature

Starting point: frozen canonical .NET 8 baseline.

Goal: add reason-coded exception resolution, maker-checker separation, append-only evidence, concurrency and idempotency safeguards, audit export, telemetry, and sensitive-log protection.

## Run matrix

Each episode has four lanes and three independent repetitions, for 12 runs per episode and 24 runs in total.

The lane controls are:

- Exact baseline commit and archive hash.
- Exact task-brief hash.
- Exact approved-spec hash for spec lanes.
- Fresh workspace and conversation.
- Matching tool permissions and stop rules.
- No human hints, retries, or remediation during scoring.
- Capture of failed, timed-out, and cancelled runs.

Model randomness cannot be fully controlled in an agent environment. Replication and complete failure retention expose that variability rather than hiding it.

## Specification treatment

Raw lanes receive the concise task brief and baseline only.

Spec lanes receive the same brief plus the approved, hashed bundle. Approval requires:

- No unresolved critical ambiguity.
- Testable acceptance outcomes.
- Traceability from requirement to evidence.
- Explicit goals and non-goals.
- Domain invariants and failure behavior.
- Security, operational, migration, and rollback constraints.
- Recorded review identity and timestamp.

## Evaluation

The Quality Index is a weighted score:

| Dimension | Weight |
|---|---:|
| Functional correctness | 35 |
| Domain and behavior preservation | 20 |
| Security and control integrity | 15 |
| Maintainability | 15 |
| Operability and resilience | 10 |
| Scope discipline and traceability | 5 |

Quality is reported separately from elapsed time, token use, tool calls, estimated cost, time to first green build, and rework.

The following are hard gates:

- Build succeeds.
- Essential business invariants pass.
- Maker-checker separation holds where applicable.
- Audit integrity holds where applicable.
- No critical security finding exists.

A high aggregate score cannot compensate for a failed hard gate.

## Claim rule

The pre-registered comparison is the median efficient/spec result against the median frontier/raw result.

- **Equivalent:** efficient/spec is within three Quality Index points and all compared runs pass required hard gates.
- **Better:** efficient/spec is more than three points higher and all compared runs pass required hard gates.
- **More efficient:** equivalent-or-better quality plus lower median cost or elapsed time.
- **Inconclusive:** evidence is missing, inconsistent, or cannot establish the registered comparison.
- **Not supported:** efficient/spec falls outside the quality margin, fails a hard gate, or does not improve either efficiency measure.

Three repetitions demonstrate spread but do not justify claims of statistical generality across all codebases or models.

## Cost handling

Token counts and elapsed time may be reported as observed. Monetary cost is calculated only when:

- Both model prices come from an approved source.
- The source date is recorded.
- Input and output token units are compatible with that source.
- Any platform multipliers or flat charges are explicitly represented.

Unknown cost is displayed as unavailable, never as zero.

## Run evidence

Every imported run retains:

- Run manifest and hashes.
- Model and agent/runtime versions.
- Start, end, and elapsed times.
- Transcript or session export where available.
- Tool and token usage where available.
- Final source commit and patch.
- Build and public-test logs.
- Hidden evaluator output.
- Score calculation and hard-gate state.

The report generator includes all eligible runs and does not select a preferred repetition.

