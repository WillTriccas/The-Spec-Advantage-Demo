function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Aggregate a list of scored runs (all sharing the same laneId) into the
 * `laneSummary` shape required by `contracts/report.schema.json`.
 *
 * `runs` items must have: qualityScore, hardGatesPassed, elapsedSeconds,
 * estimatedCostUsd (nullable), laneId, modelDisplayName, inputMode.
 *
 * `costMedianUsd` is null whenever any run in the lane has a null cost —
 * per the experiment contract, costs remain null until dated pricing is
 * configured, so this is expected to be null for the foreseeable future
 * rather than silently computed from a partial subset.
 */
export function aggregateLane(runs) {
  if (runs.length === 0) {
    throw new Error("Cannot aggregate an empty run list");
  }
  const [{ laneId, modelDisplayName, inputMode }] = runs;

  const qualityScores = runs.map((r) => r.qualityScore);
  const elapsedSeconds = runs.map((r) => r.elapsedSeconds);
  const productiveSeconds = runs.map((r) => r.productiveSeconds ?? r.productiveDurationSeconds ?? null);
  const tokenCategories = runs.map((run) => ({
    uncachedInput: run.inputTokens,
    cachedInput: run.cachedInputTokens,
    output: run.outputTokens,
    reasoning: run.reasoningTokens ?? run.reasoningOutputTokens,
    specAuthoringAmortized: run.specAuthoringAmortizedTokens ?? 0
  }));
  const tokenTotals = runs.map(totalTokenConsumption);
  const hardGatePassCount = runs.filter((r) => r.hardGatesPassed).length;

  const costs = runs.map((r) => r.estimatedCostUsd);
  const costMedianUsd = costs.some((c) => c === null || c === undefined) ? null : median(costs);

  return {
    laneId,
    modelDisplayName,
    inputMode,
    qualityMedian: median(qualityScores),
    qualityMin: Math.min(...qualityScores),
    qualityMax: Math.max(...qualityScores),
    hardGatePassCount,
    hardGateFailCount: runs.length - hardGatePassCount,
    runCount: runs.length,
    elapsedMedianSeconds: median(elapsedSeconds),
    productiveMedianSeconds: productiveSeconds.every((value) => typeof value === "number")
      ? median(productiveSeconds)
      : null,
    tokenMedian: completeMedian(tokenTotals),
    tokenCostProxy: {
      median: completeMedian(tokenTotals),
      min: completeRangeValue(tokenTotals, Math.min),
      max: completeRangeValue(tokenTotals, Math.max),
      categoryMedians: {
        uncachedInput: completeMedian(tokenCategories.map((tokens) => tokens.uncachedInput)),
        cachedInput: completeMedian(tokenCategories.map((tokens) => tokens.cachedInput)),
        output: completeMedian(tokenCategories.map((tokens) => tokens.output)),
        reasoning: completeMedian(tokenCategories.map((tokens) => tokens.reasoning)),
        specAuthoringAmortized: completeMedian(
          tokenCategories.map((tokens) => tokens.specAuthoringAmortized)
        )
      }
    },
    costMedianUsd
  };
}

function completeMedian(values) {
  return values.every((value) => typeof value === "number") ? median(values) : null;
}

function completeRangeValue(values, operation) {
  return values.every((value) => typeof value === "number") ? operation(...values) : null;
}

export function totalTokenConsumption(run) {
  const categories = [
    run.inputTokens,
    run.cachedInputTokens,
    run.outputTokens,
    run.reasoningTokens ?? run.reasoningOutputTokens,
    run.specAuthoringAmortizedTokens ?? 0
  ];
  return categories.every((value) => typeof value === "number")
    ? categories.reduce((sum, value) => sum + value, 0)
    : null;
}

export function groupByLane(runs) {
  const byLane = new Map();
  for (const run of runs) {
    if (!byLane.has(run.laneId)) byLane.set(run.laneId, []);
    byLane.get(run.laneId).push(run);
  }
  return byLane;
}

export function aggregateEpisode(runs) {
  const byLane = groupByLane(runs);
  return [...byLane.values()].map((laneRuns) => aggregateLane(laneRuns));
}

export { median };
