# Architecture

## Purpose

SpecForge separates scenario creation, specification authoring, agent execution, evaluation, and presentation so that no scored coding agent can inspect or influence its evaluator.

```mermaid
flowchart LR
    A[Legacy baseline] --> P[Run preparer]
    B[Canonical .NET 8 baseline] --> P
    C[Raw task briefs] --> P
    D[Approved spec bundles] -->|Spec lanes only| P
    P --> W[Sanitized agent workspace]
    W --> R[Immutable run artifact]
    R --> E[Sealed evaluator]
    E --> S[Deterministic scorer]
    S --> J[Evidence report JSON]
    J --> X[Executive dashboard]
    J --> Y[Engineering evidence view]
```

## Trust boundaries

### Authoring zone

Contains scenario source, spec-factory assets, scoring configuration, and evaluator source. It is available to benchmark maintainers but never copied wholesale into a scored agent workspace.

### Agent workspace

Contains only the selected baseline, the common task brief, and, for a spec lane, the approved spec bundle. A run-specific manifest records the expected model, lane, repetition, and content hashes. It excludes:

- The other episode baseline.
- Other lane prompts and outputs.
- Hidden evaluator source and expected results.
- Scoring weights and claim logic.
- Prior run conversations or evidence.

### Evaluation zone

Receives the completed run after execution. It applies hidden behavior, control, security, operability, and structural checks. Evaluation output is machine-readable and append-only within the run evidence directory.

### Presentation zone

Consumes generated report JSON. It never recalculates hidden checks and cannot edit weights. It distinguishes illustrative from measured evidence on every decision surface.

## Repository responsibilities

| Path | Responsibility |
|---|---|
| `src/legacy-trade-reconciliation/` | Episode 1 baseline and public characterization fixtures |
| `src/canonical-modernized/` | Frozen Episode 2 baseline |
| `spec-factory/` | Discovery, authoring, review, quality gate, and approved spec bundles |
| `benchmark/` | Run preparation, import, scoring, aggregation, and claim state |
| `evaluator/` | Agent-hidden episode evaluators |
| `evidence/` | Illustrative and measured run artifacts |
| `dashboard/` | Read-only evidence presentation |
| `contracts/` | Versioned run and report schemas |

## Baseline strategy

The two episodes are independent:

- **Modernization** always starts from the legacy baseline tag.
- **Audit feature** always starts from the canonical modernized baseline tag.

This avoids compounding Episode 1 implementation quality into Episode 2 and preserves a fair four-lane comparison.

## Live execution adapters

The benchmark prepares a provider-neutral workspace and prompt bundle. A Copilot/app session adapter can launch that bundle in a clean session with an exact model selection. When direct invocation is unavailable, the same bundle can be exported and its completed workspace imported without changing the scoring path.

