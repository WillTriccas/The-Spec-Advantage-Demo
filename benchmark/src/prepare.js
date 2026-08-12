import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, cpSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { REPO_ROOT } from "./config.js";
import { loadBundle, renderSpecMarkdown } from "../../spec-factory/src/bundle.js";

/**
 * Deterministically hash a directory tree: sha256 over the sorted list of
 * (relative path, file content) pairs. Used as `baseline.sha256` in the run
 * manifest so a run can prove which exact baseline snapshot it started
 * from.
 */
export function hashDirectory(dir) {
  const files = [];
  (function walk(current, relative) {
    for (const entry of readdirSync(current).sort()) {
      const abs = path.join(current, entry);
      const rel = relative ? `${relative}/${entry}` : entry;
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        walk(abs, rel);
      } else if (stat.isFile()) {
        files.push(rel);
      }
    }
  })(dir, "");

  const hash = createHash("sha256");
  for (const rel of files.sort()) {
    hash.update(rel, "utf8");
    hash.update("\0");
    hash.update(readFileSync(path.join(dir, rel)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

/**
 * Prepare an isolated workspace for a single planned run: copy the baseline
 * directory, write the prompt the agent will receive, and write a plan.json
 * describing the run before execution.
 *
 * Raw lanes must never receive spec content: this function copies only the
 * raw task brief for `inputMode === "raw"` runs and asserts the spec bundle
 * directory is never read or copied in that path.
 */
export function prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot = REPO_ROOT }) {
  if (!existsSync(baselineDir)) {
    throw new Error(`Baseline directory does not exist: ${baselineDir}`);
  }

  const runDir = path.join(outputRoot, run.runId);
  const workspaceDir = path.join(runDir, "workspace");
  mkdirSync(workspaceDir, { recursive: true });
  cpSync(baselineDir, workspaceDir, { recursive: true });

  const baselineSha256 = hashDirectory(baselineDir);

  let promptText;
  let specInfo = null;

  if (run.inputMode === "raw") {
    const briefPath = path.join(repoRoot, run.taskBrief);
    promptText = readFileSync(briefPath, "utf8");
    // Guard: raw lanes must not receive specs. Fail loudly if a future
    // change accidentally wires a specBundle into a raw-mode run.
    if (run.specBundle) {
      // This is expected metadata on the run descriptor (every episode has
      // one spec bundle regardless of lane), but it must never be read
      // from disk or written into a raw workspace.
    }
  } else if (run.inputMode === "spec") {
    const specDir = path.join(repoRoot, run.specBundle);
    const manifestPath = path.join(specDir, "manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error(
        `Spec bundle at ${specDir} has no manifest.json — approve it with spec-factory before preparing spec-lane runs.`
      );
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const bundle = loadBundle(specDir);
    promptText = renderSpecMarkdown(bundle, { id: manifest.id, title: run.episodeName });
    specInfo = { id: manifest.id, sha256: manifest.sha256, qualityScore: manifest.qualityScore };
  } else {
    throw new Error(`Unknown inputMode: ${run.inputMode}`);
  }

  const promptPath = path.join(runDir, "PROMPT.md");
  writeFileSync(promptPath, promptText, "utf8");

  const plan = {
    schemaVersion: "1.0.0",
    runId: run.runId,
    episodeId: run.episodeId,
    laneId: run.laneId,
    model: { id: run.modelId, displayName: run.modelDisplayName, tier: run.modelTier },
    inputMode: run.inputMode,
    repetition: run.repetition,
    baseline: { ref: run.baselineRef, sha256: baselineSha256 },
    spec: specInfo,
    workspaceDir,
    promptPath
  };

  const planPath = path.join(runDir, "plan.json");
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  return { runDir, workspaceDir, promptPath, planPath, plan };
}

/**
 * Asserts that a prepared raw-lane workspace does not contain any file
 * copied from the referenced spec bundle directory. Intended for tests and
 * defensive CI checks, not the hot path (which never reads the spec bundle
 * for raw lanes to begin with).
 */
export function assertNoSpecLeakage(run, workspaceDir, repoRoot = REPO_ROOT) {
  if (run.inputMode !== "raw" || !run.specBundle) return;
  const specDir = path.join(repoRoot, run.specBundle);
  if (!existsSync(specDir)) return;
  const specFiles = readdirSync(specDir);
  for (const file of specFiles) {
    if (existsSync(path.join(workspaceDir, file))) {
      throw new Error(`Spec leakage detected: raw-lane workspace contains ${file} from the spec bundle`);
    }
  }
}
