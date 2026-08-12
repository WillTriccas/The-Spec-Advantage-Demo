export type Verdict = "better" | "equivalent" | "worse" | "indeterminate";
export type EfficiencyVerdict = "better" | "equivalent" | "worse" | "unavailable";
export type DrivingMetric = "cost" | "tokens" | "elapsed" | "unavailable";
export type HeadlineStatus = "supported" | "inconclusive" | "not-supported" | "not-evaluated";

export type ClaimDetail = {
  headline: HeadlineStatus;
  qualityVerdict: Verdict;
  efficiencyVerdict: EfficiencyVerdict;
  drivingMetric: DrivingMetric;
  qualityDeltaMin?: number | null;
  qualityDeltaMax?: number | null;
  qualityDeltaMedian?: number | null;
  costSavingPercentMin?: number | null;
  costSavingPercentMax?: number | null;
  costSavingPercentMedian?: number | null;
  message: string;
};

export type ScoreBreakdown = {
  functionalCorrectness: number;
  behaviorPreservation: number;
  securityControls: number;
  maintainability: number;
  operability: number;
  scopeTraceability: number;
};

export type HardGate = {
  id: string;
  applicable: boolean;
  status: "passed" | "failed" | "not-applicable";
  reason?: string;
};

export type Run = {
  runId: string;
  laneId: string;
  modelDisplayName: string;
  inputMode: "raw" | "spec";
  repetition: number;
  status: "completed" | "failed" | "timed-out" | "cancelled";
  qualityScore: number;
  dataKind: "illustrative" | "measured";
  hardGates: HardGate[];
  scores: ScoreBreakdown;
  elapsedSeconds: number;
  toolCalls: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  evidencePath: string;
};

export type LaneSummary = {
  laneId: string;
  modelDisplayName: string;
  inputMode: "raw" | "spec";
  qualityMedian: number;
  qualityMin: number;
  qualityMax: number;
  hardGatePassCount: number;
  hardGateFailCount: number;
  runCount: number;
  elapsedMinSeconds?: number;
  elapsedMedianSeconds: number;
  elapsedMaxSeconds?: number;
  costMinUsd?: number | null;
  costMedianUsd: number | null;
  costMaxUsd?: number | null;
  specAuthoringEffortHours?: number | null;
  amortizedSpecCostUsd?: number | null;
};

export type Episode = {
  id: string;
  name: string;
  claim: ClaimDetail;
  laneSummaries: LaneSummary[];
  runs: Run[];
};

export type Report = {
  schemaVersion: string;
  metadata: {
    benchmarkVersion: string;
    generatedAt: string;
    dataKind: "illustrative" | "measured";
    repetitionsPerLane: number;
    pricingAsOf?: string | null;
    frozenHash?: string;
  };
  overallClaim: ClaimDetail;
  episodes: Episode[];
};
