import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { importRun } from "../src/import.js";

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "bench-import-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writePlan(runDir, overrides = {}) {
  const plan = {
    schemaVersion: "1.0.0",
    runId: "modernization-efficient-spec-r1",
    episodeId: "modernization",
    laneId: "efficient-spec",
    model: { id: "mai-code-1.1-flash", displayName: "MAI Code 1.1 Flash", tier: "efficient" },
    inputMode: "spec",
    repetition: 1,
    baseline: { ref: "refs/tags/benchmark-legacy-v1", sha256: "a".repeat(64) },
    spec: { id: "modernization-approved", sha256: "b".repeat(64), qualityScore: 100 },
    ...overrides
  };
  writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(plan), "utf8");
  return plan;
}

function baseArgs(runDir, overrides = {}) {
  return {
    runDir,
    benchmarkVersion: "1.0.0",
    baselineCommit: "abcdef1234",
    execution: {
      status: "completed",
      startedAt: "2024-06-01T10:00:00Z",
      endedAt: "2024-06-01T10:20:00Z",
      elapsedSeconds: 1200,
      agentVersion: "v1",
      toolCalls: 10,
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostUsd: null
    },
    source: { commit: "abc1234", diffPath: "diffs/x.patch" },
    evidence: { directory: "d", transcriptPath: "t", evaluatorPath: "e" },
    ...overrides
  };
}

test("importRun throws when plan.json is missing", () => {
  withTempDir((runDir) => {
    assert.throws(() => importRun(baseArgs(runDir)), /plan\.json/);
  });
});

test("importRun produces a schema-valid run.json with baseline.commit set from baselineCommit, not source.commit", () => {
  withTempDir((runDir) => {
    writePlan(runDir);
    const { run, runJsonPath } = importRun(baseArgs(runDir, { baselineCommit: "baseline-commit-sha", source: { commit: "output-commit-sha", diffPath: "diffs/x.patch" } }));
    assert.strictEqual(run.baseline.commit, "baseline-commit-sha");
    assert.strictEqual(run.source.commit, "output-commit-sha");
    assert.notStrictEqual(run.baseline.commit, run.source.commit);
    assert.ok(existsSync(runJsonPath));
    const onDisk = JSON.parse(readFileSync(runJsonPath, "utf8"));
    assert.strictEqual(onDisk.runId, "modernization-efficient-spec-r1");
  });
});

test("importRun preserves a null source.commit for a failed/incomplete run", () => {
  withTempDir((runDir) => {
    writePlan(runDir);
    const { run } = importRun(
      baseArgs(runDir, {
        execution: {
          status: "failed",
          startedAt: "2024-06-01T10:00:00Z",
          endedAt: "2024-06-01T10:05:00Z",
          elapsedSeconds: 300,
          agentVersion: "v1",
          toolCalls: 2,
          inputTokens: null,
          outputTokens: null,
          estimatedCostUsd: null
        },
        source: { commit: null, diffPath: "diffs/x.patch" }
      })
    );
    assert.strictEqual(run.execution.status, "failed");
    assert.strictEqual(run.source.commit, null);
  });
});

test("importRun carries spec=null through for a raw-lane plan", () => {
  withTempDir((runDir) => {
    writePlan(runDir, { laneId: "efficient-raw", inputMode: "raw", spec: null });
    const { run } = importRun(baseArgs(runDir));
    assert.strictEqual(run.spec, null);
    assert.strictEqual(run.inputMode, "raw");
  });
});

test("importRun throws if the assembled run fails contract schema validation", () => {
  withTempDir((runDir) => {
    writePlan(runDir, { laneId: "not-a-real-lane" });
    assert.throws(() => importRun(baseArgs(runDir)), /schema/i);
  });
});
