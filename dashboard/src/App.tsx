import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Gauge,
  Info,
  ShieldCheck,
} from 'lucide-react';
import measuredData from '../../evidence/measured/report.json';
import type { ClaimDetail, HardGate, LaneSummary, Report, Run } from './types';

const report = measuredData as Report;

const formatScore = (value: number) => `${value.toFixed(1)}%`;
const formatMinutes = (seconds: number | null | undefined) =>
  seconds == null ? 'N/A' : `${(seconds / 60).toFixed(1)} min`;
const formatTokens = (value: number | null | undefined) =>
  value == null ? 'Unavailable' : `${(value / 1_000_000).toFixed(2)}M`;

const runTokenCostProxy = (run: Run) => {
  if (typeof run.tokenCostProxyTotal === 'number') return run.tokenCostProxyTotal;
  const categories = [
    run.inputTokens,
    run.cachedInputTokens,
    run.outputTokens,
    run.reasoningTokens,
    run.specAuthoringAmortizedTokens,
  ];
  return categories.every((value) => typeof value === 'number')
    ? categories.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;
};

const formatTokenRange = (lane: LaneSummary, runs: Run[]) => {
  const observedTotals = runs
    .map(runTokenCostProxy)
    .filter((value): value is number => typeof value === 'number');
  const minimum = lane.tokenCostProxy?.min ?? (observedTotals.length > 0 ? Math.min(...observedTotals) : null);
  const maximum = lane.tokenCostProxy?.max ?? (observedTotals.length > 0 ? Math.max(...observedTotals) : null);
  return minimum == null || maximum == null
    ? 'Unavailable'
    : `${formatTokens(minimum)}–${formatTokens(maximum)}`;
};

function StatusIcon({ status }: { status: ClaimDetail['status'] }) {
  if (status === 'supported') return <CheckCircle2 className="status-supported" size={24} />;
  if (status === 'not-supported') return <AlertTriangle className="status-not-supported" size={24} />;
  return <Info className="status-inconclusive" size={24} />;
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-detail">{detail}</div>
      </div>
    </article>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="score-wrap" aria-label={`Quality score ${formatScore(score)}`}>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <strong>{formatScore(score)}</strong>
    </div>
  );
}

