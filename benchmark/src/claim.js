import { aggregateLane } from "./aggregate.js";
import { loadCostsConfig } from "./config.js";

/**
 * Read the pricingAsOf date from costs.json purely for labeling messages;
 * never used to gate anything (a null pricingAsOf just means costs stay
 * null, which aggregateLane already handles).
 */
function currentPricingAsOf() {
  try {
    return loadCostsConfig().pricingAsOf ?? null;
  } catch {
    return null;
  }
}

/**
 * Quality-range ("within observed within-lane spread") of a lane summary:
 * the distance between its best and worst run. Used to decide whether an
 * observed quality delta between two lanes is distinguishable from the
 * ordinary run-to-run noise within either lane, per correction item 5
 * ("if delta is within observed within-lane spread, mark inconclusive").
 */
function laneQualitySpread(laneSummary) {
  return laneSummary.qualityMax - laneSummary.qualityMin;
}

/**
 * Decide the efficiency verdict (better/equivalent/worse/unavailable)
 * between a comparison and a control lane summary.
 *
 * Cost (token/monetary, already amortized-inclusive of spec-authoring
 * effort for spec lanes -- see cost.js) is the primary driving metric per
 * correction item 6. Elapsed time is only used as a fallback when cost is
 * unavailable for either lane, and the result is explicitly labeled as
 * elapsed-only so it can never be silently mistaken for a cost comparison.
 */
function determineEfficiencyVerdict(comparison, control) {
  const costAvailable = comparison.costMedianUsd !== null && control.costMedianUsd !== null;

  if (costAvailable) {
    const drivingMetric = "cost";
    if (comparison.costMedianUsd < control.costMedianUsd) {
      return { efficiencyVerdict: "better", drivingMetric, elapsedOnly: false };
    }
    if (comparison.costMedianUsd > control.costMedianUsd) {
      return { efficiencyVerdict: "worse", drivingMetric, elapsedOnly: false };
    }
    return { efficiencyVerdict: "equivalent", drivingMetric, elapsedOnly: false };
  }

  // Cost unavailable (no dated pricing configured yet, per contract) --
  // fall back to elapsed time only, but label it as such per item 6.
  const drivingMetric = "elapsed-time-only (cost unavailable: no dated pricing configured)";
  if (comparison.elapsedMedianSeconds < control.elapsedMedianSeconds) {
    return { efficiencyVerdict: "better", drivingMetric, elapsedOnly: true };
  }
  if (comparison.elapsedMedianSeconds > control.elapsedMedianSeconds) {
    return { efficiencyVerdict: "worse", drivingMetric, elapsedOnly: true };
  }
  return { efficiencyVerdict: "equivalent", drivingMetric, elapsedOnly: true };
}

/**
 * Compute the full claim for a single episode: quality verdict, efficiency
 * verdict (with driving metric), gate visibility for both lanes, and the
 * resulting status (one of the four values `contracts/report.schema.json`
 * allows for `claim.status`).
 *
 * Per correction item 4: the comparison lane's hard gates are load-bearing
 * (any failure blocks a "supported" result); the control lane's hard gate
 * failures are computed and returned for visibility but never block a
 * "better" quality result for the comparison lane -- a raw/control lane
 * failing gates does not by itself invalidate the comparison lane's
 * evidence.
 */
