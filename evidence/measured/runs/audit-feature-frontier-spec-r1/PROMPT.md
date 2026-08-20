# Task: Add explainable exception resolution and audit history

Extend the checked-in .NET 8 reconciliation baseline so an analyst can propose a
resolution for a reconciliation break with a reason and evidence, a different
person can approve or reject it, and Compliance can export an append-only history
for a date range. Self-approval must be prevented. Retries must be idempotent,
conflicting concurrent decisions must produce exactly one durable final decision,
and account identifiers or trade amounts must not leak into logs, command output,
or the audit export.

Preserve the existing reconciliation behavior and its `benchmark-adapter.json`.
Add a candidate-root `audit-adapter.json` that validates against
`contracts/audit-adapter.schema.json`. Its shell-free command arrays must implement:

- `initialize` using `{stateDirectory}`;
- `propose` using `{stateDirectory}`, `{requestId}`, `{proposer}`, `{businessDate}`,
  `{reason}`, and `{evidence}`;
- `decide` using `{stateDirectory}`, `{requestId}`, `{approver}`, and `{decision}`;
- `export` using `{stateDirectory}`, `{fromDate}`, `{toDate}`, and `{exportPath}`.

Commands must return parseable JSON on stdout; `export` may instead write JSON to
`{exportPath}`. The exported value must be an array or an object with an `entries`
array. Each durable entry must expose the request identity, lifecycle action,
recognized proposer or checker identity, and tamper-evidence/order metadata such
as a timestamp, sequence, version, or hash. The history must prove that an approved
or rejected request has one final decision by a checker distinct from its proposer.

Use your judgment on the internal design and persistence approach.

---

# Approved specification

# Explainable audit feature

Spec ID: `audit-feature-approved`

## Intent

The checked-in canonical .NET 8 reconciliation baseline supports direct manual break overrides but intentionally has no maker-checker workflow, durable resolution history, or compliance export. A synthetic Financial Services control feature is needed without changing core reconciliation results.

**Goals**
- Allow a maker to propose a break resolution with a reason and evidence.
- Require a distinct checker to approve or reject each proposal.
- Persist an append-only, ordered, tamper-evident lifecycle history.
- Handle retries and concurrent conflicting decisions deterministically.
- Export durable JSON history for an inclusive business-date range.
- Prevent account and amount data from appearing in logs, command output, or exports.
- Expose the workflow through the public audit adapter contract.

**Non-goals**
- Changing reconciliation matching, tolerance, break identity, or EOD report behavior.
- Claiming regulatory certification or production readiness.
- Building a user interface, identity provider, notification system, or general workflow engine.
- Permitting an emergency self-approval bypass.

**Success metrics**
- Self-approval produces no durable final decision.
- A distinct checker can create exactly one approved or rejected final decision.
- Duplicate decisions are idempotent and concurrent conflicting decisions leave exactly one final outcome.
- Date-range export contains parseable ordered JSON lifecycle entries with recognized actors.
- Synthetic account and amount sentinel values never appear in logs, command output, or export.
- Existing application build, tests, and reconciliation run remain successful.

**Stakeholders**
- Synthetic Compliance persona
- Synthetic Trade Operations persona
- Synthetic Security persona
- Synthetic Reconciliation Engineering persona

## Brownfield discovery

The canonical .NET 8 baseline ingests trades.csv, settlements.csv, and positions.csv; produces deterministic eod-summary.txt, eod-break-register.csv, and eod-result.json; and exposes stable BreakKey identities. Manual overrides are plain operational suppression with no approval history. benchmark-adapter.json is the existing black-box application contract; the feature adds audit-adapter.json.

**Components**
- TradeRecon.Domain defines ReconciliationBreak and its deterministic BreakKey.
- TradeRecon.Application orchestrates reconciliation and derives break state.
- TradeRecon.Infrastructure supplies CSV sources, state stores, report output, and structured logging.
- TradeRecon.Console exposes --date, --fixtures, --out, and --json.
- New audit workflow must expose initialize, propose, decide, and export commands through audit-adapter.json.

**Data flows**
- Evaluator invokes benchmark-adapter build, test, and run to prove the underlying application remains healthy.
- initialize creates durable workflow state beneath evaluator-owned {stateDirectory}.
- propose records requestId, proposer, business date, reason, and evidence as a durable proposed lifecycle entry.
- decide records one approved or rejected terminal entry by a checker distinct from the proposer.
- export selects entries by inclusive date range and writes a JSON array or an object with an entries array to {exportPath}.

**Constraints**
- Both adapter files live at the candidate root and use executable/argument arrays rather than shell strings.
- The evaluator owns state, input, output, and export paths and substitutes the documented placeholders.
- Commands return parseable JSON on stdout, except export may write parseable JSON to {exportPath}.
- Each durable entry must expose request identity, lifecycle action, a recognized actor field, contiguous 1-based sequence, and a verifiable SHA-256 previous-hash chain.
- The application must not log or export raw account identifiers or trade amounts.
- The internal persistence design is open, but state must survive across separate command processes.

