import { loadExperimentConfig } from "./config.js";

/**
 * Build the full list of planned runs from the experiment config: every
 * combination of episode × lane × repetition. With 2 episodes, 4 lanes and
 * 3 repetitions per lane (per the committed experiment contract) this is
 * exactly 24 runs.
 */
export function buildPlannedRuns(experimentConfig = loadExperimentConfig()) {
  const runs = [];
  for (const episode of experimentConfig.episodes) {
    for (const lane of experimentConfig.lanes) {
      const model = experimentConfig.models[lane.modelTier];
      for (let repetition = 1; repetition <= experimentConfig.repetitionsPerLane; repetition += 1) {
        runs.push({
          runId: `${episode.id}-${lane.id}-r${repetition}`,
          episodeId: episode.id,
          episodeName: episode.name,
          laneId: lane.id,
          modelTier: lane.modelTier,
          modelId: model.id,
          modelDisplayName: model.displayName,
          inputMode: lane.inputMode,
          repetition,
          baselineRef: episode.baselineRef,
          taskBrief: episode.taskBrief,
          specBundle: episode.specBundle
        });
      }
    }
  }
  return runs;
}

export function plannedRunCount(experimentConfig = loadExperimentConfig()) {
  return (
    experimentConfig.episodes.length *
    experimentConfig.lanes.length *
    experimentConfig.repetitionsPerLane
  );
}
