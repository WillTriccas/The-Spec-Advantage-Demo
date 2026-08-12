import { readFileSync } from "node:fs";
import { loadExperimentConfig, loadScoringConfig } from "./config.js";
import { buildPlannedRuns, plannedRunCount } from "./runs.js";
import { prepareRunWorkspace } from "./prepare.js";
import { importRun } from "./import.js";
import { scoreRun } from "./scoring.js";
import { aggregateLane, groupByLane } from "./aggregate.js";
import { buildReport, writeReport } from "./report.js";
import { benchmarkContractVersion } from "./index.js";

function printUsage() {
  console.log(`benchmark <command> [options]

Commands:
  list-runs                                   List all planned runs (24 by default)
  prepare --run <id> --baseline <dir> --out <dir>
                                               Prepare an isolated workspace for one planned run
  import --run-dir <dir> --execution <file> [--benchmark-version <v>]
                                               Import execution metadata/evidence into run.json
  score --evaluator <file>                    Score one run's evaluator JSON against scoring.json
  aggregate --runs <file>                     Aggregate scored runs (JSON array) into lane summaries
  report --runs <file> --data-kind <illustrative|measured> --out <file>
                                               Build and write a full evidence report
`);
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      options[arg.slice(2)] = args[i + 1];
      i += 1;
    }
  }
  return options;
}

export function cmdListRuns() {
  const config = loadExperimentConfig();
  const runs = buildPlannedRuns(config);
  console.log(`Planned runs: ${runs.length} (expected ${plannedRunCount(config)})`);
  for (const run of runs) {
    console.log(
      `${run.runId.padEnd(28)} episode=${run.episodeId.padEnd(14)} lane=${run.laneId.padEnd(15)} model=${run.modelDisplayName.padEnd(20)} mode=${run.inputMode.padEnd(4)} rep=${run.repetition}`
    );
  }
  return 0;
}

export function cmdPrepare(options) {
  const { run: runId, baseline, out } = options;
  if (!runId || !baseline || !out) {
    console.error("Usage: benchmark prepare --run <id> --baseline <dir> --out <dir>");
    return 1;
  }
  const runs = buildPlannedRuns();
  const run = runs.find((r) => r.runId === runId);
  if (!run) {
    console.error(`Unknown run id: ${runId}`);
    return 1;
  }
  const result = prepareRunWorkspace(run, { baselineDir: baseline, outputRoot: out });
  console.log(JSON.stringify({ runDir: result.runDir, promptPath: result.promptPath, planPath: result.planPath }, null, 2));
  return 0;
}

export function cmdImport(options) {
  const { "run-dir": runDir, execution: executionPath, "benchmark-version": benchmarkVersion } = options;
  if (!runDir || !executionPath) {
    console.error("Usage: benchmark import --run-dir <dir> --execution <file> [--benchmark-version <v>]");
    return 1;
  }
  const executionInput = JSON.parse(readFileSync(executionPath, "utf8"));
  const { run } = importRun({
    runDir,
    benchmarkVersion: benchmarkVersion ?? benchmarkContractVersion,
    baselineCommit: executionInput.baselineCommit,
    execution: executionInput.execution,
    source: executionInput.source,
    evidence: executionInput.evidence
  });
  console.log(JSON.stringify(run, null, 2));
  return 0;
}

export function cmdScore(options) {
  const { evaluator: evaluatorPath } = options;
  if (!evaluatorPath) {
    console.error("Usage: benchmark score --evaluator <file>");
    return 1;
  }
  const evaluator = JSON.parse(readFileSync(evaluatorPath, "utf8"));
  const result = scoreRun(evaluator, loadScoringConfig());
  console.log(JSON.stringify(result, null, 2));
  return result.hardGatesPassed ? 0 : 1;
}

export function cmdAggregate(options) {
  const { runs: runsPath } = options;
  if (!runsPath) {
    console.error("Usage: benchmark aggregate --runs <file>");
    return 1;
  }
  const runs = JSON.parse(readFileSync(runsPath, "utf8"));
  const byLane = groupByLane(runs);
  const summaries = [...byLane.values()].map((laneRuns) => aggregateLane(laneRuns));
  console.log(JSON.stringify(summaries, null, 2));
  return 0;
}

export function cmdReport(options) {
  const { runs: runsPath, "data-kind": dataKind, out, "pricing-as-of": pricingAsOf } = options;
  if (!runsPath || !dataKind || !out) {
    console.error("Usage: benchmark report --runs <file> --data-kind <illustrative|measured> --out <file>");
    return 1;
  }
  const runs = JSON.parse(readFileSync(runsPath, "utf8"));
  const experimentConfig = loadExperimentConfig();
  const report = buildReport({
    runs,
    benchmarkVersion: experimentConfig.benchmarkVersion,
    repetitionsPerLane: experimentConfig.repetitionsPerLane,
    dataKind,
    pricingAsOf: pricingAsOf ?? null
  });
  writeReport(report, out);
  console.log(`Wrote report to ${out} (claim: ${report.claim.status})`);
  return 0;
}

export function run(argv) {
  const [command, ...rest] = argv;
  const options = parseOptions(rest);
  switch (command) {
    case "list-runs":
      return cmdListRuns();
    case "prepare":
      return cmdPrepare(options);
    case "import":
      return cmdImport(options);
    case "score":
      return cmdScore(options);
    case "aggregate":
      return cmdAggregate(options);
    case "report":
      return cmdReport(options);
    default:
      printUsage();
      return command ? 1 : 0;
  }
}