**Known behaviors to preserve**
- BreakKey is deterministic for identical reconciliation input.
- The baseline uses exit code 2 for a completed run with outstanding breaks; this is an allowed success outcome in benchmark-adapter.json.
- The baseline intentionally has no maker-checker or append-only audit implementation.
- eod-result.json is deterministic and machine-readable, while diagnostic logs are written separately from JSON stdout.

## Ambiguity and assumption review

- **[critical] AMB-1** — Whether the workflow should key requests directly by BreakKey or accept an external request identifier was unclear. → Resolution: The black-box command boundary uses caller-supplied requestId. Implementations may associate it with BreakKey internally, but exported history must preserve requestId exactly. (resolved)
- **[critical] AMB-2** — Whether self-approval is ever permitted was unclear. → Resolution: It is never permitted. A checker identity equal to the durable proposer identity cannot create an approved or rejected terminal entry. (resolved)
- **[critical] AMB-3** — The outcome of simultaneous approve and reject commands was unspecified. → Resolution: Both commands must complete through declared adapter outcomes, but durable history must contain exactly one recognized final decision for the request. (resolved)
- **[major] AMB-4** — The audit export shape and actor field names were not specified. → Resolution: Export is JSON: either an array or an object with entries. Entries expose requestId (or a documented equivalent), action/eventType/status, proposer or checker identity, contiguous 1-based sequence, previousHash, and a lowercase SHA-256 hash over canonical JSON with recursively sorted keys. (resolved)
- **[major] AMB-5** — Whether evidence may appear in operational telemetry was unclear. → Resolution: Evidence may be stored in durable audit state but must not be emitted in logs or telemetry. Account and amount values must not appear in the export either. (resolved)

## Requirements

- **REQ-1** (testable=true): The candidate must retain benchmark-adapter.json and add audit-adapter.json implementing initialize, propose, decide, and export command arrays with all documented placeholders.
- **REQ-2** (testable=true): A valid proposal must durably record requestId, proposer identity, business date, non-empty reason, non-empty evidence, and an ordered PROPOSED-equivalent lifecycle action.
- **REQ-3** (testable=true): A decide command may record APPROVED or REJECTED only when the checker identity differs from the proposal's durable proposer identity; self-approval must not create a final entry.
- **REQ-4** (testable=true): Lifecycle history must be append-only and expose a contiguous 1-based sequence plus a SHA-256 hash chain. Each entry's previousHash is null for sequence 1 or equals the prior entry's hash; hash is lowercase SHA-256 over canonical JSON of that entry without hash, with recursively sorted object keys.
- **REQ-5** (testable=true): Repeating an already accepted identical final decision must be idempotently successful without writing a second final entry.
- **REQ-6** (testable=true): Concurrent conflicting approve and reject decisions for one proposed request must leave exactly one durable recognized final decision with a non-empty checker identity.
- **REQ-7** (testable=true): Export must produce parseable JSON for the inclusive fromDate/toDate range as an array or object with entries; the history must expose request identity, lifecycle action, proposer/checker identity, reason, evidence, and ordering metadata.
- **REQ-8** (testable=true): Logs, stderr/stdout diagnostics, telemetry, and exported history must not contain raw account identifiers or trade amount values supplied to the workflow.
- **REQ-9** (testable=true): The existing application must still build, pass its tests, and complete an evaluator-owned reconciliation through benchmark-adapter.json.

## Domain invariants

- **INV-1**: A request's durable proposer and durable final checker are never the same identity. (_enforced at: Decision validation against persisted proposal state before append._)
- **INV-2**: An accepted lifecycle entry is never updated or deleted; later state is represented only by later entries. (_enforced at: Append-only persistence API and exported sequence/hash continuity._)
- **INV-3**: A request has at most one durable terminal APPROVED or REJECTED decision. (_enforced at: Atomic conditional append for terminal state._)
- **INV-4**: Retrying an accepted proposal or decision cannot increase the durable count for that same logical action. (_enforced at: Idempotency lookup before append._)
- **INV-5**: Account and amount values are absent from logs, command output, telemetry, and exported audit history. (_enforced at: Allow-listed serialization and sentinel scanning._)

## Non-functional requirements

- **NFR-1** [security]: Audit functionality must not expose raw account or amount data in operational or exported evidence. (target: Zero sentinel matches across stdout, stderr, logs, and export.)
- **NFR-2** [reliability]: Separate command processes, retries, and concurrent decisions must not corrupt state. (target: All workflow commands finish within adapter timeouts and every request has at most one terminal entry.)
- **NFR-3** [performance]: Date-range export must remain suitable for an interactive demonstration. (target: The evaluator-owned export completes within the configured audit-command timeout.)
- **NFR-4** [maintainability]: Workflow lifecycle and persistence behavior must have automated tests. (target: Tests cover proposal validation, self-approval, approval, rejection, retry, concurrency, and export.)
- **NFR-5** [operability]: Every command must return a deterministic machine-readable outcome. (target: JSON stdout or JSON export file is parseable for every declared allowed exit code.)

