import { loadScoringConfig } from "./config.js";

/**
 * Compute a run's weighted qualityScore from an evaluator's raw dimension
 * scores (each 0-100) using `benchmark/config/scoring.json` weights, and
 * determine whether every configured hard gate passed.
 *
 * `evaluator` shape:
 *   {
 *     scores: { functionalCorrectness, behaviorPreservation, securityControls,
 *               maintainability, operability, scopeTraceability }, // each 0-100
 *     hardGates: { build: true, "essential-business-invariants": true, ... }
 *   }
 *
 * A missing or false hard gate entry counts as failed. An unlisted hard
 * gate (not present in the evaluator's hardGates object at all) also counts
 * as failed, since a gate the evaluator didn't check cannot be assumed to
 * pass.
 */
export function scoreRun(evaluator, scoringConfig = loadScoringConfig()) {
  const { weights, hardGates } = scoringConfig;

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let weightedSum = 0;
  const missingDimensions = [];
  for (const [dimension, weight] of Object.entries(weights)) {
    const score = evaluator.scores?.[dimension];
    if (typeof score !== "number") {
      missingDimensions.push(dimension);
      continue;
    }
    weightedSum += (score / 100) * weight;
  }

  const qualityScore = Math.round(((weightedSum / totalWeight) * 100) * 100) / 100;

  const failedGates = hardGates.filter((gate) => evaluator.hardGates?.[gate] !== true);
  const hardGatesPassed = failedGates.length === 0;

  return {
    qualityScore,
    hardGatesPassed,
    failedGates,
    missingDimensions,
    scores: evaluator.scores
  };
}
