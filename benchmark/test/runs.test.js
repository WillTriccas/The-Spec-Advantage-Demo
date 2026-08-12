import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlannedRuns, plannedRunCount } from "../src/runs.js";
import { loadExperimentConfig } from "../src/config.js";

test("exactly 24 runs are planned per the committed experiment contract", () => {
  const runs = buildPlannedRuns();
  assert.strictEqual(runs.length, 24);
  assert.strictEqual(plannedRunCount(), 24);
});

test("every episode x lane x repetition combination is present exactly once", () => {
  const config = loadExperimentConfig();
  const runs = buildPlannedRuns(config);
  const seen = new Set();
  for (const run of runs) {
    const key = `${run.episodeId}::${run.laneId}::${run.repetition}`;
    assert.ok(!seen.has(key), `duplicate run combination: ${key}`);
    seen.add(key);
  }
  assert.strictEqual(seen.size, config.episodes.length * config.lanes.length * config.repetitionsPerLane);
});

test("run ids are unique and stable", () => {
  const runs = buildPlannedRuns();
  const ids = new Set(runs.map((r) => r.runId));
  assert.strictEqual(ids.size, runs.length);
});

test("raw lanes carry no spec bundle reference used for prompt content, only metadata", () => {
  const runs = buildPlannedRuns();
  const rawRuns = runs.filter((r) => r.inputMode === "raw");
  assert.ok(rawRuns.length > 0);
  for (const run of rawRuns) {
    assert.ok(run.taskBrief, "raw run must reference a task brief");
  }
});

test("spec lanes reference the approved spec bundle path from the experiment config", () => {
  const runs = buildPlannedRuns();
  const specRuns = runs.filter((r) => r.inputMode === "spec");
  for (const run of specRuns) {
    assert.ok(run.specBundle.includes("approved"));
  }
});

test("model tier assignment matches configured lanes", () => {
  const runs = buildPlannedRuns();
  for (const run of runs) {
    if (run.laneId.startsWith("efficient")) {
      assert.strictEqual(run.modelTier, "efficient");
      assert.strictEqual(run.modelDisplayName, "MAI Code 1.1 Flash");
    } else {
      assert.strictEqual(run.modelTier, "frontier");
      assert.strictEqual(run.modelDisplayName, "Claude Opus 5");
    }
  }
});