## Risks

- **RISK-1** (likelihood=medium, impact=high): A persistence implementation may overwrite a current-state record and lose lifecycle history. — Mitigation: Persist immutable entries and verify multi-entry history plus order/hash metadata through export.
- **RISK-2** (likelihood=medium, impact=high): Maker-checker validation may trust the current command actor instead of the durable proposer. — Mitigation: Compare the checker to proposer identity loaded from persisted proposal history.
- **RISK-3** (likelihood=medium, impact=high): Non-atomic file or database writes may allow simultaneous approve and reject decisions. — Mitigation: Use an atomic conditional append/transaction and test true concurrent processes.
- **RISK-4** (likelihood=medium, impact=high): Generic object serialization or exception logging may leak synthetic account or amount fields. — Mitigation: Use explicit allow-listed DTOs and scan all command output and export for sentinels.

## Acceptance criteria

- **AC-1** (REQ-1, testable=true)
  - Given both candidate-root adapter files
  - When they are validated and invoked using evaluator-owned paths
  - Then application and audit commands run without shell strings or internal-project assumptions
- **AC-2** (REQ-2, testable=true)
  - Given a request with proposer maker-a and non-empty reason and evidence
  - When propose runs
  - Then export proves one durable proposal for the same requestId by maker-a
- **AC-3** (REQ-2, testable=true)
  - Given a request with empty reason and evidence
  - When propose runs
  - Then no durable history exists for that request
- **AC-4** (REQ-3, testable=true)
  - Given a proposal created by maker-a
  - When maker-a attempts to approve it
  - Then export contains no final decision by maker-a
- **AC-5** (REQ-3, testable=true)
  - Given a proposal created by maker-a
  - When checker-b approves it
  - Then export proves exactly one approved final entry by checker-b
- **AC-6** (REQ-4, testable=true)
  - Given a proposal and final decision
  - When history is exported
  - Then entries retain both events in contiguous sequence order and every SHA-256 hash plus previousHash link recomputes successfully from canonical JSON
- **AC-7** (REQ-5, testable=true)
  - Given an accepted approval
  - When the identical checker repeats the approval
  - Then the command is idempotently handled and export still has one final decision
- **AC-8** (REQ-6, testable=true)
  - Given one pending proposal
  - When different checkers concurrently approve and reject
  - Then both commands complete through declared outcomes and export has exactly one actor-attributed final decision
- **AC-9** (REQ-7, testable=true)
  - Given approved and rejected request history in the requested date range
  - When export runs
  - Then the JSON array or entries array contains the complete history for both requests
- **AC-10** (REQ-8, testable=true)
  - Given synthetic account and amount sentinels supplied during evaluation
  - When all command output and export JSON are scanned
  - Then neither sentinel appears
- **AC-11** (REQ-9, testable=true)
  - Given the canonical application plus audit feature
  - When benchmark-adapter build, test, and run execute
  - Then the application remains healthy and produces its declared reconciliation outputs

## Traceability

- REQ-1 → acceptance: [AC-1], invariants: [], risks: []
- REQ-2 → acceptance: [AC-2, AC-3], invariants: [INV-2], risks: [RISK-1]
- REQ-3 → acceptance: [AC-4, AC-5], invariants: [INV-1], risks: [RISK-2]
- REQ-4 → acceptance: [AC-6], invariants: [INV-2], risks: [RISK-1]
- REQ-5 → acceptance: [AC-7], invariants: [INV-4], risks: []
- REQ-6 → acceptance: [AC-8], invariants: [INV-3], risks: [RISK-3]
- REQ-7 → acceptance: [AC-9], invariants: [INV-2], risks: [RISK-1]
- REQ-8 → acceptance: [AC-10], invariants: [INV-5], risks: [RISK-4]
- REQ-9 → acceptance: [AC-11], invariants: [], risks: []

## Review and sign-off

Decision: **approved** on 2026-08-12T12:30:00Z

**Authors**
- Synthetic Persona - Taylor Kim (Business Analyst)
- Synthetic Persona - Jordan Bell (Control Architect)

**Blindness attestation**: attested — These named identities are synthetic demonstrator personas. The illustrative spec-author role was separated from evaluator design and used only the checked-in canonical baseline, public adapter contracts, and synthetic stakeholder requirements; it did not use hidden evaluator implementation or expected benchmark outcomes.

**Authoring effort**: 340 min, 52800 input / 24100 output tokens, cost not priced

**Reviewers**
- Synthetic Persona - Casey Brooks (Compliance): approve
- Synthetic Persona - Priya Shah (Trade Operations): approve
- Synthetic Persona - Alex Morgan (Engineering Lead): approve
- Synthetic Persona - Devon Wright (Security): approve

Illustrative benchmark sign-off by synthetic personas; this is not a real compliance or security approval. The bundle is approved for the synthetic experiment because the durable JSON contract, maker-checker rule, concurrency behavior, and sensitive-data boundary are explicit and testable.
