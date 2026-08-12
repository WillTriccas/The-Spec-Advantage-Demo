import { test } from "node:test";
import assert from "node:assert/strict";
import { determineClaim } from "../src/claim.js";

const claimRule = {
  comparisonLane: "efficient-spec",
  controlLane: "frontier-raw",
  equivalentWithinPoints: 3,
  betterByMoreThanPoints: 3,
  requireAllHardGates: true,
  requireLowerMedianCostOrElapsedTimeForEfficiency: true
};

function run(laneId, overrides = {}) {
  return {
    laneId,
    modelDisplayName: "x",
    inputMode: laneId.endsWith("spec") ? "spec" : "raw",
    qualityScore: 90,
    hardGatesPassed: true,
    elapsedSeconds: 1000,
    estimatedCostUsd: null,
    ...overrides
  };
}

test("illustrative data always yields not-evaluated regardless of how favorable the numbers look", () => {
  const runs = [
    run("efficient-spec", { qualityScore: 100, elapsedSeconds: 1 }),
    run("frontier-raw", { qualityScore: 1, elapsedSeconds: 100000 })
  ];
  const claim = determineClaim(runs, { claimRule, dataKind: "illustrative" });
  assert.strictEqual(claim.status, "not-evaluated");
  assert.strictEqual(claim.qualityDelta, null);
  assert.match(claim.message, /illustrative/i);
});

test("not-evaluated when one of the two lanes has no runs at all", () => {
  const runs = [run("efficient-spec"), run("efficient-spec")];
  const claim = determineClaim(runs, { claimRule, dataKind: "measured" });
  assert.strictEqual(claim.status, "not-evaluated");
});

test("not-supported when a hard gate fails in the comparison lane", () => {
  const runs = [
    run("efficient-spec", { hardGatesPassed: false }),
    run("efficient-spec", { hardGatesPassed: true }),
    run("frontier-raw", { hardGatesPassed: true }),
    run("frontier-raw", { hardGatesPassed: true })
  ];
  const claim = determineClaim(runs, { claimRule, dataKind: "measured" });
  assert.strictEqual(claim.status, "not-supported");
});

test("not-supported when comparison quality is meaningfully worse than control", () => {
  const runs = [
    run("efficient-spec", { qualityScore: 70, elapsedSeconds: 500 }),
    run("frontier-raw", { qualityScore: 90, elapsedSeconds: 1000 })
  ];
  const claim = determineClaim(runs, { claimRule, dataKind: "measured" });
  assert.strictEqual(claim.status, "not-supported");
  assert.strictEqual(claim.qualityDelta, -20);
});

test("inconclusive when quality is non-inferior but no cost/time efficiency is demonstrated", () => {
  const runs = [
    run("efficient-spec", { qualityScore: 90, elapsedSeconds: 1200, estimatedCostUsd: null }),
    run("frontier-raw", { qualityScore: 90, elapsedSeconds: 1000, estimatedCostUsd: null })
  ];
  const claim = determineClaim(runs, { claimRule, dataKind: "measured" });
  assert.strictEqual(claim.status, "inconclusive");
});

test("supported (non-inferior to) when quality is within margin and elapsed time is lower", () => {
  const runs = [
    run("efficient-spec", { qualityScore: 89, elapsedSeconds: 500 }),
    run("frontier-raw", { qualityScore: 90, elapsedSeconds: 1000 })
  ];
  const claim = determineClaim(runs, { claimRule, dataKind: "measured" });
  assert.strictEqual(claim.status, "supported");
  assert.match(claim.message, /non-inferior to/);
});

test("supported (better than) when comparison quality clearly exceeds control and cost is lower", () => {
  const runs = [
    run("efficient-spec", { qualityScore: 95, elapsedSeconds: 800, estimatedCostUsd: 1.0 }),
    run("frontier-raw", { qualityScore: 85, elapsedSeconds: 1000, estimatedCostUsd: 5.0 })
  ];
  const claim = determineClaim(runs, { claimRule, dataKind: "measured" });
  assert.strictEqual(claim.status, "supported");
  assert.match(claim.message, /better than/);
  assert.strictEqual(claim.qualityDelta, 10);
  assert.ok(claim.costSavingPercent > 0);
});

test("costSavingPercent is null unless both lanes have non-null median costs", () => {
  const runs = [
    run("efficient-spec", { qualityScore: 92, elapsedSeconds: 800, estimatedCostUsd: null }),
    run("frontier-raw", { qualityScore: 90, elapsedSeconds: 1000, estimatedCostUsd: 5.0 })
  ];
  const claim = determineClaim(runs, { claimRule, dataKind: "measured" });
  assert.strictEqual(claim.costSavingPercent, null);
});
