import { writeFileSync } from "node:fs";
import { validateAgainstSchema } from "./schema-lite.js";
import { loadReportSchema, loadScoringConfig } from "./config.js";
import { aggregateEpisode } from "./aggregate.js";
import { determineClaim } from "./claim.js";

const EPISODE_NAMES = {
  modernization: "Platform modernization",
  "audit-feature": "Explainable audit feature"
};

/**
 * Build a full `contracts/report.schema.json`-compliant evidence report
 * from a flat list of scored runs (as produced by combining `import.js`
 * execution facts with `scoring.js` evaluator results).
 *
 * Each item in `runs` must have: runId, episodeId, laneId, modelDisplayName,
 * inputMode, repetition, status, qualityScore, hardGatesPassed, scores,
 * elapsedSeconds, toolCalls, evidencePath, and optionally inputTokens,
 * outputTokens, estimatedCostUsd.
 *
 * `dataKind` must be "illustrative" or "measured". Illustrative reports are
 * always forced to claim.status "not-evaluated" regardless of the numbers
 * present, per the committed decision record: illustrative data may
 * exercise the dashboard but must never support the benchmark claim.
 */
export function buildReport({
  runs,
  benchmarkVersion,
  repetitionsPerLane,
  dataKind,
  pricingAsOf = null,
  scoringConfig = loadScoringConfig(),
  generatedAt = new Date().toISOString()
}) {
  if (runs.length === 0) {
    throw new Error("Cannot build a report from an empty run list");
  }

  const byEpisode = new Map();
  for (const run of runs) {
    if (!byEpisode.has(run.episodeId)) byEpisode.set(run.episodeId, []);
    byEpisode.get(run.episodeId).push(run);
  }

  const episodes = [...byEpisode.entries()].map(([episodeId, episodeRuns]) => ({
    id: episodeId,
    name: EPISODE_NAMES[episodeId] ?? episodeId,
    laneSummaries: aggregateEpisode(episodeRuns),
    runs: episodeRuns.map((run) => ({
      runId: run.runId,
      laneId: run.laneId,
      modelDisplayName: run.modelDisplayName,
      inputMode: run.inputMode,
      repetition: run.repetition,
      status: run.status,
      qualityScore: run.qualityScore,
      hardGatesPassed: run.hardGatesPassed,
      scores: run.scores,
      elapsedSeconds: run.elapsedSeconds,
      toolCalls: run.toolCalls,
      inputTokens: run.inputTokens ?? null,
      outputTokens: run.outputTokens ?? null,
      estimatedCostUsd: run.estimatedCostUsd ?? null,
      evidencePath: run.evidencePath
    }))
  }));

  const claim = determineClaim(runs, { claimRule: scoringConfig.claimRule, dataKind });

  const report = {
    schemaVersion: "1.0.0",
    metadata: {
      benchmarkVersion,
      generatedAt,
      dataKind,
      repetitionsPerLane,
      pricingAsOf
    },
    claim,
    episodes
  };

  const schema = loadReportSchema();
  const { valid, errors } = validateAgainstSchema(schema, report);
  if (!valid) {
    throw new Error(`Report failed contracts/report.schema.json validation:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }

  return report;
}

export function writeReport(report, outputPath) {
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outputPath;
}
