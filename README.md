# SpecForge: Trade Reconciliation Lab

SpecForge is a client-ready experiment for testing whether a high-quality software specification can let an efficient coding model match or outperform a frontier model on brownfield Financial Services work.

The repository combines:

- A synthetic legacy trade-reconciliation workload.
- A canonical .NET 8 baseline for an independent feature episode.
- A guided, quality-gated specification factory.
- A four-lane, replicated coding-agent benchmark.
- A sealed evaluator and pre-registered scoring rule.
- An executive and engineering evidence dashboard.

The initial model comparison is **MAI Code 1.1 Flash** versus **Claude Opus 5**. Model identities are intentionally visible.

## Experimental design

Each episode runs three repetitions of four lanes:

| Lane | Model | Input |
|---|---|---|
| Efficient/raw | MAI Code 1.1 Flash | Concise task brief |
| Efficient/spec | MAI Code 1.1 Flash | Task brief plus approved spec |
| Frontier/raw | Claude Opus 5 | Concise task brief |
| Frontier/spec | Claude Opus 5 | Task brief plus approved spec |

Episode 1 modernizes an unsupported .NET Framework-style application. Episode 2 adds explainable exception resolution and audit controls to one frozen, canonical .NET 8 baseline.

The benchmark does not assume its conclusion. Measured evidence can report the hypothesis as supported, inconclusive, or not supported.

## Current phase

The benchmark is under construction and is not frozen for model execution. Illustrative dashboard data is for product demonstration only and cannot support a performance claim.

See:

- [Architecture](docs/architecture.md)
- [Experiment protocol](docs/experiment-protocol.md)
- [Facilitator guide](docs/facilitator-guide.md)
- [Benchmark freeze checklist](docs/benchmark-freeze.md)
- [Reviewer independence register](docs/reviewer-register.md)
- [Client adaptation guide](docs/client-adaptation.md)
- [Experiment contract decision](docs/decisions/0001-experiment-contract.md)

## Prerequisites

- Node.js 20 or newer.
- .NET 8 SDK.
- Git.
- Access to the configured coding-agent models for measured runs.

Install JavaScript dependencies with `npm install`. Repository-level build, test, and check commands are exposed through the root `package.json`.

## Evidence integrity

- All trade data is synthetic.
- Raw lanes cannot see approved specs.
- No benchmark lane can see hidden evaluator material.
- Every run starts from a clean, hashed baseline and a fresh conversation.
- Failed runs are retained.
- Pricing remains unavailable until a dated, approved price source is configured.
- The benchmark and claim rule are frozen before measured model runs begin.
