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

test("importRun throws when a raw-lane plan carries a non-null spec", () => {
  withTempDir((runDir) => {
    writePlan(runDir, {
      laneId: "efficient-raw",
      inputMode: "raw",
      spec: { id: "modernization-approved", sha256: "b".repeat(64), qualityScore: 100 }
    });
    assert.throws(() => importRun(baseArgs(runDir)), /raw-lane run but carries a non-null spec/);
  });
});

test("importRun throws when a spec-lane plan carries a null spec", () => {
  withTempDir((runDir) => {
    writePlan(runDir, { laneId: "efficient-spec", inputMode: "spec", spec: null });
    assert.throws(() => importRun(baseArgs(runDir)), /spec-lane run but carries a null spec/);
  });
});

test("importRun throws when the plan's model.id doesn't match the model tier's configured model", () => {
  withTempDir((runDir) => {
    writePlan(runDir, { model: { id: "not-the-configured-model", displayName: "x", tier: "efficient" } });
    assert.throws(() => importRun(baseArgs(runDir)), /model\.id/);
  });
});

test("importRun writes a provenance.json merging prepare-time hashes with import-time frozen versions", () => {
  withTempDir((runDir) => {
    writeFileSync(
      path.join(runDir, "provenance.json"),
      JSON.stringify({ schemaVersion: "1.0.0", runId: "modernization-efficient-spec-r1", hashes: { taskBriefSha256: null, specManifestSha256: "c".repeat(64) } }),
      "utf8"
    );
    writePlan(runDir);
    const { provenancePath } = importRun(baseArgs(runDir, { benchmarkVersion: "unfrozen" }));
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
    assert.strictEqual(provenance.hashes.specManifestSha256, "c".repeat(64));
    assert.strictEqual(provenance.frozenVersions.benchmarkVersion, "unfrozen");
    assert.strictEqual(provenance.frozenVersions.baselineRef, "refs/tags/benchmark-legacy-v1");
    assert.match(provenance.hashes.costsConfigSha256, /^[a-f0-9]{64}$/);
  });
});

test("importRun leaves estimatedCostUsd null when costs.json has no dated pricing for the model", () => {
  withTempDir((runDir) => {
    writePlan(runDir);
    const { run } = importRun(baseArgs(runDir, { costsConfig: { models: {} } }));
    assert.strictEqual(run.execution.estimatedCostUsd, null);
  });
});

test("importRun auto-computes estimatedCostUsd from token usage once costs.json has dated pricing", () => {
  withTempDir((runDir) => {
    writePlan(runDir);
    const costsConfig = {
      models: {
        "mai-code-1.1-flash": {
          pricingAsOf: "2025-01-01",
          source: "test fixture",
          rateType: "list",
          inputPerMillionTokens: 1,
          outputPerMillionTokens: 2
        }
      }
    };
    const { run } = importRun(baseArgs(runDir, { costsConfig }));
    // inputTokens=100, outputTokens=50 from baseArgs
    assert.strictEqual(run.execution.estimatedCostUsd, (100 / 1_000_000) * 1 + (50 / 1_000_000) * 2);
  });
});

test("importRun respects an explicit non-null estimatedCostUsd supplied by the caller over auto-computed cost", () => {
  withTempDir((runDir) => {
    writePlan(runDir);
    const costsConfig = {
      models: {
        "mai-code-1.1-flash": {
          pricingAsOf: "2025-01-01",
          source: "test fixture",
          rateType: "list",
          inputPerMillionTokens: 1,
          outputPerMillionTokens: 2
        }
      }
    };
    const { run } = importRun(
      baseArgs(runDir, { costsConfig, execution: { ...baseArgs(runDir).execution, estimatedCostUsd: 9.99 } })
    );
    assert.strictEqual(run.execution.estimatedCostUsd, 9.99);
  });
});

test("importRun folds an amortized spec-authoring share into a spec-lane run's auto-computed cost", () => {
  withTempDir((runDir) => {
    writePlan(runDir); // spec lane (efficient-spec), episodeId "modernization"
    const costsConfig = {
      models: {
        "mai-code-1.1-flash": {
          pricingAsOf: "2025-01-01",
          source: "test fixture",
          rateType: "list",
          inputPerMillionTokens: 1,
          outputPerMillionTokens: 2
        }
      }
    };
    const tokenCostOnly = (100 / 1_000_000) * 1 + (50 / 1_000_000) * 2;
    const { run } = importRun(baseArgs(runDir, { costsConfig }));
    // The committed modernization spec's manifest.authoringEffort.estimatedCostUsd
    // is currently null (no dated pricing yet), so no amortized share can be
    // added and the auto-computed cost equals the token cost alone. This test
    // documents that expectation and will need updating once authoring cost
    // pricing is dated.
    assert.strictEqual(run.execution.estimatedCostUsd, tokenCostOnly);
  });
});