export function computeEpisodeClaim(episodeId, comparisonRuns, controlRuns, { claimRule }) {
  if (comparisonRuns.length === 0 || controlRuns.length === 0) {
    return {
      episodeId,
      status: "not-evaluated",
      qualityVerdict: "indeterminate",
      efficiencyVerdict: "unavailable",
      drivingMetric: null,
      qualityDelta: null,
      costSavingPercent: null,
      comparisonGatesPassed: null,
      controlGatesPassed: null,
      message: `Insufficient data for episode "${episodeId}": expected runs for both "${claimRule.comparisonLane}" and "${claimRule.controlLane}" to evaluate the claim.`
    };
  }

  const comparison = aggregateLane(comparisonRuns);
  const control = aggregateLane(controlRuns);

  const qualityDelta = Math.round((comparison.qualityMedian - control.qualityMedian) * 100) / 100;

  const comparisonGatesPassed = comparison.hardGatePassCount === comparison.runCount;
  const controlGatesPassed = control.hardGatePassCount === control.runCount;
  // Per item 4: only the comparison lane's gates gate the claim. The control
  // lane's gate outcome is always reported (see comparisonGatesPassed /
  // controlGatesPassed above and the message text) but never blocks a
  // "better" quality result for the comparison lane.
  const requiredGatesOk = !claimRule.requireAllHardGates || comparisonGatesPassed;

  const spread = Math.max(laneQualitySpread(comparison), laneQualitySpread(control));
  const withinSpread = Math.abs(qualityDelta) <= spread;

  let costSavingPercent = null;
  if (comparison.costMedianUsd !== null && control.costMedianUsd !== null && control.costMedianUsd > 0) {
    costSavingPercent =
      Math.round(((control.costMedianUsd - comparison.costMedianUsd) / control.costMedianUsd) * 100 * 100) / 100;
  }

  const gateNote = `Comparison lane hard gates: ${comparison.hardGatePassCount}/${comparison.runCount} runs passed all applicable gates. Control lane hard gates (visible, non-blocking): ${control.hardGatePassCount}/${control.runCount} runs passed.`;

  if (!requiredGatesOk) {
    return {
      episodeId,
      status: "not-supported",
      qualityVerdict: "indeterminate",
      efficiencyVerdict: "unavailable",
      drivingMetric: null,
      qualityDelta,
      costSavingPercent,
      comparisonGatesPassed,
      controlGatesPassed,
      message: `Episode "${episodeId}": claim not supported -- not every run in the comparison lane "${claimRule.comparisonLane}" passed all applicable hard gates. ${gateNote}`
    };
  }

  if (withinSpread) {
    return {
      episodeId,
      status: "inconclusive",
      qualityVerdict: "indeterminate",
      efficiencyVerdict: "unavailable",
      drivingMetric: null,
      qualityDelta,
      costSavingPercent,
      comparisonGatesPassed,
      controlGatesPassed,
      message: `Episode "${episodeId}": quality delta (${qualityDelta}) between "${claimRule.comparisonLane}" (range ${comparison.qualityMin}-${comparison.qualityMax}) and "${claimRule.controlLane}" (range ${control.qualityMin}-${control.qualityMax}) is within the observed within-lane spread (${spread} points), so the quality difference is indeterminate -- not distinguishable from ordinary run-to-run variation. ${gateNote}`
    };
  }

  if (qualityDelta < -claimRule.equivalentWithinPoints) {
    return {
      episodeId,
      status: "not-supported",
      qualityVerdict: "worse",
      efficiencyVerdict: "unavailable",
      drivingMetric: null,
      qualityDelta,
      costSavingPercent,
      comparisonGatesPassed,
      controlGatesPassed,
      message: `Episode "${episodeId}": claim not supported -- "${claimRule.comparisonLane}" scored ${Math.abs(qualityDelta)} points below "${claimRule.controlLane}" (quality delta ${qualityDelta}), which is below the -${claimRule.equivalentWithinPoints}-point margin, i.e. "worse" (not merely outside a symmetric band). ${gateNote}`
    };
  }

  const qualityVerdict = qualityDelta > claimRule.betterByMoreThanPoints ? "better" : "equivalent";
  const { efficiencyVerdict, drivingMetric, elapsedOnly } = determineEfficiencyVerdict(comparison, control);

  const elapsedOnlyLabel = elapsedOnly
    ? " NOTE: cost is unavailable (no dated pricing configured), so this efficiency verdict is based on elapsed time only and must not be read as a cost comparison."
    : "";

  if (efficiencyVerdict === "better") {
    return {
      episodeId,
      status: "supported",
      qualityVerdict,
      efficiencyVerdict,
      drivingMetric,
      qualityDelta,
      costSavingPercent,
      comparisonGatesPassed,
      controlGatesPassed,
      message: `Episode "${episodeId}": claim supported -- "${claimRule.comparisonLane}" is ${qualityVerdict === "better" ? "better than" : "non-inferior to"} "${claimRule.controlLane}" on quality (delta ${qualityDelta}) and shows a ${drivingMetric === "cost" ? "lower median cost" : "lower median elapsed time"}. ${gateNote}${elapsedOnlyLabel}`
    };
  }

  return {
    episodeId,
    status: "inconclusive",
    qualityVerdict,
    efficiencyVerdict,
    drivingMetric,
    qualityDelta,
    costSavingPercent,
    comparisonGatesPassed,
    controlGatesPassed,
    message: `Episode "${episodeId}": quality is ${qualityVerdict} (delta ${qualityDelta}), but "${claimRule.comparisonLane}" did not show better efficiency than "${claimRule.controlLane}" (efficiency verdict: ${efficiencyVerdict}, driving metric: ${drivingMetric}), so the overall claim for this episode is inconclusive. ${gateNote}${elapsedOnlyLabel}`
  };
}

const STATUS_STRENGTH = {
  supported: 3,
  inconclusive: 2,
  "not-evaluated": 1,
  "not-supported": 0
};

/**
 * Combine a set of per-episode claim statuses into a single overall status
 * per correction item 4: the overall status is always the *weakest*
 * episode status, never an average. "not-supported" is weakest,
 * "supported" is strongest.
 */
export function weakestStatus(statuses) {
  return statuses.reduce((weakest, status) =>
    STATUS_STRENGTH[status] < STATUS_STRENGTH[weakest] ? status : weakest
  );
}

/**
 * Evaluate a pre-registered secondary (exploratory) within-model claim rule
 * -- e.g. "does the spec improve the efficient model's own output versus
 * its raw baseline?" per correction item 9. These are informational only:
 * they never gate or average into the primary claim's status.
 */
