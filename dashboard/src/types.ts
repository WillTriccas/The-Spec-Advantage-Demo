export type Verdict = "better" | "equivalent" | "worse" | "indeterminate";
export type EfficiencyVerdict = "better" | "equivalent" | "worse" | "unavailable";
export type DrivingMetric = "cost" | "tokens" | "elapsed" | "unavailable";
export type HeadlineStatus = "supported" | "inconclusive" | "not-supported" | "not-evaluated";

export type ClaimDetail = {
  status: HeadlineStatus;
  qualityVerdict: Verdict;
  efficiencyVerdict: EfficiencyVerdict;
  drivingMetric: DrivingMetric;
  qualityDelta?: number | null;
  costSavingPercent?: number | null;
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
  reason?: string | null;
};

export type Run = {
  runId: string;
  dataKind: "illustrative" | "measured";
  laneId: string;
  modelDisplayName: string;
  inputMode: "raw" | "spec";
  repetition: number;
  status: "completed" | "failed" | "timed-out" | "cancelled";
  qualityScore: number;
  hardGates: HardGate[];
  hardGatesPassed: boolean;
  scores: ScoreBreakdown;
  elapsedSeconds: number;
  productiveSeconds?: number | null;
  queueSeconds?: number | null;
  toolCalls: number;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  estimatedCostUsd?: number | null;
  specAuthoringAmortizedCostUsd?: number | null;
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
  elapsedMedianSeconds: number;
  productiveMedianSeconds?: number | null;
  tokenMedian?: number | null;
  costMedianUsd?: number | null;
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
    rateType: "list" | "negotiated" | "internal-chargeback" | "unavailable";
    frozenInputs: {
      freezeRecordSha256?: string | null;
      evaluatorSha256: string;
      scoringConfigSha256: string;
      claimRule: any;
    };
    frozenVersions: string[];
  };
  overallClaim: ClaimDetail;
  episodes: Episode[];
};
