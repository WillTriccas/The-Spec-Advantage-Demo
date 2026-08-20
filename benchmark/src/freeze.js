import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CONFIG_DIR,
  CONTRACTS_DIR,
  REPO_ROOT,
  getExperimentConfigPath,
  loadCostsConfig,
  loadExperimentConfig,
  loadScoringConfig
} from "./config.js";
import {
  assemblePromptText,
  hashDirectory,
  hashDirectoryAtRef,
  hashFile,
  hashText
} from "./prepare.js";
import {
  assembleSpec,
  loadBundle,
  renderSpecMarkdown
} from "../../spec-factory/src/bundle.js";
import { hashBundle } from "../../spec-factory/src/hashing.js";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function git(args, repoRoot) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function resolveRef(ref, repoRoot) {
  try {
    return git(["rev-parse", "--verify", ref], repoRoot);
  } catch {
    return null;
  }
}

function archiveSha256(ref, baselinePath, repoRoot) {
  if (!resolveRef(ref, repoRoot)) return null;
  const archive = execFileSync(
    "git",
    ["archive", "--format=tar", ref, baselinePath.replaceAll("\\", "/")],
    { cwd: repoRoot }
  );
  return createHash("sha256").update(archive).digest("hex");
}

const REQUIRED_APPROVALS = [
  "scenario",
  "specifications",
  "evaluator",
  "claimAdjudication"
];

export function approvalBlockers(approvals) {
  const blockers = [];
  for (const area of REQUIRED_APPROVALS) {
    const approval = approvals?.[area];
    if (
      approval?.approved !== true ||
      typeof approval.reviewer !== "string" ||
      !approval.reviewer ||
      typeof approval.approvedAt !== "string" ||
      !approval.approvedAt ||
      typeof approval.evidenceRef !== "string" ||
      !approval.evidenceRef
    ) {
      blockers.push(`Independent ${area} approval is not recorded.`);
    }
  }
  return blockers;
}

export function createFreezeReadiness({
  repoRoot = REPO_ROOT,
  generatedAt = new Date().toISOString(),
  experimentConfig = loadExperimentConfig(),
  experimentConfigPath = getExperimentConfigPath(),
  scoringConfig = loadScoringConfig(),
  costsConfig = loadCostsConfig()
} = {}) {
  const approvalsPath = path.resolve(
    repoRoot,
    experimentConfig.approvalsPath ?? path.join("benchmark", "config", "approvals.json")
  );
  if (!approvalsPath.startsWith(`${path.resolve(repoRoot)}${path.sep}`)) {
    throw new Error("Approvals path must remain inside the repository");
  }
  const approvals = existsSync(approvalsPath)
    ? readJson(approvalsPath)
    : { schemaVersion: "1.0.0" };
  const dirtyEntries = git(["status", "--porcelain"], repoRoot)
    .split(/\r?\n/)
    .filter(Boolean);
  const headCommit = git(["rev-parse", "HEAD"], repoRoot);
  const blockers = [];

  if (dirtyEntries.length > 0) blockers.push("Repository working tree is not clean.");
  if (experimentConfig.benchmarkVersion === "unfrozen") {
    blockers.push("benchmarkVersion is still \"unfrozen\".");
  }
  const evidenceQualification = experimentConfig.evidenceQualification;
  if (
    !["strict-measured", "bounded-measured"].includes(
      evidenceQualification?.level
    ) ||
    typeof evidenceQualification?.limitation !== "string" ||
    !evidenceQualification.limitation
  ) {
    blockers.push("Measured evidence qualification is not fully declared.");
  }

  const models = Object.entries(experimentConfig.models).map(([tier, model]) => {
    if (!model.buildId) blockers.push(`${tier} model buildId is not pinned.`);
    if (!model.agentVersion) blockers.push(`${tier} agentVersion is not pinned.`);
    if (!model.agentBuildId) blockers.push(`${tier} agentBuildId is not pinned.`);
    if (!model.effortParams?.reasoningEffort) {
      blockers.push(`${tier} reasoning effort is not pinned.`);
    }
    if (
      model.buildId === "not-exposed-by-copilot" &&
      evidenceQualification?.level !== "bounded-measured"
    ) {
      blockers.push(
        `${tier} model build is not exposed, so evidence must be qualified as bounded-measured.`
      );
    }
    return {
      tier,
      id: model.id,
      displayName: model.displayName,
      buildId: model.buildId ?? null,
      agentVersion: model.agentVersion ?? null,
      agentBuildId: model.agentBuildId ?? null,
      effortParams: model.effortParams ?? null
    };
  });

  const baselines = experimentConfig.episodes.map((episode) => {
    const commit = resolveRef(episode.baselineRef, repoRoot);
    if (!commit) blockers.push(`Baseline ref ${episode.baselineRef} does not resolve.`);
    return {
      episodeId: episode.id,
      ref: episode.baselineRef,
      commit,
      path: episode.baselinePath,
      sha256: commit
        ? hashDirectoryAtRef(episode.baselineRef, episode.baselinePath, repoRoot)
        : null,
      archiveSha256: commit
        ? archiveSha256(episode.baselineRef, episode.baselinePath, repoRoot)
        : null
    };
  });

  const promptsAndSpecs = experimentConfig.episodes.map((episode) => {
    const manifestPath = path.join(repoRoot, episode.specBundle, "manifest.json");
    const manifest = readJson(manifestPath);
    const bundle = loadBundle(path.dirname(manifestPath));
    const assembledSpecSha256 = hashBundle(assembleSpec(bundle, { id: manifest.id }));
    if (assembledSpecSha256 !== manifest.sha256) {
      throw new Error(
        `Spec bundle ${episode.specBundle} no longer matches its approved manifest`
      );
    }
    const briefText = readFileSync(path.join(repoRoot, episode.taskBrief), "utf8");
    const renderedSpec = renderSpecMarkdown(bundle, {
      id: manifest.id,
      title: episode.name
    });
    return {
      episodeId: episode.id,
      taskBriefPath: episode.taskBrief,
      taskBriefSha256: hashFile(path.join(repoRoot, episode.taskBrief)),
      rawPromptSha256: hashText(
        assemblePromptText({ briefText, inputMode: "raw" })
      ),
      specPromptSha256: hashText(
        assemblePromptText({ briefText, inputMode: "spec", renderedSpec })
      ),
      specBundlePath: episode.specBundle,
      specManifestSha256: hashFile(manifestPath),
      assembledSpecSha256: manifest.sha256,
      specQualityScore: manifest.qualityScore,
      specAuthoringEffort: manifest.authoringEffort
    };
  });

  blockers.push(...approvalBlockers(approvals));

  const readiness = {
    schemaVersion: "freeze-readiness/1.0.0",
    generatedAt,
    ready: blockers.length === 0,
    blockers,
    benchmarkVersion: experimentConfig.benchmarkVersion,
    evidenceQualification,
    repository: {
      headCommit,
      clean: dirtyEntries.length === 0,
      dirtyEntries
    },
    baselines,
    promptsAndSpecs,
    frozenInputs: {
      evaluatorSha256: hashDirectory(path.join(repoRoot, "evaluator")),
      scoringConfigSha256: hashFile(path.join(CONFIG_DIR, "scoring.json")),
      experimentConfigSha256: hashFile(experimentConfigPath),
      costsConfigSha256: hashFile(path.join(CONFIG_DIR, "costs.json")),
      benchmarkEngineSha256: hashDirectory(path.join(repoRoot, "benchmark", "src")),
      runSchemaSha256: hashFile(path.join(CONTRACTS_DIR, "run.schema.json")),
      reportSchemaSha256: hashFile(path.join(CONTRACTS_DIR, "report.schema.json")),
      scoringConfig,
      costsConfig,
      claimRule: scoringConfig.claimRule
    },
    models,
    repetitionsPerLane: experimentConfig.repetitionsPerLane,
    executionPolicy: experimentConfig.executionPolicy,
    pricing: {
      pricingAsOf: costsConfig.pricingAsOf,
      source: costsConfig.source,
      rateType: costsConfig.rateType,
      monetaryClaimsEnabled:
        Boolean(costsConfig.pricingAsOf) &&
        Boolean(costsConfig.source) &&
        costsConfig.rateType !== "unavailable" &&
        promptsAndSpecs.every(
          (entry) => hasVerifiableAuthoringCost(entry.specAuthoringEffort)
        )
    },
    approvals
  };
  const recordSha256 = createHash("sha256")
    .update(JSON.stringify(readiness))
    .digest("hex");
  return { ...readiness, recordSha256 };
}

