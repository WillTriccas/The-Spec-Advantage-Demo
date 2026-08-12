export type Report = {
  schemaVersion: "1.0.0";
  metadata: {
    benchmarkVersion: string;
    generatedAt: string;
    dataKind: "illustrative" | "measured";
    repetitionsPerLane: number;
    pricingAsOf?: string | null;
  };
  claim: {
    status: "supported" | "inconclusive" | "not-supported" | "not-evaluated";
    qualityDelta: number | null;
    costSavingPercent?: number | null;
    message: string;
  };
  episodes: Episode[];
};

export type ScoreBreakdown = {
  functionalCorrectness: number;
  behaviorPreservation: number;
  securityControls: number;
  maintainability: number;
  operability: number;
  scopeTraceability: number;
};

export type Run = {
  runId: string;
  laneId: string;
  modelDisplayName: string;
  inputMode: "raw" | "spec";
  repetition: number;
  status: "completed" | "failed" | "timed-out" | "cancelled";
  qualityScore: number;
  hardGatesPassed: boolean;
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
  runCount: number;
  elapsedMedianSeconds: number;
  costMedianUsd: number | null;
};

export type Episode = {
  id: "modernization" | "audit-feature";
  name: string;
  laneSummaries: LaneSummary[];
  runs: Run[];
};
