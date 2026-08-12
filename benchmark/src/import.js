import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { validateAgainstSchema } from "./schema-lite.js";
import { loadRunSchema } from "./config.js";

/**
 * Import execution metadata and evaluator evidence produced by an actual
 * (human- or tool-operated) benchmark run, and assemble/validate a
 * `contracts/run.schema.json`-compliant run artifact.
 *
 * This does not compute the quality score — that happens in `scoring.js`
 * from the evaluator JSON referenced by `evidence.evaluatorPath`. This step
 * only records the execution facts (what happened, how long it took, what
 * it cost) and where the evidence lives.
 */
export function importRun({ runDir, benchmarkVersion, baselineCommit, execution, source, evidence }) {
  const planPath = path.join(runDir, "plan.json");
  if (!existsSync(planPath)) {
    throw new Error(`No plan.json found in ${runDir}; run "prepare" first.`);
  }
  const plan = JSON.parse(readFileSync(planPath, "utf8"));

  const run = {
    schemaVersion: "1.0.0",
    runId: plan.runId,
    benchmarkVersion,
    episodeId: plan.episodeId,
    laneId: plan.laneId,
    model: plan.model,
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
      estimatedCostUsd: execution.estimatedCostUsd ?? null
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

  const runJsonPath = path.join(runDir, "run.json");
  writeFileSync(runJsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  return { run, runJsonPath };
}
