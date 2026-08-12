import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareRunWorkspace, hashDirectory, assertNoSpecLeakage, assertFrozenForMeasuredData } from "../src/prepare.js";
import { buildPlannedRuns } from "../src/runs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "bench-prepare-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("hashDirectory is deterministic for identical content", () => {
  withTempDir((dir) => {
    writeFileSync(path.join(dir, "a.txt"), "hello", "utf8");
    mkdirSync(path.join(dir, "sub"));
    writeFileSync(path.join(dir, "sub", "b.txt"), "world", "utf8");
    const h1 = hashDirectory(dir);
    const h2 = hashDirectory(dir);
    assert.strictEqual(h1, h2);
    assert.match(h1, /^[a-f0-9]{64}$/);
  });
});

test("hashDirectory changes when file content changes", () => {
  withTempDir((dir) => {
    writeFileSync(path.join(dir, "a.txt"), "hello", "utf8");
    const before = hashDirectory(dir);
    writeFileSync(path.join(dir, "a.txt"), "hello world", "utf8");
    const after = hashDirectory(dir);
    assert.notStrictEqual(before, after);
  });
});

test("prepareRunWorkspace for a raw lane copies only the baseline and the raw brief prompt", () => {
  withTempDir((baselineDir) => {
    writeFileSync(path.join(baselineDir, "Program.cs"), "// legacy code", "utf8");
    withTempDir((outputRoot) => {
      const run = buildPlannedRuns().find((r) => r.runId === "modernization-efficient-raw-r1");
      const result = prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot: REPO_ROOT });

      assert.ok(existsSync(path.join(result.workspaceDir, "Program.cs")));
      const prompt = readFileSync(result.promptPath, "utf8");
      assert.match(prompt, /Modernize the trade reconciliation app/);
      // The raw prompt must not contain spec-bundle-specific markers like stage headings.
      assert.doesNotMatch(prompt, /## Traceability/);

      assertNoSpecLeakage(run, result.workspaceDir, REPO_ROOT);

      const plan = JSON.parse(readFileSync(result.planPath, "utf8"));
      assert.strictEqual(plan.spec, null);
      assert.strictEqual(plan.inputMode, "raw");
    });
  });
});

test("prepareRunWorkspace for a spec lane renders the approved spec as the prompt", () => {
  withTempDir((baselineDir) => {
    writeFileSync(path.join(baselineDir, "Program.cs"), "// legacy code", "utf8");
    withTempDir((outputRoot) => {
      const run = buildPlannedRuns().find((r) => r.runId === "modernization-efficient-spec-r1");
      const result = prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot: REPO_ROOT });

      const prompt = readFileSync(result.promptPath, "utf8");
      assert.match(prompt, /## Requirements/);
      assert.match(prompt, /REQ-1/);

      const plan = JSON.parse(readFileSync(result.planPath, "utf8"));
      assert.strictEqual(plan.spec.id, "modernization-approved");
      assert.match(plan.spec.sha256, /^[a-f0-9]{64}$/);
      assert.strictEqual(plan.spec.qualityScore, 100);
      assert.strictEqual(plan.inputMode, "spec");
    });
  });
});

test("prepareRunWorkspace computes a baseline sha256 recorded in plan.json", () => {
  withTempDir((baselineDir) => {
    writeFileSync(path.join(baselineDir, "Program.cs"), "// legacy code", "utf8");
    withTempDir((outputRoot) => {
      const run = buildPlannedRuns().find((r) => r.runId === "audit-feature-frontier-raw-r2");
      const result = prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot: REPO_ROOT });
      const plan = JSON.parse(readFileSync(result.planPath, "utf8"));
      assert.match(plan.baseline.sha256, /^[a-f0-9]{64}$/);
      assert.strictEqual(plan.baseline.sha256, hashDirectory(baselineDir));
    });
  });
});

test("prepareRunWorkspace throws when the baseline directory does not exist", () => {
  withTempDir((outputRoot) => {
    const run = buildPlannedRuns().find((r) => r.runId === "modernization-efficient-raw-r1");
    assert.throws(() => {
      prepareRunWorkspace(run, { baselineDir: path.join(outputRoot, "nope"), outputRoot, repoRoot: REPO_ROOT });
    }, /does not exist/);
  });
});

test("assertNoSpecLeakage does not throw for a clean raw-lane workspace", () => {
  withTempDir((baselineDir) => {
    writeFileSync(path.join(baselineDir, "Program.cs"), "// legacy code", "utf8");
    withTempDir((outputRoot) => {
      const run = buildPlannedRuns().find((r) => r.runId === "audit-feature-efficient-raw-r1");
      const result = prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot: REPO_ROOT });
      assert.doesNotThrow(() => assertNoSpecLeakage(run, result.workspaceDir, REPO_ROOT));
    });
  });
});

