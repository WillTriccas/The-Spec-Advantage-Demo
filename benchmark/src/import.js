import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { validateAgainstSchema } from "./schema-lite.js";
import { loadRunSchema, loadExperimentConfig, loadCostsConfig, CONFIG_DIR, REPO_ROOT } from "./config.js";
import { hashFile } from "./prepare.js";
import { computeCostUsd, amortizedSpecAuthoringShareUsd } from "./cost.js";

/**
 * Look up the approved spec bundle's `authoringEffort` (from its
 * spec-factory `manifest.json`) for a given episode, so that a spec-lane
 * run's cost can include an amortized share of the one-time spec-authoring
 * investment (correction item 6). Returns null if the episode has no
 * configured spec bundle or the bundle has no manifest.json yet.
 */
function loadSpecAuthoringEffort(episodeId, experimentConfig, repoRoot) {
  const episode = experimentConfig.episodes.find((e) => e.id === episodeId);
  if (!episode?.specBundle) return null;
  const manifestPath = path.join(repoRoot, episode.specBundle, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return manifest.authoringEffort ?? null;
}

/**
 * Assert that an assembled (schema-valid) run's lane/inputMode/spec
 * presence and model tier/id are mutually consistent with the committed
 * experiment config, per correction item 8. This runs *after* schema
 * validation succeeds so a structurally invalid run (e.g. an unknown
 * laneId) still fails with the original schema error rather than being
 * masked by this check.
 */
function validateImportedRunConsistency(run, experimentConfig) {
  const lane = experimentConfig.lanes.find((l) => l.id === run.laneId);
  if (!lane) {
    throw new Error(`Imported run "${run.runId}" references unknown lane "${run.laneId}"`);
  }
  if (lane.inputMode !== run.inputMode) {
    throw new Error(
      `Imported run "${run.runId}" has inputMode "${run.inputMode}" but lane "${run.laneId}" is configured for inputMode "${lane.inputMode}"`
    );
  }
  if (lane.inputMode === "raw" && run.spec !== null) {
    throw new Error(`Imported run "${run.runId}" is a raw-lane run but carries a non-null spec -- raw lanes must not receive specs.`);
  }
  if (lane.inputMode === "spec" && run.spec === null) {
    throw new Error(`Imported run "${run.runId}" is a spec-lane run but carries a null spec -- spec lanes must reference an approved spec bundle.`);
  }
  const model = experimentConfig.models[run.model.tier];
  if (!model) {
    throw new Error(`Imported run "${run.runId}" references unknown model tier "${run.model.tier}"`);
  }
  if (model.id !== run.model.id) {
    throw new Error(
      `Imported run "${run.runId}" has model.id "${run.model.id}" but model tier "${run.model.tier}" is configured for model.id "${model.id}"`
    );
  }
}

/**
 * Import execution metadata and evaluator evidence produced by an actual
 * (human- or tool-operated) benchmark run, and assemble/validate a
 * `contracts/run.schema.json`-compliant run artifact.
 *
 * This does not compute the quality score — that happens in `scoring.js`
 * from the evaluator JSON referenced by `evidence.evaluatorPath`. This step
 * only records the execution facts (what happened, how long it took, what
 * it cost) and where the evidence lives.
 *
 * Per correction item 8, this also (a) validates lane/inputMode/spec
 * presence and model tier/id consistency against the experiment config
 * (`validateImportedRunConsistency`, above), and (b) merges hash
 * provenance — evaluator file hash, costs config hash, and (if
 * `prepare.js`'s provenance.json is present in `runDir`) task-brief/spec/
 * scoring/experiment config hashes — plus the "frozen versions" actually
 * used (benchmarkVersion, baseline ref, pinned agent version, model
 * build id/effort params) into a supplementary, non-contract
 * `provenance.json` in `runDir`. This file is never validated against
 * `contracts/run.schema.json` (which has no room for it) and is not
 * referenced from `run.json`'s fixed `evidence` object, but sits alongside
 * `run.json` and `plan.json` in the same run directory for audit purposes.
 *
 * `execution.estimatedCostUsd` is only auto-computed (via `cost.js`'s
 * `computeCostUsd`, fed by `benchmark/config/costs.json`) when the caller
 * leaves it `null`/omitted — an explicit non-null value the caller
 * supplies (e.g. from an actual billing export) always wins. Per
 * correction item 6, a spec-lane run's auto-computed cost also folds in an
 * amortized share of the episode's approved spec authoring cost
 * (`amortizedSpecAuthoringShareUsd`, reading `authoringEffort` from the
 * spec bundle's `manifest.json` and dividing by `repetitionsPerLane`), so
 * the efficiency comparison reflects the one-time authoring investment
 * amortized across its reuse — not just this run's own execution cost.
 * Both stay `null` until `costs.json` carries dated, sourced per-model
 * pricing (per the "costs must remain null until dated pricing is
 * configured" requirement) — see `cost.js` for the exact provenance rules.
 */
export function importRun({
  runDir,
  benchmarkVersion,
  baselineCommit,
  execution,
  source,
  evidence,
  experimentConfig = loadExperimentConfig(),
  costsConfig = loadCostsConfig(),
  repoRoot = REPO_ROOT
}) {
  const planPath = path.join(runDir, "plan.json");
  if (!existsSync(planPath)) {
    throw new Error(`No plan.json found in ${runDir}; run "prepare" first.`);
  }
  const plan = JSON.parse(readFileSync(planPath, "utf8"));

  // Per correction item 6: auto-compute estimatedCostUsd from token usage
  // and costs.json unless the caller already supplied an explicit non-null
  // value. For spec-lane runs, fold in an amortized share of the episode's
  // approved spec authoring cost. Both remain null until costs.json carries
  // dated, sourced pricing -- see cost.js.
  let specAuthoringShareUsd = null;
  if (plan.inputMode === "spec") {
    const authoringEffort = loadSpecAuthoringEffort(plan.episodeId, experimentConfig, repoRoot);
    specAuthoringShareUsd = amortizedSpecAuthoringShareUsd(authoringEffort, experimentConfig.repetitionsPerLane);
  }
  const computedCostUsd = computeCostUsd({
    modelId: plan.model.id,
    inputTokens: execution.inputTokens,
    outputTokens: execution.outputTokens,
    cachedInputTokens: execution.cachedInputTokens ?? 0,
    reasoningOutputTokens: execution.reasoningOutputTokens ?? 0,
    costsConfig,
    specAuthoringShareUsd
  });
  const estimatedCostUsd = execution.estimatedCostUsd ?? computedCostUsd;

  const run = {
    schemaVersion: "1.0.0",
    runId: plan.runId,
    benchmarkVersion,
    episodeId: plan.episodeId,
    laneId: plan.laneId,
    // contracts/run.schema.json's model object only allows id/displayName/tier
    // (additionalProperties: false); plan.model additionally carries
    // buildId/agentVersion/effortParams (correction item 7), which are
    // preserved instead in this run's provenance.json ("frozenVersions"
    // below) rather than dropped on the floor.
    model: { id: plan.model.id, displayName: plan.model.displayName, tier: plan.model.tier },
    inputMode: plan.inputMode,
    repetition: plan.repetition,
    baseline: {
      ref: plan.baseline.ref,
      commit: baselineCommit,
      sha256: plan.baseline.sha256
    },
    spec: plan.spec ?? null,
    execution: {
      status: execution.status,
      startedAt: execution.startedAt,
      endedAt: execution.endedAt,
      elapsedSeconds: execution.elapsedSeconds,
      agentVersion: execution.agentVersion,
      toolCalls: execution.toolCalls,
      inputTokens: execution.inputTokens ?? null,
      outputTokens: execution.outputTokens ?? null,
      estimatedCostUsd
    },
    source: {
      commit: source.commit ?? null,
      diffPath: source.diffPath
    },
    evidence: {
      directory: evidence.directory,
      transcriptPath: evidence.transcriptPath,
      evaluatorPath: evidence.evaluatorPath
    }
  };

  const schema = loadRunSchema();
  const { valid, errors } = validateAgainstSchema(schema, run);
  if (!valid) {
    throw new Error(`Imported run failed contracts/run.schema.json validation:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }

  validateImportedRunConsistency(run, experimentConfig);

  const runJsonPath = path.join(runDir, "run.json");
  writeFileSync(runJsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");

  const provenancePath = path.join(runDir, "provenance.json");
  const existingProvenance = existsSync(provenancePath) ? JSON.parse(readFileSync(provenancePath, "utf8")) : { schemaVersion: "1.0.0", runId: run.runId, hashes: {} };
  const provenance = {
    ...existingProvenance,
    importedAt: new Date().toISOString(),
    hashes: {
      ...existingProvenance.hashes,
      evaluatorSha256: hashFile(path.isAbsolute(evidence.evaluatorPath) ? evidence.evaluatorPath : path.join(REPO_ROOT, evidence.evaluatorPath)),
      costsConfigSha256: hashFile(path.join(CONFIG_DIR, "costs.json"))
    },
    frozenVersions: {
      benchmarkVersion,
      baselineRef: plan.baseline.ref,
      pinnedAgentVersion: plan.model.agentVersion ?? null,
      modelBuildId: plan.model.buildId ?? null,
      modelEffortParams: plan.model.effortParams ?? null
    }
  };
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");

  return { run, runJsonPath, provenancePath };
}

