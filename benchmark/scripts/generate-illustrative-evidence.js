#!/usr/bin/env node
/**
 * Generates `evidence/illustrative/report.json` and
 * `evidence/illustrative/claim-detail.json` -- entirely fabricated,
 * illustrative-only evidence used to exercise the dashboard and the
 * `contracts/report.schema.json` shape before any real benchmark runs have
 * been executed.
 *
 * This script runs the *actual* engine (buildPlannedRuns -> scoreRun ->
 * buildReport) over invented-but-internally-consistent evaluator data, so
 * the illustrative report is a faithful exercise of the real pipeline, not
 * a hand-typed JSON fixture that could silently drift from the engine's
 * actual behavior. `dataKind: "illustrative"` still forces `claim.status`
 * to `"not-evaluated"` regardless of these fabricated numbers -- see
 * `benchmark/src/claim.js` and `evidence/illustrative/README.md`.
 *
 * Usage: node benchmark/scripts/generate-illustrative-evidence.js
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { buildPlannedRuns } from "../src/runs.js";
import { scoreRun } from "../src/scoring.js";
import { buildReport, writeReport, writeClaimDetail } from "../src/report.js";
import { CONFIG_DIR, CONTRACTS_DIR, loadExperimentConfig, loadScoringConfig } from "../src/config.js";
import { assemblePromptText, hashDirectory, hashFile, hashText } from "../src/prepare.js";
import { loadBundle, renderSpecMarkdown } from "../../spec-factory/src/bundle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(REPO_ROOT, "evidence", "illustrative");

// Deterministic mulberry32 PRNG (same construction as runs.js's, duplicated
// here to keep this one-off generator self-contained) seeded per runId so
// re-running this script reproduces byte-identical illustrative numbers.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  return hash >>> 0;
}

// Illustrative-only quality bands: spec lanes fabricated a bit stronger than
// raw lanes, frontier a bit stronger than efficient -- purely to give the
// dashboard varied, plausible-looking numbers to render. This has zero
// bearing on any real claim; dataKind "illustrative" forces "not-evaluated".
function bandFor(laneId) {
  if (laneId.endsWith("-spec")) return laneId.startsWith("frontier") ? [86, 97] : [80, 93];
  return laneId.startsWith("frontier") ? [74, 89] : [58, 82];
}

function fabricateEvaluator(run, rand) {
  const [lo, hi] = bandFor(run.laneId);
  const base = lo + rand() * (hi - lo);
  const jitter = () => Math.max(0, Math.min(100, Math.round((base + (rand() - 0.5) * 10) * 10) / 10));
  const scores = {
    functionalCorrectness: jitter(),
    behaviorPreservation: jitter(),
    securityControls: jitter(),
    maintainability: jitter(),
    operability: jitter(),
    scopeTraceability: jitter()
  };
  const gateThreshold = run.laneId.endsWith("-spec") ? 0.08 : 0.22; // spec lanes fail gates less often, illustratively
  const hardGates = {
    build: rand() > gateThreshold,
    "essential-business-invariants": rand() > gateThreshold,
    "no-critical-security-findings": rand() > gateThreshold,
    "maker-checker-separation": rand() > gateThreshold,
    "audit-integrity": rand() > gateThreshold
  };
  return {
    attestation: {
      independentFromSpecAuthors: true,
      evaluatorNames: ["illustrative-fixture"],
      statement: "Illustrative-only fabricated evaluator; no real review occurred."
    },
    scores,
    hardGates
  };
}

function main() {
  const experimentConfig = loadExperimentConfig();
  const scoringConfig = loadScoringConfig();
  const plannedRuns = buildPlannedRuns(experimentConfig);
  const evaluatorSha256 = hashDirectory(path.join(REPO_ROOT, "evaluator"));
  const scoringConfigSha256 = hashFile(path.join(CONFIG_DIR, "scoring.json"));
  const costsConfigSha256 = hashFile(path.join(CONFIG_DIR, "costs.json"));
  const benchmarkEngineSha256 = hashDirectory(path.join(REPO_ROOT, "benchmark", "src"));
  const experimentConfigSha256 = hashFile(path.join(CONFIG_DIR, "experiment.json"));
  const runSchemaSha256 = hashFile(path.join(CONTRACTS_DIR, "run.schema.json"));
  const reportSchemaSha256 = hashFile(path.join(CONTRACTS_DIR, "report.schema.json"));
  const promptHashes = new Map();
  const specAuthoringTokens = new Map();
  for (const episode of experimentConfig.episodes) {
    const briefText = readFileSync(path.join(REPO_ROOT, episode.taskBrief), "utf8");
    const manifest = JSON.parse(
      readFileSync(path.join(REPO_ROOT, episode.specBundle, "manifest.json"), "utf8")
    );
    const renderedSpec = renderSpecMarkdown(
      loadBundle(path.join(REPO_ROOT, episode.specBundle)),
      { id: manifest.id, title: episode.name }
    );
    specAuthoringTokens.set(
      episode.id,
      (manifest.authoringEffort?.inputTokens ?? 0) +
        (manifest.authoringEffort?.outputTokens ?? 0)
    );
    promptHashes.set(
      `${episode.id}|raw`,
      hashText(assemblePromptText({ briefText, inputMode: "raw" }))
    );
    promptHashes.set(
      `${episode.id}|spec`,
      hashText(assemblePromptText({ briefText, inputMode: "spec", renderedSpec }))
    );
  }

  // Illustrate correction item 3 (non-completed runs always score 0 and
  // fail every applicable gate): one run in each episode is fabricated as
  // not-completed, so the illustrative report visibly demonstrates that
  // behavior rather than only ever showing "completed" runs.
  const forcedNonCompleted = new Set(["modernization-efficient-raw-r3", "audit-feature-frontier-raw-r3"]);

  const scoredRuns = plannedRuns.map((run) => {
    const rand = mulberry32(seedFromString(run.runId));
    const evaluator = fabricateEvaluator(run, rand);
    const executionStatus = forcedNonCompleted.has(run.runId) ? "timed-out" : "completed";
    const scored = scoreRun(evaluator, { scoringConfig, episodeId: run.episodeId, executionStatus, inputMode: run.inputMode });

    const elapsedBase = run.laneId.startsWith("frontier") ? 1900 : 1150;
    const elapsedSeconds = Math.round(elapsedBase + rand() * 500);
    const toolCalls = Math.round(8 + rand() * 14);

    return {
      runId: run.runId,
      dataKind: "illustrative",
      benchmarkVersion: "unfrozen",
      episodeId: run.episodeId,
      laneId: run.laneId,
      modelDisplayName: run.modelDisplayName,
      inputMode: run.inputMode,
      repetition: run.repetition,
      status: executionStatus,
      qualityScore: scored.qualityScore,
      hardGatesPassed: scored.hardGatesPassed,
      gateStates: scored.gateStates,
      scores: scored.scores ?? {
        functionalCorrectness: 0,
        behaviorPreservation: 0,
        securityControls: 0,
        maintainability: 0,
        operability: 0,
        scopeTraceability: 0
      },
      elapsedSeconds,
      productiveSeconds: Math.round(elapsedSeconds * 0.9),
      queueSeconds: Math.round(elapsedSeconds * 0.05),
      toolCalls,
      // No dated pricing is configured in benchmark/config/costs.json, so
      // token counts are still fabricated for illustrative realism but the
      // resulting cost intentionally stays null throughout (see cost.js).
      inputTokens: Math.round(20000 + rand() * 40000),
      cachedInputTokens: 0,
      outputTokens: Math.round(8000 + rand() * 20000),
      reasoningTokens: 0,
      estimatedCostUsd: null,
      specAuthoringAmortizedCostUsd: null,
      specAuthoringAmortizedTokens:
        run.inputMode === "spec"
          ? Math.floor(
              specAuthoringTokens.get(run.episodeId) /
                experimentConfig.repetitionsPerLane
            ) +
            (run.repetition <=
            specAuthoringTokens.get(run.episodeId) %
              experimentConfig.repetitionsPerLane
              ? 1
              : 0)
          : 0,
      frozenInputs: {
        freezeRecordSha256: null,
        evaluatorSha256,
        scoringConfigSha256,
        costsConfigSha256,
        benchmarkEngineSha256,
        promptSha256: promptHashes.get(`${run.episodeId}|${run.inputMode}`),
        experimentConfigSha256,
        runSchemaSha256,
        reportSchemaSha256
      },
      evidencePath: `evidence/illustrative/fixtures/${run.runId}` // fabricated path; no such fixture files exist
    };
  });

  const { report, claimDetail } = buildReport({
    runs: scoredRuns,
    benchmarkVersion: "unfrozen",
    repetitionsPerLane: experimentConfig.repetitionsPerLane,
    dataKind: "illustrative",
    pricingAsOf: null,
    scoringConfig,
    generatedAt: "2026-08-12T13:00:00.000Z"
  });

  writeReport(report, path.join(OUT_DIR, "report.json"));
  writeClaimDetail(claimDetail, path.join(OUT_DIR, "claim-detail.json"));
  console.log(`Wrote ${path.join(OUT_DIR, "report.json")} and claim-detail.json (claim.status: ${report.overallClaim.status})`);
}

main();