test("assertNoSpecLeakage throws if a spec-bundle file is found in a raw workspace", () => {
  withTempDir((baselineDir) => {
    withTempDir((outputRoot) => {
      const run = buildPlannedRuns().find((r) => r.runId === "modernization-efficient-raw-r1");
      const fakeWorkspace = path.join(outputRoot, "fake-workspace");
      mkdirSync(fakeWorkspace, { recursive: true });
      // Simulate accidental leakage: copy a real spec bundle file's name into the raw workspace.
      writeFileSync(path.join(fakeWorkspace, "intent.json"), "{}", "utf8");
      assert.throws(() => assertNoSpecLeakage(run, fakeWorkspace, REPO_ROOT), /leakage/i);
    });
  });
});

test("prepareRunWorkspace writes a provenance.json with task-brief and config hashes for a raw lane", () => {
  withTempDir((baselineDir) => {
    writeFileSync(path.join(baselineDir, "Program.cs"), "// legacy code", "utf8");
    withTempDir((outputRoot) => {
      const run = buildPlannedRuns().find((r) => r.runId === "modernization-efficient-raw-r1");
      const result = prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot: REPO_ROOT });
      assert.ok(existsSync(result.provenancePath));
      const provenance = JSON.parse(readFileSync(result.provenancePath, "utf8"));
      assert.match(provenance.hashes.taskBriefSha256, /^[a-f0-9]{64}$/);
      assert.strictEqual(provenance.hashes.specManifestSha256, null);
      assert.match(provenance.hashes.scoringConfigSha256, /^[a-f0-9]{64}$/);
      assert.match(provenance.hashes.experimentConfigSha256, /^[a-f0-9]{64}$/);
    });
  });
});

test("prepareRunWorkspace writes a provenance.json with a spec-manifest hash (not a task-brief hash) for a spec lane", () => {
  withTempDir((baselineDir) => {
    writeFileSync(path.join(baselineDir, "Program.cs"), "// legacy code", "utf8");
    withTempDir((outputRoot) => {
      const run = buildPlannedRuns().find((r) => r.runId === "modernization-efficient-spec-r1");
      const result = prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot: REPO_ROOT });
      const provenance = JSON.parse(readFileSync(result.provenancePath, "utf8"));
      assert.strictEqual(provenance.hashes.taskBriefSha256, null);
      assert.match(provenance.hashes.specManifestSha256, /^[a-f0-9]{64}$/);
    });
  });
});

test("plan.json's model object carries buildId/agentVersion/effortParams through from the run descriptor", () => {
  withTempDir((baselineDir) => {
    writeFileSync(path.join(baselineDir, "Program.cs"), "// legacy code", "utf8");
    withTempDir((outputRoot) => {
      const run = { ...buildPlannedRuns().find((r) => r.runId === "modernization-efficient-raw-r1"), modelBuildId: "build-123", modelAgentVersion: "agent-9", modelEffortParams: { reasoningEffort: "high" } };
      const result = prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot: REPO_ROOT });
      assert.strictEqual(result.plan.model.buildId, "build-123");
      assert.strictEqual(result.plan.model.agentVersion, "agent-9");
      assert.deepStrictEqual(result.plan.model.effortParams, { reasoningEffort: "high" });
    });
  });
});

test("validateRunConsistency throws when a run's inputMode doesn't match its lane's configured inputMode", () => {
  withTempDir((baselineDir) => {
    writeFileSync(path.join(baselineDir, "Program.cs"), "// legacy code", "utf8");
    withTempDir((outputRoot) => {
      const run = { ...buildPlannedRuns().find((r) => r.runId === "modernization-efficient-raw-r1"), inputMode: "spec" };
      assert.throws(() => prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot: REPO_ROOT }), /inputMode/);
    });
  });
});

test("validateRunConsistency throws when a run's modelId doesn't match its modelTier's configured model", () => {
  withTempDir((baselineDir) => {
    writeFileSync(path.join(baselineDir, "Program.cs"), "// legacy code", "utf8");
    withTempDir((outputRoot) => {
      const run = { ...buildPlannedRuns().find((r) => r.runId === "modernization-efficient-raw-r1"), modelId: "not-the-configured-model" };
      assert.throws(() => prepareRunWorkspace(run, { baselineDir, outputRoot, repoRoot: REPO_ROOT }), /modelId/);
    });
  });
});

test("assertFrozenForMeasuredData is a no-op for an unfrozen benchmarkVersion", () => {
  const result = assertFrozenForMeasuredData("unfrozen");
  assert.strictEqual(result.enforced, false);
});

