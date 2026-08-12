import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreRun } from "../src/scoring.js";

const scoringConfig = {
  weights: {
    functionalCorrectness: 35,
    behaviorPreservation: 20,
    securityControls: 15,
    maintainability: 15,
    operability: 10,
    scopeTraceability: 5
  },
  hardGates: [
    "build",
    "essential-business-invariants",
    "maker-checker-separation",
    "audit-integrity",
    "no-critical-security-findings"
  ]
};

function allGatesPassed() {
  return Object.fromEntries(scoringConfig.hardGates.map((g) => [g, true]));
}

test("a perfect evaluator produces a qualityScore of 100", () => {
  const evaluator = {
    scores: {
      functionalCorrectness: 100,
      behaviorPreservation: 100,
      securityControls: 100,
      maintainability: 100,
      operability: 100,
      scopeTraceability: 100
    },
    hardGates: allGatesPassed()
  };
  const result = scoreRun(evaluator, scoringConfig);
  assert.strictEqual(result.qualityScore, 100);
  assert.strictEqual(result.hardGatesPassed, true);
});

test("qualityScore is the weighted average of dimension scores", () => {
  const evaluator = {
    scores: {
      functionalCorrectness: 80, // *35
      behaviorPreservation: 80, // *20
      securityControls: 80, // *15
      maintainability: 80, // *15
      operability: 80, // *10
      scopeTraceability: 80 // *5
    },
    hardGates: allGatesPassed()
  };
  const result = scoreRun(evaluator, scoringConfig);
  assert.strictEqual(result.qualityScore, 80);
});

test("a single low dimension pulls the weighted score down proportionally to its weight", () => {
  const evaluator = {
    scores: {
      functionalCorrectness: 0, // heaviest weight (35) zeroed out
      behaviorPreservation: 100,
      securityControls: 100,
      maintainability: 100,
      operability: 100,
      scopeTraceability: 100
    },
    hardGates: allGatesPassed()
  };
  const result = scoreRun(evaluator, scoringConfig);
  assert.strictEqual(result.qualityScore, 65); // 100 - 35
});

test("a missing hard gate counts as failed", () => {
  const evaluator = {
    scores: {
      functionalCorrectness: 100,
      behaviorPreservation: 100,
      securityControls: 100,
      maintainability: 100,
      operability: 100,
      scopeTraceability: 100
    },
    hardGates: { build: true } // missing the rest
  };
  const result = scoreRun(evaluator, scoringConfig);
  assert.strictEqual(result.hardGatesPassed, false);
  assert.ok(result.failedGates.includes("essential-business-invariants"));
  assert.ok(result.failedGates.includes("audit-integrity"));
});

test("an explicit false hard gate is reported as failed", () => {
  const evaluator = {
    scores: { functionalCorrectness: 100, behaviorPreservation: 100, securityControls: 100, maintainability: 100, operability: 100, scopeTraceability: 100 },
    hardGates: { ...allGatesPassed(), "no-critical-security-findings": false }
  };
  const result = scoreRun(evaluator, scoringConfig);
  assert.strictEqual(result.hardGatesPassed, false);
  assert.deepStrictEqual(result.failedGates, ["no-critical-security-findings"]);
});

test("missing dimensions are reported without crashing", () => {
  const evaluator = {
    scores: { functionalCorrectness: 90 },
    hardGates: allGatesPassed()
  };
  const result = scoreRun(evaluator, scoringConfig);
  assert.ok(result.missingDimensions.length === 5);
  assert.ok(!Number.isNaN(result.qualityScore));
});
