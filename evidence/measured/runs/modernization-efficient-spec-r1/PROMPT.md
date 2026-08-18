# Task: Modernize the trade reconciliation app

Modernize the checked-in `LegacyTradeReconciliation.exe` batch application from
.NET Framework 4.6.2 to .NET 8. Preserve its externally observable reconciliation
behavior, command-line inputs, synthetic CSV input formats, and four output files:
`matched-trades.csv`, `break-queue.csv`, `end-of-day-report.txt`, and
`run-ledger.csv`.

The application accepts a business date, input directory, and output directory.
It ingests trades, positions, settlements, and manual overrides from CSV files.
Trade Operations depends on the current matching, tolerance, override, duplicate,
and idempotent-rerun behavior, including stable output schemas.

Improve the design, testability, security posture, and operability where practical,
and add meaningful automated tests. Do not add unrelated product features.

Keep a candidate-root `benchmark-adapter.json` that validates against
`contracts/candidate-adapter.schema.json`. The adapter must expose shell-free
build, test, and run command arrays; use the `{businessDate}`, `{inputDirectory}`,
and `{outputDirectory}` placeholders; and declare every output file. External
evaluation will interact with the candidate only through that adapter and the
observable files it produces.

---

# Approved specification

# Platform modernization

Spec ID: `modernization-approved`

## Intent

The checked-in synthetic trade reconciliation batch is an old-style .NET Framework 4.6.2 console application with synchronous CSV I/O, static configuration, monolithic orchestration, and sparse characterization coverage. It must move to .NET 8 without changing the reconciliation behavior or file contracts that downstream operations depend on.

**Goals**
- Port LegacyTradeReconciliation.exe to .NET 8 while preserving observable results.
- Preserve the business-date, input-directory, and output-directory command contract.
- Preserve trade, position, settlement, override, duplicate, and idempotent-rerun behavior.
- Introduce maintainable boundaries, meaningful automated tests, and operational diagnostics.
- Expose a schema-valid benchmark adapter for black-box evaluation.

**Non-goals**
- Changing reconciliation tolerances or business rules.
- Changing synthetic CSV input schemas or the four output file schemas.
- Adding the maker-checker audit feature from the separate audit episode.
- Adding a database, UI, message broker, or cloud-hosting dependency.

**Success metrics**
- The hidden and public golden-master fixtures produce behaviorally equivalent outputs.
- Every legacy business invariant documented in discovery has automated coverage.
- The solution builds and tests on the pinned .NET 8 SDK.
- benchmark-adapter.json validates and drives build, test, and run without shell commands.
- No critical static or dependency security finding remains.

**Stakeholders**
- Synthetic Trade Operations persona
- Synthetic Platform Engineering persona
- Synthetic Reconciliation Engineering persona

## Brownfield discovery

LegacyTradeReconciliation.exe is a synthetic .NET Framework 4.6.2 batch application. It loads trades.csv, positions.csv, settlements.csv, and manual-overrides.csv for a business date; normalizes and reconciles the records; then writes matched-trades.csv, break-queue.csv, end-of-day-report.txt, and run-ledger.csv. Public characterization tests cover the baseline and override/idempotency paths.

**Components**
- Program.cs and RunRequest.cs parse the positional business-date, input-directory, and output-directory contract.
- ReconciliationBatch.cs synchronously orchestrates loading, matching, overrides, reports, and ledger updates.
- CsvFileGateway.cs parses and writes all CSV data using legacy schemas.
- MatchingEngine.cs implements normalization, duplicate detection, candidate selection, and tolerances.
- EndOfDayReporter.cs produces matched, break, and summary outputs.
- RunLedgerStore.cs implements same-date exact-input rerun detection.
- BatchConfiguration.cs reads externally configurable position, quantity, and settlement amount tolerances.

**Data flows**
- trades.csv, positions.csv, settlements.csv, and manual-overrides.csv flow through CsvFileGateway into ReconciliationBatch.
- MatchingEngine emits matched rows and breaks; override handling may convert eligible breaks into matched rows while retaining override evidence.
- EndOfDayReporter writes three result files and RunLedgerStore writes run-ledger.csv.
- benchmark-adapter.json supplies evaluator-owned input and output directories through command placeholders.

**Constraints**
- Target runtime is .NET 8.
- The three positional CLI arguments and four declared output paths must remain externally usable.
- Input and output CSV schemas must remain compatible with the legacy characterization fixtures.
- All data is synthetic and file-based; no database or network service is required.
- A raw lane and a spec lane are both evaluated only through the public benchmark adapter.

