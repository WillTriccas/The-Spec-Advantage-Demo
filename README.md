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

The showcase implementation is complete and locally validated. You can demonstrate the
legacy application, specification workflow, controlled experiment design, sealed
evaluation, and executive dashboard today.

The measured experiment is intentionally **not complete or frozen**. The checked-in
dashboard evidence is illustrative, is labelled `not-evaluated`, and cannot support a
model-performance claim. Before measured execution, named reviewers must approve the
benchmark, exact model and agent versions must be pinned, baseline tags must resolve,
and the repository must be clean.

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

Install JavaScript dependencies with `npm ci`. Repository-level build, test, and check
commands are exposed through the root `package.json`.

## Run the showcase

From PowerShell at the repository root:

```powershell
npm ci
.\scripts\validate.ps1 -DotnetPath dotnet -SkipNpmInstall
Start-Process .\dashboard\dist-single\index.html
```

Validation rebuilds the illustrative evidence and both dashboard bundles, exercises
the JavaScript and .NET test suites, validates both approved specification bundles,
and runs the sealed modernization evaluator. The self-contained dashboard is written
to `dashboard\dist-single\index.html`; it requires no server.

To inspect the experiment matrix and its randomized, interleaved execution order:

```powershell
node benchmark\bin\benchmark.js list-runs --randomized
```

To prepare one raw and one specification-guided workspace without launching a model:

```powershell
$demoRoot = ".prepared\showcase-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"

node benchmark\bin\benchmark.js prepare `
  --run modernization-efficient-raw-r1 `
  --baseline src\legacy-trade-reconciliation `
  --out $demoRoot

node benchmark\bin\benchmark.js prepare `
  --run modernization-efficient-spec-r1 `
  --baseline src\legacy-trade-reconciliation `
  --out $demoRoot
```

Compare the generated files:

- `$demoRoot\modernization-efficient-raw-r1\PROMPT.md`
- `$demoRoot\modernization-efficient-spec-r1\PROMPT.md`
- Each run's `plan.json` and `provenance.json`
- Each isolated `workspace` Git repository

The raw workspace receives only the common task brief. The spec workspace receives the
same brief plus the approved, content-hashed specification.

## Fifteen-minute client walkthrough

### 1. Frame the question (1 minute)

> Can a cheaper, faster coding model guided by a strong engineering specification
> match or outperform a frontier model given only a raw task?

Explain that this is a controlled brownfield experiment, not a claim that a smaller
model is universally better.

### 2. Establish the legacy challenge (2 minutes)

Open `src\legacy-trade-reconciliation\` and highlight:

- The .NET Framework-style solution and legacy project structure.
- `CsvFileGateway.cs`, `MatchingEngine.cs`, and `Program.cs`.
- Embedded reconciliation rules and limited characterization coverage.
- Synthetic trade, settlement, position, and override data.

Connect these characteristics to Financial Services estates: important business rules,
large change risk, unsupported technology, and limited documentation.

### 3. Show how an effective specification is built (3 minutes)

Open `spec-factory\examples\modernization\approved\` and walk through:

- `discovery.json` for brownfield facts and invariants.
- `ambiguities.json` for decisions that must be resolved before coding.
- `requirements.json` and `nfrs.json` for testable outcomes and constraints.
- `acceptance-criteria.json` and `traceability.json` for executable evidence.
- `risks.json`, `signoff.json`, and `manifest.json` for governance and content binding.

Run the quality gate:

```powershell
node spec-factory\bin\spec-factory.js validate `
  spec-factory\examples\modernization\approved
```

The key message is that the specification is a reusable engineering control: it exposes
ambiguity before generation and binds requirements to evidence.

### 4. Explain the controlled comparison (3 minutes)

Run `list-runs --randomized` and show the four lanes:

| Lane | Treatment |
|---|---|
| Efficient/raw | Efficient model with the common task brief |
| Efficient/spec | Efficient model with the brief and approved specification |
| Frontier/raw | Frontier model with the common task brief |
| Frontier/spec | Frontier model with the brief and approved specification |

There are two independent episodes, four lanes, and three repetitions: **24 runs**.
Every run uses a fresh workspace and conversation. Failed and timed-out runs are kept,
and no coding lane can inspect the hidden evaluator.

If time permits, prepare the two example workspaces above and compare `PROMPT.md`,
`plan.json`, and the isolated Git histories.

### 5. Show evaluation and evidence integrity (2 minutes)

Open `evaluator\src\modernization.js` and `benchmark\config\scoring.json`. Explain:

- Quality is scored across functionality, behavior preservation, security,
  maintainability, operability, and traceability.
- Builds, essential business invariants, security findings, maker-checker separation,
  and audit integrity are hard gates where applicable.
- Dependency scanning fails closed, and source patches, Git bundles, transcripts,
  evaluator results, prompts, and configuration are hashed.
- A high aggregate score cannot compensate for a failed hard gate.

### 6. Present the dashboard (3 minutes)

Open `dashboard\dist-single\index.html`.

1. Start with the **Executive** view: hypothesis, claim status, quality medians,
   variability, hard gates, and efficiency.
2. Point out the persistent **Illustrative / Not evaluated** labelling.
3. Switch to the **Engineering** view and drill into lanes, repetitions, score
   dimensions, evidence provenance, and specification-authoring effort.
4. Explain that the same report engine and dashboard will display measured data after
   the frozen 24-run experiment.

Do not present the illustrative values as observed model performance.

### 7. Close on the operating model (1 minute)

The client takeaway is not “always use the smaller model.” It is:

- Specifications make AI delivery testable and reviewable.
- Better context can reduce dependence on frontier-model capability.
- Model selection becomes an evidence-based economic decision.
- The same method can be applied to a representative, non-sensitive client workload.

For a 30-minute session, add a live workspace preparation, compare raw/spec prompts,
show retained failed-run handling, and discuss how the client would replace the
synthetic scenario with one of its own.

## What remains before measured results

The product demonstration is ready. The experiment is not fully finished until these
externally gated steps are completed:

1. Commit the benchmark and create the registered legacy and canonical baseline tags.
2. Replace `unfrozen` with a unique benchmark version.
3. Pin exact model build IDs, agent version/build IDs, and reasoning-effort settings.
4. Record genuine independent scenario, specification, evaluator, and claim approvals
   in `benchmark\config\approvals.json`.
5. Optionally add dated, sourced pricing; without it, monetary efficiency remains
   unavailable rather than zero.
6. Regenerate a clean, blocker-free freeze record.
7. Execute all 24 runs without human remediation.
8. Import every run and publish the measured report and dashboard.

Until those steps are complete, use the showcase to explain the method, controls, and
decision experience—not to claim that the registered hypothesis has been proven.

## Freeze readiness

Measured sessions are deliberately blocked until immutable baseline refs, exact
model/agent builds, reasoning settings, and independent approvals are recorded:

```powershell
node benchmark\bin\benchmark.js freeze --out evidence\freeze-readiness.json
```

The command exits `2` while blockers remain and writes the complete machine-readable
blocker list. It does not launch any model run or silently treat synthetic sign-off
personas as real benchmark approvals.

## Evidence integrity

- All trade data is synthetic.
- Raw lanes cannot see approved specs.
- No benchmark lane can see hidden evaluator material.
- Every run starts from a clean, hashed baseline and a fresh conversation.
- Failed runs are retained.
- Pricing remains unavailable until a dated, approved price source is configured.
- The benchmark and claim rule are frozen before measured model runs begin.