function GateSummary({ gates }: { gates: HardGate[] }) {
  return (
    <div className="gate-list">
      {gates.filter((gate) => gate.applicable).map((gate) => (
        <span key={gate.id} className={gate.status === 'passed' ? 'gate-pass' : 'gate-fail'}>
          {gate.id}: {gate.status}
        </span>
      ))}
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  const [expanded, setExpanded] = useState(false);
  const tokenCostProxy = runTokenCostProxy(run);
  return (
    <React.Fragment>
      <tr className={run.status === 'completed' ? '' : 'run-non-completed'}>
        <td>
          <button
            className="row-toggle"
            onClick={() => setExpanded((value) => !value)}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${run.runId}`}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            R{run.repetition}
          </button>
        </td>
        <td><code>{run.laneId}</code></td>
        <td>{run.modelDisplayName}</td>
        <td><ScoreBar score={run.qualityScore} /></td>
        <td><Badge tone={run.status === 'completed' ? 'neutral' : 'warning'}>{run.status}</Badge></td>
        <td>{formatMinutes(run.elapsedSeconds)}</td>
        <td>{formatTokens(tokenCostProxy)}</td>
        <td>{run.hardGatesPassed ? 'Passed' : 'Failed'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="expanded-cell">
            <div className="run-details">
              <div><strong>Run ID</strong><code>{run.runId}</code></div>
              <div><strong>Tool calls</strong><span>{run.toolCalls}</span></div>
              <div><strong>Cost proxy total</strong><span>{formatTokens(tokenCostProxy)}</span></div>
              <div><strong>Uncached input</strong><span>{formatTokens(run.inputTokens)}</span></div>
              <div><strong>Cached input</strong><span>{formatTokens(run.cachedInputTokens)}</span></div>
              <div><strong>Output</strong><span>{formatTokens(run.outputTokens)}</span></div>
              <div><strong>Reasoning</strong><span>{formatTokens(run.reasoningTokens)}</span></div>
              <div><strong>Amortized spec authoring</strong><span>{formatTokens(run.specAuthoringAmortizedTokens)}</span></div>
              <div><strong>Evidence</strong><code>{run.evidencePath}</code></div>
            </div>
            <GateSummary gates={run.hardGates} />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

function LaneCard({ lane, featured, runs }: { lane: LaneSummary; featured: boolean; runs: Run[] }) {
  return (
    <article className={`lane-card ${featured ? 'lane-featured' : ''}`}>
      <div className="lane-heading">
        <div>
          <code>{lane.laneId}</code>
          <h3>{lane.modelDisplayName}</h3>
        </div>
        {featured && <Badge tone="accent">Headline lane</Badge>}
      </div>
      <ScoreBar score={lane.qualityMedian} />
      <div className="lane-stats">
        <span>Range<strong>{formatScore(lane.qualityMin)}–{formatScore(lane.qualityMax)}</strong></span>
        <span>Gate passes<strong>{lane.hardGatePassCount}/{lane.runCount}</strong></span>
        <span>Median productive<strong>{formatMinutes(lane.productiveMedianSeconds)}</strong></span>
        <span>Median elapsed<strong>{formatMinutes(lane.elapsedMedianSeconds)}</strong></span>
        <span>Median cost proxy<strong>{formatTokens(lane.tokenCostProxy?.median ?? lane.tokenMedian)}</strong></span>
        <span>Cost proxy range<strong>{formatTokenRange(lane, runs)}</strong></span>
      </div>
    </article>
  );
}

export default function App() {
  const [view, setView] = useState<'executive' | 'engineering'>('executive');
  const [episodeFilter, setEpisodeFilter] = useState('all');
  const [laneFilter, setLaneFilter] = useState('all');

  const allRuns = report.episodes.flatMap((episode) => episode.runs);
  const completed = allRuns.filter((run) => run.status === 'completed').length;
  const timedOut = allRuns.filter((run) => run.status === 'timed-out').length;
  const failed = allRuns.filter((run) => run.status === 'failed').length;
  const sealedPasses = allRuns.filter((run) => run.hardGatesPassed).length;
  const tokenCostProxyValues = allRuns.map(runTokenCostProxy);
  const totalTokenCostProxy = tokenCostProxyValues.every((value) => typeof value === 'number')
    ? tokenCostProxyValues.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;

  const comparisons = report.episodes.map((episode) => {
    const comparison = episode.laneSummaries.find((lane) => lane.laneId === 'efficient-spec')!;
    const control = episode.laneSummaries.find((lane) => lane.laneId === 'frontier-raw')!;
    return { episode, comparison, control, delta: comparison.qualityMedian - control.qualityMedian };
  });

  const visibleEpisodes = useMemo(
    () => report.episodes.filter((episode) => episodeFilter === 'all' || episode.id === episodeFilter),
    [episodeFilter],
  );

  return (
    <div className="page-shell">
      <div className="evidence-banner">
        BOUNDED-MEASURED EVIDENCE · PROVIDER BUILD IDS NOT EXPOSED
      </div>
      <main className="dashboard-container">
        <header className="header">
          <div>
            <div className="eyebrow">SpecForge FSI · AI-enabled SDLC benchmark</div>
            <h1>Does a strong spec let an efficient model match frontier performance?</h1>
            <p className="subtitle">
              24 isolated modernization and audit-feature runs, independently scored by a sealed evaluator.
            </p>
          </div>
          <div className="view-toggle" aria-label="Dashboard view">
            <button className={view === 'executive' ? 'active' : ''} onClick={() => setView('executive')}>Executive</button>
            <button className={view === 'engineering' ? 'active' : ''} onClick={() => setView('engineering')}>Engineering</button>
          </div>
        </header>

        <section className="claim-hero">
          <div className="claim-status">
            <StatusIcon status={report.overallClaim.status} />
            <div>
              <div className="eyebrow">Pre-registered headline claim</div>
              <h2>{report.overallClaim.status.replace('-', ' ')}</h2>
            </div>
          </div>
          <p>{report.overallClaim.message}</p>
          <div className="claim-badges">
            <Badge tone="danger">Quality: {report.overallClaim.qualityVerdict}</Badge>
            <Badge>Cost proxy: {report.overallClaim.efficiencyVerdict}</Badge>
            <Badge>{report.metadata.evidenceQualification.level}</Badge>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Execution summary">
          <MetricCard label="Measured runs" value={String(allRuns.length)} detail={`${completed} completed within policy`} icon={<Gauge size={22} />} />
          <MetricCard label="Sealed passes" value={`${sealedPasses}/${allRuns.length}`} detail="All applicable hard gates passed" icon={<ShieldCheck size={22} />} />
          <MetricCard label="Policy outcomes" value={`${timedOut} timed out`} detail={`${failed} incomplete/failed run`} icon={<Clock3 size={22} />} />
          <MetricCard
            label="Observed cost proxy"
            value={formatTokens(totalTokenCostProxy)}
            detail={report.metadata.pricingAsOf ? `USD pricing dated ${report.metadata.pricingAsOf}` : 'Categorized tokens; USD pricing unavailable'}
            icon={<Info size={22} />}
          />
        </section>

        <section className="card cost-proxy-callout" aria-label="Cost and efficiency interpretation">
          <div>
            <div className="eyebrow">How to read cost and efficiency</div>
            <h2>Tokens measure consumption cost, not all efficiency</h2>
          </div>
          <p>
            Token consumption is the non-monetary cost proxy. Uncached input, cached input,
            output, reasoning, and amortized spec-authoring tokens remain visible separately;
            the total does not imply that every token category has the same monetary price.
            Productive execution time, elapsed time, quality, and hard-gate completion remain
            separate delivery-efficiency evidence.
          </p>
        </section>

        <section className="card comparison-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Headline comparison</div>
              <h2>Efficient + spec versus frontier + raw prompt</h2>
            </div>
            <Badge tone="accent">Marginal medians</Badge>
          </div>
          <div className="comparison-grid">
            {comparisons.map(({ episode, comparison, control, delta }) => (
              <article key={episode.id} className="comparison-row">
                <div>
                  <h3>{episode.name}</h3>
                  <p>{episode.claim.message}</p>
                </div>
                <div className="comparison-scores">
                  <div><span>Efficient + spec</span><strong>{formatScore(comparison.qualityMedian)}</strong><small>{comparison.hardGatePassCount}/{comparison.runCount} gate-complete · {formatTokens(comparison.tokenMedian)} cost proxy · {formatMinutes(comparison.productiveMedianSeconds)} productive</small></div>
                  <div><span>Frontier + raw</span><strong>{formatScore(control.qualityMedian)}</strong><small>{control.hardGatePassCount}/{control.runCount} gate-complete · {formatTokens(control.tokenMedian)} cost proxy · {formatMinutes(control.productiveMedianSeconds)} productive</small></div>
                  <div className={delta >= 0 ? 'delta-positive' : 'delta-negative'}><span>Delta</span><strong>{delta > 0 ? '+' : ''}{delta.toFixed(1)} pts</strong><small>efficient-spec minus frontier-raw</small></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="section-heading episode-heading">
          <div>
            <div className="eyebrow">Measured detail</div>
            <h2>Lane performance by episode</h2>
          </div>
          <div className="filters">
            <label>Episode
              <select value={episodeFilter} onChange={(event) => setEpisodeFilter(event.target.value)}>
                <option value="all">All episodes</option>
                {report.episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.name}</option>)}
              </select>
            </label>
            <label>Lane
              <select value={laneFilter} onChange={(event) => setLaneFilter(event.target.value)}>
                <option value="all">All lanes</option>
                {['efficient-raw', 'efficient-spec', 'frontier-raw', 'frontier-spec'].map((lane) => <option key={lane}>{lane}</option>)}
              </select>
            </label>
          </div>
        </div>

        {visibleEpisodes.map((episode) => {
          const lanes = episode.laneSummaries.filter((lane) => laneFilter === 'all' || lane.laneId === laneFilter);
          const runs = episode.runs.filter((run) => laneFilter === 'all' || run.laneId === laneFilter);
          return (
            <section key={episode.id} className="episode-section">
              <div className="episode-title">
                <div>
                  <h2>{episode.name}</h2>
                  <p>{episode.claim.message}</p>
                </div>
                <Badge tone={episode.claim.status === 'not-supported' ? 'danger' : 'neutral'}>{episode.claim.status}</Badge>
              </div>
              <div className="lanes-grid">
                {lanes.map((lane) => (
                  <LaneCard
                    key={lane.laneId}
                    lane={lane}
                    featured={lane.laneId === 'efficient-spec' || lane.laneId === 'frontier-raw'}
                    runs={episode.runs.filter((run) => run.laneId === lane.laneId)}
                  />
                ))}
              </div>
              {view === 'engineering' && (
                <div className="card run-table-card">
                  <h3>Run-level evidence</h3>
                  <div className="table-scroll">
                    <table className="runs-table">
                      <thead><tr><th>Run</th><th>Lane</th><th>Model</th><th>Quality</th><th>Status</th><th>Elapsed</th><th>Cost proxy</th><th>Hard gates</th></tr></thead>
                      <tbody>{runs.map((run) => <RunRow key={run.runId} run={run} />)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          );
        })}

        <footer className="evidence-footer">
          <strong>Evidence boundary.</strong> {report.metadata.evidenceQualification.limitation}
          <span>Benchmark {report.metadata.benchmarkVersion} · Timeout {formatMinutes(report.metadata.executionPolicy.timeoutSeconds)} · Evaluator {report.metadata.frozenInputs.evaluatorSha256.slice(0, 12)} · Generated {new Date(report.metadata.generatedAt).toLocaleString()}</span>
        </footer>
      </main>
    </div>
  );
}