export function computeFreezeRecordSha256(record) {
  const unsignedRecord = { ...record };
  delete unsignedRecord.recordSha256;
  return createHash("sha256").update(JSON.stringify(unsignedRecord)).digest("hex");
}

export function assertUsableFreezeRecord(record, expectedSha256 = null) {
  const computedSha256 = computeFreezeRecordSha256(record);
  if (record.recordSha256 !== computedSha256) {
    throw new Error("Freeze record self-hash is invalid");
  }
  if (expectedSha256 !== null && record.recordSha256 !== expectedSha256) {
    throw new Error("Freeze record hash does not match the measured artifacts");
  }
  if (
    record.schemaVersion !== "freeze-readiness/1.0.0" ||
    record.ready !== true ||
    record.repository?.clean !== true ||
    !Array.isArray(record.blockers) ||
    record.blockers.length !== 0
  ) {
    throw new Error("Measured evidence requires a ready, clean freeze record with no blockers");
  }
  const storedApprovalBlockers = approvalBlockers(record.approvals);
  if (storedApprovalBlockers.length > 0) {
    throw new Error(
      `Measured evidence requires all independent freeze approvals: ${storedApprovalBlockers.join(" ")}`
    );
  }
  for (const entry of record.promptsAndSpecs ?? []) {
    const effort = entry.specAuthoringEffort;
    if (
      !effort ||
      !Number.isInteger(effort.inputTokens) ||
      effort.inputTokens < 0 ||
      !Number.isInteger(effort.outputTokens) ||
      effort.outputTokens < 0
    ) {
      throw new Error(
        `Freeze record has invalid specification authoring effort for ${entry.episodeId ?? "an episode"}`
      );
    }
    if (
      effort.estimatedCostUsd !== null &&
      !hasVerifiableAuthoringCost(effort)
    ) {
      throw new Error(
        `Freeze record has unverifiable specification authoring cost for ${entry.episodeId ?? "an episode"}`
      );
    }
  }
  return record;
}

function hasVerifiableAuthoringCost(effort) {
  const meteredTokens = (effort?.inputTokens ?? 0) + (effort?.outputTokens ?? 0);
  return (
    typeof effort?.estimatedCostUsd === "number" &&
    (meteredTokens === 0 || effort.estimatedCostUsd > 0) &&
    typeof effort.costEvidenceRef === "string" &&
    effort.costEvidenceRef.length > 0 &&
    typeof effort.costMethod === "string" &&
    effort.costMethod.length > 0
  );
}

export function writeFreezeReadiness(readiness, outputPath) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");
  return outputPath;
}
