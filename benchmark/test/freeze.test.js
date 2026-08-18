import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approvalBlockers,
  assertUsableFreezeRecord,
  computeFreezeRecordSha256,
  createFreezeReadiness
} from "../src/freeze.js";
import { loadExperimentConfig } from "../src/config.js";

test("freeze readiness fails closed while the benchmark is unfrozen and model versions are unpinned", () => {
  const experimentConfig = structuredClone(loadExperimentConfig());
  experimentConfig.benchmarkVersion = "unfrozen";
  for (const model of Object.values(experimentConfig.models)) {
    model.buildId = null;
    model.agentVersion = null;
    model.agentBuildId = null;
    model.effortParams.reasoningEffort = null;
  }
  const readiness = createFreezeReadiness({
    generatedAt: "2026-08-12T14:00:00Z",
    experimentConfig
  });
  assert.strictEqual(readiness.ready, false);
  assert.ok(readiness.blockers.some((blocker) => blocker.includes("benchmarkVersion")));
  assert.ok(readiness.blockers.some((blocker) => blocker.includes("buildId")));
  assert.ok(readiness.blockers.some((blocker) => blocker.includes("agentBuildId")));
  assert.match(readiness.recordSha256, /^[a-f0-9]{64}$/);
});

test("freeze readiness records every immutable input category", () => {
  const readiness = createFreezeReadiness({ generatedAt: "2026-08-12T14:00:00Z" });
  assert.strictEqual(readiness.baselines.length, 2);
  assert.strictEqual(readiness.promptsAndSpecs.length, 2);
  assert.match(readiness.promptsAndSpecs[0].rawPromptSha256, /^[a-f0-9]{64}$/);
  assert.match(readiness.promptsAndSpecs[0].specPromptSha256, /^[a-f0-9]{64}$/);
  assert.match(readiness.frozenInputs.evaluatorSha256, /^[a-f0-9]{64}$/);
  assert.match(readiness.frozenInputs.scoringConfigSha256, /^[a-f0-9]{64}$/);
  assert.deepStrictEqual(readiness.frozenInputs.claimRule, readiness.frozenInputs.claimRule);
});

test("approval blockers require all independent approval sections", () => {
  const blockers = approvalBlockers({ schemaVersion: "1.0.0" });
  assert.strictEqual(blockers.length, 4);
  assert.ok(blockers.some((blocker) => blocker.includes("scenario")));
  assert.ok(blockers.some((blocker) => blocker.includes("claimAdjudication")));
});

test("freeze record verification rejects serialized readiness without approvals", () => {
  const record = {
    schemaVersion: "freeze-readiness/1.0.0",
    ready: true,
    blockers: [],
    repository: { clean: true }
  };
  record.recordSha256 = computeFreezeRecordSha256(record);
  assert.throws(() => assertUsableFreezeRecord(record), /requires all independent freeze approvals/);
});
