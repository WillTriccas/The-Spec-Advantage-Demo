import { aggregateLane } from "./aggregate.js";

/**
 * Determine the benchmark's pre-registered claim status by comparing the
 * `comparisonLane` (efficient model + approved spec) against the
 * `controlLane` (frontier model + raw brief), per
 * `benchmark/config/scoring.json`'s `claimRule`.
 *
 * `allRuns` is every scored run across every episode. The comparison
 * combines runs for each lane across both episodes into one pooled sample,
 * since the pre-registered claim is about the benchmark as a whole, not
 * about a single episode.
 *
 * Illustrative data can exercise this function and the dashboard, but per
 * the committed decision record it can never produce anything other than
 * "not-evaluated" — it must never be reported as if it were measured
 * support for or against the claim.
 */
export function determineClaim(allRuns, { claimRule, dataKind }) {
  if (dataKind === "illustrative") {
    return {
      status: "not-evaluated",
      qualityDelta: null,
      costSavingPercent: null,
      message:
        "This report contains illustrative data only, generated to exercise the dashboard. No real benchmark runs have been evaluated, so the pre-registered claim cannot be assessed. This data must not be interpreted as evidence for or against the benchmark claim."
    };
  }

  const comparisonRuns = allRuns.filter((r) => r.laneId === claimRule.comparisonLane);
  const controlRuns = allRuns.filter((r) => r.laneId === claimRule.controlLane);

  if (comparisonRuns.length === 0 || controlRuns.length === 0) {
    return {
      status: "not-evaluated",
      qualityDelta: null,
      costSavingPercent: null,
      message: `Insufficient data: expected runs for both "${claimRule.comparisonLane}" and "${claimRule.controlLane}" to evaluate the claim.`
    };
  }

  const comparison = aggregateLane(comparisonRuns);
  const control = aggregateLane(controlRuns);

  const qualityDelta = Math.round((comparison.qualityMedian - control.qualityMedian) * 100) / 100;

  const hardGatesOk =
    !claimRule.requireAllHardGates ||
    (comparison.hardGatePassCount === comparison.runCount && control.hardGatePassCount === control.runCount);

  const costBetter =
    comparison.costMedianUsd !== null &&
    control.costMedianUsd !== null &&
    comparison.costMedianUsd < control.costMedianUsd;
  const timeBetter = comparison.elapsedMedianSeconds < control.elapsedMedianSeconds;
  const efficiencyOk = !claimRule.requireLowerMedianCostOrElapsedTimeForEfficiency || costBetter || timeBetter;

  let costSavingPercent = null;
  if (comparison.costMedianUsd !== null && control.costMedianUsd !== null && control.costMedianUsd > 0) {
    costSavingPercent =
      Math.round(((control.costMedianUsd - comparison.costMedianUsd) / control.costMedianUsd) * 100 * 100) / 100;
  }

  if (!hardGatesOk) {
    return {
      status: "not-supported",
      qualityDelta,
      costSavingPercent,
      message: `Claim not supported: not every run in "${claimRule.comparisonLane}" or "${claimRule.controlLane}" passed all hard gates (comparison ${comparison.hardGatePassCount}/${comparison.runCount}, control ${control.hardGatePassCount}/${control.runCount}).`
    };
  }

  if (qualityDelta < -claimRule.equivalentWithinPoints) {
    return {
      status: "not-supported",
      qualityDelta,
      costSavingPercent,
      message: `Claim not supported: "${claimRule.comparisonLane}" scored ${Math.abs(qualityDelta)} points below "${claimRule.controlLane}", exceeding the ${claimRule.equivalentWithinPoints}-point non-inferiority margin.`
    };
  }

  if (!efficiencyOk) {
    return {
      status: "inconclusive",
      qualityDelta,
      costSavingPercent,
      message: `Quality is non-inferior (delta ${qualityDelta}), but "${claimRule.comparisonLane}" did not show a lower median cost or elapsed time than "${claimRule.controlLane}", so the efficiency claim is inconclusive.`
    };
  }

  const comparator = qualityDelta > claimRule.betterByMoreThanPoints ? "better than" : "non-inferior to";
  return {
    status: "supported",
    qualityDelta,
    costSavingPercent,
    message: `Claim supported: "${claimRule.comparisonLane}" is ${comparator} "${claimRule.controlLane}" (quality delta ${qualityDelta}), all hard gates passed, and it demonstrated lower median cost or elapsed time.`
  };
}