**Known behaviors to preserve**
- Account, instrument, and currency comparisons use trimmed uppercase values.
- The first occurrence of a trade identifier is canonical; later duplicates become breaks.
- Position and settlement candidates must agree on account, instrument, settlement date, and currency before tolerance checks.
- Position quantity, settlement quantity, and settlement amount use separate inclusive tolerances.
- Non-positive trade quantities and net amounts are always breaks.
- Manual overrides can resolve only breaks with concrete counterpart candidates.
- Suppressed breaks remain evidenced in matched-trades.csv.
- Exact-input same-date reruns are idempotent and do not duplicate ledger entries.
- Only the first override for a trade may apply; later duplicate instructions become stale-override breaks.

## Ambiguity and assumption review

- **[critical] AMB-1** — Whether modernization may replace the positional CLI and output file contract was unclear. → Resolution: The public CLI semantics and all four output paths are compatibility boundaries. Internal architecture may change, but benchmark-adapter.json must continue to invoke the candidate with evaluator-owned date/input/output values. (resolved)
- **[critical] AMB-2** — Whether duplicate override rows can be silently deduplicated was unclear. → Resolution: They cannot. The first eligible override may apply; every later override targeting that trade must surface as a stale override. (resolved)
- **[major] AMB-3** — Whether output equality means byte identity or semantic compatibility was unclear. → Resolution: CSV headers, row meaning, invariant formatting, summary values, and ledger idempotency are mandatory. Deterministic ordering is required so identical reruns are byte-identical. (resolved)
- **[minor] AMB-4** — Whether the separate audit-feature workflow should be included in this episode was unclear. → Resolution: It is explicitly out of scope; the canonical .NET 8 baseline for that feature is independent of modernization outputs. (resolved)

## Requirements

- **REQ-1** (testable=true): The candidate must target .NET 8 and provide shell-free build and test commands through benchmark-adapter.json.
- **REQ-2** (testable=true): The candidate must preserve trimmed-uppercase account, instrument, and currency matching and treat only the first occurrence of a trade identifier as canonical.
- **REQ-3** (testable=true): The candidate must preserve counterpart eligibility, separate inclusive tolerances for position quantity, settlement quantity, and settlement amount, and unconditional breaks for non-positive trade quantity or net amount.
- **REQ-4** (testable=true): Manual overrides may resolve only a break with concrete counterpart candidates; an applied override must remain evidenced, and later duplicate override instructions must be emitted as stale overrides.
- **REQ-5** (testable=true): Every run must write matched-trades.csv, break-queue.csv, end-of-day-report.txt, and run-ledger.csv with stable schemas, invariant formatting, and deterministic ordering.
- **REQ-6** (testable=true): An exact-input rerun for the same business date must reproduce the same result files without duplicating output rows or adding a duplicate ledger entry.
- **REQ-7** (testable=true): benchmark-adapter.json must validate against contracts/candidate-adapter.schema.json, substitute evaluator-owned business date/input/output paths, declare all four outputs, and accept the candidate's documented successful exit codes.

## Domain invariants

- **INV-1**: Each canonical trade is accounted for as matched or broken, and each later duplicate trade identifier is broken rather than silently dropped. (_enforced at: Matching classification and golden-master tests._)
- **INV-2**: A counterpart is eligible only after normalized account, instrument, settlement date, and currency agree; tolerance checks cannot bypass identity compatibility. (_enforced at: Candidate selection before tolerance evaluation._)
- **INV-3**: An override cannot create a match when no concrete position or settlement candidate exists. (_enforced at: Override eligibility validation before matched output is written._)
- **INV-4**: An identical rerun cannot create duplicate business output or duplicate ledger history. (_enforced at: Run fingerprinting, deterministic report generation, and rerun tests._)

## Non-functional requirements

- **NFR-1** [performance]: Modernization must not introduce an obvious batch-throughput regression. (target: The evaluator fixture completes within the configured evaluator timeout on the same host.)
- **NFR-2** [maintainability]: Business rules must be testable without relying exclusively on end-to-end file execution. (target: Automated tests cover normalization, tolerances, duplicates, overrides, and reruns.)
- **NFR-3** [operability]: Failures must produce a non-success outcome and actionable diagnostics. (target: Missing or malformed inputs do not produce success-shaped output.)
- **NFR-4** [security]: The candidate must use supported dependencies and avoid committed secrets or unsafe execution/deserialization patterns. (target: No critical static or dependency finding.)
- **NFR-5** [observability]: Each run should expose operational counts without logging full trade, position, settlement, or override payloads. (target: Diagnostics contain dates, identifiers, and counts only.)

