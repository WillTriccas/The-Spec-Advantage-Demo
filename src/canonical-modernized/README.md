# Trade Reconciliation — Canonical .NET 8 Baseline

A clean, deterministic trade-reconciliation service used as the **starting-point baseline**
for an AI-enabled SDLC benchmark. It ingests synthetic trade, position and settlement
records, reconciles them under configurable tolerances, records unmatched breaks, supports
manual overrides and idempotent reruns, and emits end-of-day (EOD) reports.

> **Scope note.** This baseline intentionally does **not** implement the Episode 2 audit
> feature. There is no maker–checker workflow, no append-only resolution audit log, and no
> reason/evidence approval system. Manual override here is a plain operational suppression
> with no approval gate or history. Those capabilities are added later in the benchmark.

## Architecture

The solution follows clean domain / application / infrastructure boundaries. Dependencies
point inward: infrastructure depends on application, application depends on domain, and the
domain depends on nothing.

```
src/canonical-modernized/
├── TradeRecon.sln
├── Directory.Build.props            # net8.0, nullable, warnings-as-errors, deterministic
├── fixtures/                        # synthetic CSV inputs (trades, settlements, positions)
├── src/
│   ├── TradeRecon.Domain/           # entities, value objects, enums, tolerances (no deps)
│   ├── TradeRecon.Application/      # engine, matcher, runner, report builder, abstractions
│   ├── TradeRecon.Infrastructure/   # CSV sources, in-memory stores, file report writer, DI
│   └── TradeRecon.Console/          # DI-wired host that runs a reconciliation for a date
└── tests/
    └── TradeRecon.Tests/            # xUnit unit + fixture-backed end-to-end tests
```

Key types:

| Layer | Type | Responsibility |
|-------|------|----------------|
| Domain | `Trade`, `Settlement`, `Position` | Immutable input records |
| Domain | `ReconciliationKey` | Natural match key: account + instrument + currency |
| Domain | `ToleranceOptions` | Configurable quantity / amount / date / position tolerances |
| Domain | `ReconciliationBreak`, `BreakType`, `BreakStatus` | A discrepancy and its stable `BreakKey` |
| Domain | `ReconciliationResult` | Deterministic per-date outcome (matches + breaks) |
| Application | `IReconciliationEngine` / `ReconciliationEngine` | Pure matching + tolerance logic |
| Application | `ReconciliationRunner` | Orchestrates load → override → reconcile → persist → report |
| Application | `EndOfDayReportBuilder` | Renders the EOD summary and CSV break register |
| Infrastructure | `CsvReconciliationBatchSource` | Loads inputs from CSV fixtures (async I/O) |
| Infrastructure | `InMemory*` stores, `FileReportWriter` | Idempotent persistence + report output |

## Business invariants

The engine guarantees the following. These are exercised directly by the test suite.

1. **Match key.** Trades and settlements are matched on `(Account, Instrument, Currency)`.
   Explicit `TradeId` links are honoured first; remaining records in a key are paired
   positionally using a stable ordering.
2. **Tolerance-based equality.** A matched pair is *clean* only if quantity, settlement
   date, amount and direction all agree within the configured tolerances (tolerances are
   inclusive; the effective quantity/amount tolerance is the larger of the absolute and
   relative bounds).
3. **Every input is accounted for.** A trade with no settlement raises `MissingSettlement`;
   a settlement with no trade raises `MissingTrade`. No input is silently dropped.
4. **Discrepancies are itemised.** A paired record that is out of tolerance raises a break
   per breached dimension: `QuantityMismatch`, `SettlementDateMismatch`, `AmountMismatch`
   or `DirectionMismatch`.
5. **Position integrity.** A declared end-of-day position must equal the net (signed) sum of
   that day's trades for its key; otherwise a `PositionMismatch` break is raised. Buys add,
   sells subtract. (Position reconciliation can be disabled per run.)
6. **Stable break identity.** Each break exposes a deterministic `BreakKey` derived from the
   business date, break type, key and involved record ids. Identical inputs always yield the
   same set of break keys.
7. **Manual override.** An operator may suppress a specific break by its `BreakKey`. An
   overridden break moves to `Overridden` status and no longer counts as open. Overrides are
   keyed, so they remain attached to the same discrepancy across reruns and never affect
   unrelated breaks.
8. **Idempotent reruns.** Re-running a business date with the same inputs and overrides
   produces an equivalent persisted result and byte-identical reports. Result persistence is
   an upsert keyed by business date.
9. **No sensitive data in logs.** Structured logs record counts, dates and identifiers only —
   never full record payloads.

## Fixtures

`fixtures/` contains a deterministic synthetic dataset for business date **2024-06-03** that
demonstrates every break type alongside clean matches:

| Records | Outcome |
|---------|---------|
| T001 / S001 | Clean exact match |
| T002 / S002 | Clean match (amount differs by 0.01, within tolerance) |
| T003 / S003 | `QuantityMismatch` (2000 vs 1900) |
| T004 / S004 | `SettlementDateMismatch` (1 day) |
| T005 / S005 | `AmountMismatch` (JPY 1,600,000 vs 1,600,500) |
| T006 / S006 | `DirectionMismatch` (Sell vs Buy) |
| T007 | `MissingSettlement` |
| S008 | `MissingTrade` |
| ACC003 / JP3633400001 | `PositionMismatch` (declared 900 vs trade-derived 800) |

Expected outcome with the console's default tolerances: **2 clean matches, 7 open breaks.**

`benchmark-adapter.json` is the external evaluator's data-only build/test/run contract. Feature agents may update command details if needed but must preserve its schema and observable output contract.

## Build, run and test

Requires the **.NET 8 SDK** (pinned via the repository `global.json`).

```powershell
# from src/canonical-modernized
dotnet restore TradeRecon.sln
dotnet build   TradeRecon.sln -c Release
dotnet test    TradeRecon.sln -c Release
```

Run the console reconciliation (copies fixtures next to the binary automatically):

```powershell
dotnet run --project src/TradeRecon.Console -c Release
```

Optional arguments:

```
--date <yyyy-MM-dd>   Business date to reconcile (default 2024-06-03)
--fixtures <dir>      Directory containing trades.csv / settlements.csv / positions.csv
--out <dir>           Output directory for EOD reports
```

The process exit code is `0` when the run is clean, `2` when breaks are outstanding, and
`1` on a missing-fixture error. Reports are written to
`<out>/<yyyy-MM-dd>/eod-summary.txt` and `eod-break-register.csv`.

## Input format

`trades.csv`

```
BusinessDate,TradeId,Account,Instrument,Quantity,Direction,SettlementDate,Currency,Amount
```

`settlements.csv`

```
BusinessDate,SettlementId,TradeId,Account,Instrument,Quantity,Direction,SettlementDate,Currency,Amount
```

`positions.csv`

```
BusinessDate,Account,Instrument,Currency,NetQuantity
```

`Direction` is `BUY` or `SELL`. Dates are ISO `yyyy-MM-dd`. Amounts and quantities use the
invariant culture (`.` decimal separator). The `TradeId` column on a settlement may be blank.