function evaluateSecondaryRule(rule, runsByEpisodeAndLane) {
  const results = [];
  for (const [episodeId, byLane] of runsByEpisodeAndLane.entries()) {
    const comparisonRuns = byLane.get(rule.comparisonLane) ?? [];
    const controlRuns = byLane.get(rule.controlLane) ?? [];
    if (comparisonRuns.length === 0 || controlRuns.length === 0) continue;
    const comparison = aggregateLane(comparisonRuns);
    const control = aggregateLane(controlRuns);
    const qualityDelta = Math.round((comparison.qualityMedian - control.qualityMedian) * 100) / 100;
    results.push({ episodeId, qualityDelta });
  }
  return {
    id: rule.id,
    description: rule.description,
    comparisonLane: rule.comparisonLane,
    controlLane: rule.controlLane,
    results
  };
}

/**
 * Determine the benchmark's pre-registered claim, per episode, and combine
 * them into a single overall claim object matching the shape
 * `contracts/report.schema.json` requires for the top-level `claim` field
 * (`{status, qualityDelta, costSavingPercent, message}`).
 *
 * Per correction item 4, a claim is generated *per episode* and the
 * overall status is the weaker of the two -- never an average. Because the
 * committed report schema only allows one flat claim object at the top
 * level, the richer per-episode detail (quality vs. efficiency verdicts,
 * driving metric, gate visibility, spread-based inconclusiveness) is
 * encoded in `message` and returned in full via `episodeClaims` /
 * `secondaryClaims` for callers that want structured access (see
 * `report.js`, which writes `episodeClaims`/`secondaryClaims` to a
 * supplementary non-contract `claim-detail.json` artifact alongside
 * `report.json`).
 *
 * Illustrative data can exercise this function and the dashboard, but per
 * the committed decision record it can never produce anything other than
 * "not-evaluated" — it must never be reported as if it were measured
 * support for or against the claim.
 */
export function determineClaim(allRuns, { claimRule, secondaryClaimRules = [], dataKind }) {
  if (dataKind === "illustrative") {
    return {
      status: "not-evaluated",
      qualityDelta: null,
      costSavingPercent: null,
      message:
        "This report contains illustrative data only, generated to exercise the dashboard. No real benchmark runs have been evaluated, so the pre-registered claim cannot be assessed. This data must not be interpreted as evidence for or against the benchmark claim.",
      episodeClaims: [],
      secondaryClaims: []
    };
  }

  const runsByEpisodeAndLane = new Map();
  for (const run of allRuns) {
    if (!runsByEpisodeAndLane.has(run.episodeId)) runsByEpisodeAndLane.set(run.episodeId, new Map());
    const byLane = runsByEpisodeAndLane.get(run.episodeId);
    if (!byLane.has(run.laneId)) byLane.set(run.laneId, []);
    byLane.get(run.laneId).push(run);
  }

  const episodeClaims = [];
  for (const [episodeId, byLane] of runsByEpisodeAndLane.entries()) {
    const comparisonRuns = byLane.get(claimRule.comparisonLane) ?? [];
    const controlRuns = byLane.get(claimRule.controlLane) ?? [];
    episodeClaims.push(computeEpisodeClaim(episodeId, comparisonRuns, controlRuns, { claimRule }));
  }

  if (episodeClaims.length === 0) {
    return {
      status: "not-evaluated",
      qualityDelta: null,
      costSavingPercent: null,
      message: "No episodes present in the provided runs; the claim cannot be evaluated.",
      episodeClaims: [],
      secondaryClaims: []
    };
  }

  const overallStatus = weakestStatus(episodeClaims.map((c) => c.status));
  // Surface the numeric fields from the episode that determined the overall
  // (weakest) status, so the top-level qualityDelta/costSavingPercent are
  // always traceable to a specific, named episode rather than an average.
  const drivingEpisodeClaim = episodeClaims.find((c) => c.status === overallStatus) ?? episodeClaims[0];

  const secondaryClaims = secondaryClaimRules.map((rule) => evaluateSecondaryRule(rule, runsByEpisodeAndLane));

  const pricingAsOf = currentPricingAsOf();
  const pricingNote = pricingAsOf
    ? ` Pricing as of ${pricingAsOf}.`
    : " Costs remain null (no dated pricing configured), so efficiency comparisons above are elapsed-time-only where noted.";

  const perEpisodeSummary = episodeClaims
    .map((c) => `[${c.episodeId}: ${c.status}, quality=${c.qualityVerdict}, efficiency=${c.efficiencyVerdict}]`)
    .join(" ");

  const message =
    `Overall claim status is "${overallStatus}", the weaker of ${episodeClaims.length} per-episode claims (never an average). ` +
    `${perEpisodeSummary} Driving episode for the headline numbers below: "${drivingEpisodeClaim.episodeId}" (${drivingEpisodeClaim.message})${pricingNote}`;

  return {
    status: overallStatus,
    qualityDelta: drivingEpisodeClaim.qualityDelta,
    costSavingPercent: drivingEpisodeClaim.costSavingPercent,
    message,
    episodeClaims,
    secondaryClaims
  };
}
