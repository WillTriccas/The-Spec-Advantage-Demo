import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareRunWorkspace, hashDirectory, assertNoSpecLeakage } from "../src/prepare.js";
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
