import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, writeReport } from "../src/report.js";
import { validateAgainstSchema } from "../src/schema-lite.js";
import { loadReportSchema } from "../src/config.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const scoringConfig = {
  weights: {
    functionalCorrectness: 35,
    behaviorPreservation: 20,
    securityControls: 15,
    maintainability: 15,
    operability: 10,
    scopeTraceability: 5
  },
  hardGates: ["build", "essential-business-invariants", "maker-checker-separation", "audit-integrity", "no-critical-security-findings"],
  claimRule: {
    comparisonLane: "efficient-spec",
    controlLane: "frontier-raw",
    equivalentWithinPoints: 3,
    betterByMoreThanPoints: 3,
    requireAllHardGates: true,
    requireLowerMedianCostOrElapsedTimeForEfficiency: true
  }
};

function makeRun(overrides = {}) {
  return {
    runId: "modernization-efficient-spec-r1",
    episodeId: "modernization",
    laneId: "efficient-spec",
    modelDisplayName: "MAI Code 1.1 Flash",
    inputMode: "spec",
    repetition: 1,
    status: "completed",
    qualityScore: 88,
    hardGatesPassed: true,
    scores: {
      functionalCorrectness: 90,
      behaviorPreservation: 85,
      securityControls: 95,
      maintainability: 80,
      operability: 88,
      scopeTraceability: 92
    },
    elapsedSeconds: 1200,
    toolCalls: 10,
    inputTokens: 100,
    outputTokens: 50,
    estimatedCostUsd: null,
    evidencePath: "evidence/x",
    ...overrides
  };
}

test("buildReport throws on an empty run list", () => {
  assert.throws(() => buildReport({ runs: [], benchmarkVersion: "1.0.0", repetitionsPerLane: 3, dataKind: "illustrative", scoringConfig }), /empty/);
});

test("buildReport groups runs by episode and produces one entry per episode", () => {
  const runs = [
    makeRun({ episodeId: "modernization" }),
    makeRun({ episodeId: "audit-feature", runId: "audit-feature-efficient-spec-r1" })
  ];
  const report = buildReport({ runs, benchmarkVersion: "1.0.0", repetitionsPerLane: 3, dataKind: "illustrative", scoringConfig });
  const ids = report.episodes.map((e) => e.id).sort();
  assert.deepStrictEqual(ids, ["audit-feature", "modernization"]);
});

test("buildReport output validates against contracts/report.schema.json", () => {
  const runs = [
    makeRun(),
    makeRun({ runId: "modernization-frontier-raw-r1", laneId: "frontier-raw", inputMode: "raw", modelDisplayName: "Claude Opus 5" })
  ];
  const report = buildReport({ runs, benchmarkVersion: "1.0.0", repetitionsPerLane: 3, dataKind: "illustrative", scoringConfig });
  const { valid, errors } = validateAgainstSchema(loadReportSchema(), report);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(valid, true);
});

test("buildReport forces claim.status to not-evaluated for illustrative data even with favorable-looking numbers", () => {
  const runs = [
    makeRun({ qualityScore: 100, elapsedSeconds: 1 }),
    makeRun({ runId: "modernization-frontier-raw-r1", laneId: "frontier-raw", inputMode: "raw", qualityScore: 1, elapsedSeconds: 999999 })
  ];
  const report = buildReport({ runs, benchmarkVersion: "1.0.0", repetitionsPerLane: 3, dataKind: "illustrative", scoringConfig });
  assert.strictEqual(report.claim.status, "not-evaluated");
});

test("buildReport keeps pricingAsOf null when no dated pricing is configured", () => {
  const runs = [makeRun()];
  const report = buildReport({ runs, benchmarkVersion: "1.0.0", repetitionsPerLane: 3, dataKind: "illustrative", pricingAsOf: null, scoringConfig });
  assert.strictEqual(report.metadata.pricingAsOf, null);
  assert.strictEqual(report.episodes[0].runs[0].estimatedCostUsd, null);
});

test("writeReport writes the report JSON to disk", () => {
  const runs = [makeRun()];
  const report = buildReport({ runs, benchmarkVersion: "1.0.0", repetitionsPerLane: 3, dataKind: "illustrative", scoringConfig });
  const dir = mkdtempSync(path.join(tmpdir(), "bench-report-"));
  try {
    const outPath = path.join(dir, "report.json");
    writeReport(report, outPath);
    assert.ok(existsSync(outPath));
    const onDisk = JSON.parse(readFileSync(outPath, "utf8"));
    assert.strictEqual(onDisk.metadata.dataKind, "illustrative");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