## Risks

- **RISK-1** (likelihood=medium, impact=high): A clean redesign may omit undocumented legacy edge behavior. — Mitigation: Run public characterization and evaluator-owned golden fixtures against observable outputs.
- **RISK-2** (likelihood=medium, impact=high): Duplicate trades or overrides may be silently deduplicated by modern collection choices. — Mitigation: Preserve input order and test every duplicate row as separately accounted evidence.
- **RISK-3** (likelihood=medium, impact=high): A changed CLI or output path can pass unit tests while breaking external operation. — Mitigation: Treat benchmark-adapter.json and its declared outputs as acceptance-test boundaries.
- **RISK-4** (likelihood=medium, impact=medium): Rerun handling may append duplicate ledger rows or stale prior output. — Mitigation: Execute same-date exact-input reruns and compare every declared output.

## Acceptance criteria

- **AC-1** (REQ-1, testable=true)
  - Given a clean candidate workspace with the pinned .NET 8 SDK
  - When the adapter build and test commands run
  - Then both commands finish with declared allowed exit codes
- **AC-2** (REQ-2, testable=true)
  - Given records whose account, instrument, and currency vary only by case or surrounding whitespace
  - When reconciliation runs
  - Then the records are compared using trimmed uppercase values
- **AC-3** (REQ-2, testable=true)
  - Given two trade rows with the same trade identifier
  - When reconciliation runs
  - Then the first row is canonical and every later row is reported as a duplicate break
- **AC-4** (REQ-3, testable=true)
  - Given eligible counterpart records exactly on each configured tolerance boundary
  - When reconciliation runs
  - Then the closed-interval comparisons accept the boundary values
- **AC-5** (REQ-3, testable=true)
  - Given a trade with non-positive quantity or net amount
  - When counterpart records otherwise appear compatible
  - Then the trade remains a break
- **AC-6** (REQ-4, testable=true)
  - Given an override targeting a break with no concrete counterpart
  - When the override is processed
  - Then no match is manufactured and the break remains visible
- **AC-7** (REQ-4, testable=true)
  - Given two override instructions target the same eligible trade
  - When reconciliation runs
  - Then the first may apply and the later instruction appears as a stale override
- **AC-8** (REQ-5, testable=true)
  - Given any valid evaluator-owned fixture directory
  - When the adapter run command completes
  - Then all four declared output files exist with stable headers and deterministic ordering
- **AC-9** (REQ-6, testable=true)
  - Given the same business date and byte-identical input files
  - When the candidate runs twice against the same output state
  - Then result files are equivalent and run-ledger.csv contains no duplicate run entry
- **AC-10** (REQ-7, testable=true)
  - Given benchmark-adapter.json at the candidate root
  - When an external tool validates and invokes it
  - Then the adapter needs no knowledge of the candidate's internal architecture

## Traceability

- REQ-1 → acceptance: [AC-1], invariants: [], risks: [RISK-1]
- REQ-2 → acceptance: [AC-2, AC-3], invariants: [INV-1], risks: [RISK-1, RISK-2]
- REQ-3 → acceptance: [AC-4, AC-5], invariants: [INV-2], risks: [RISK-1]
- REQ-4 → acceptance: [AC-6, AC-7], invariants: [INV-3], risks: [RISK-2]
- REQ-5 → acceptance: [AC-8], invariants: [INV-1], risks: [RISK-3]
- REQ-6 → acceptance: [AC-9], invariants: [INV-4], risks: [RISK-4]
- REQ-7 → acceptance: [AC-10], invariants: [], risks: [RISK-3]

## Review and sign-off

Decision: **approved** on 2026-08-12T12:00:00Z

**Authors**
- Synthetic Persona - Morgan Lee (Domain Architect)
- Synthetic Persona - Taylor Kim (Business Analyst)

**Blindness attestation**: attested — These named identities are synthetic demonstrator personas. The illustrative spec-author role was separated from evaluator design and used only the checked-in legacy baseline, public adapter contract, and synthetic stakeholder requirements; it did not use hidden evaluator implementation or expected benchmark outcomes.

**Authoring effort**: 285 min, 41200 input / 18650 output tokens, cost not priced

**Reviewers**
- Synthetic Persona - Alex Morgan (Engineering Lead): approve
- Synthetic Persona - Priya Shah (Trade Operations): approve
- Synthetic Persona - Sam Rivera (Platform Engineering): approve

Illustrative benchmark sign-off by synthetic personas; this is not a real organizational approval. Approved because the bundle is traceable to the checked-in synthetic baseline and adapter contract, with no unresolved critical ambiguity.
