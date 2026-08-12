import React, { useState } from 'react';
import type { Report, Run, ClaimDetail, HardGate } from './types';
import fixtureData from './fixture.json';
import { AlertCircle, CheckCircle, HelpCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';

const formatCost = (cost: number | null | undefined) => {
  if (cost === null || cost === undefined) return 'Unavailable';
  return `$${cost.toFixed(4)}`;
};

const formatTime = (secs: number | undefined | null) => secs !== undefined && secs !== null ? `${secs.toFixed(1)}s` : 'N/A';
const formatScore = (score: number) => `${score.toFixed(1)}%`;

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'supported': return <CheckCircle className="status-supported" size={20} />;
    case 'not-supported': return <AlertCircle className="status-not-supported" size={20} />;
    case 'inconclusive': return <HelpCircle className="status-inconclusive" size={20} />;
    default: return <Info className="status-not-evaluated" size={20} />;
  }
};

const ClaimCard = ({ claim, title, isOverall }: { claim: ClaimDetail; title: string, isOverall?: boolean }) => {
  return (
    <section className="claim-card" style={isOverall ? { borderLeftWidth: '10px' } : {}}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <StatusIcon status={claim.status} />
        <h2>{title}: {claim.status.toUpperCase()}</h2>
      </div>
      <p style={{ fontSize: '16px', margin: '0 0 12px 0' }}>{claim.message}</p>
      
      <div className="claim-metrics" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '12px' }}>
        <div><strong>Quality Verdict:</strong> {claim.qualityVerdict}</div>
        <div><strong>Efficiency Verdict:</strong> {claim.efficiencyVerdict}</div>
        <div><strong>Driving Metric:</strong> {claim.drivingMetric}</div>
        
        {claim.qualityDelta !== undefined && claim.qualityDelta !== null && (
          <div>
            <strong>Quality Delta:</strong> {claim.qualityDelta > 0 ? '+' : ''}{claim.qualityDelta}%
          </div>
        )}
        
        {claim.costSavingPercent !== undefined && claim.costSavingPercent !== null && (
          <div>
            <strong>Cost Saving:</strong> {claim.costSavingPercent}%
          </div>
        )}
      </div>
    </section>
  );
};

const HardGatesDisplay = ({ gates }: { gates: HardGate[] }) => {
  if (!gates || gates.length === 0) return <span>None</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {gates.map((g, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className={g.status === 'passed' ? 'hard-gate-pass' : g.status === 'failed' ? 'hard-gate-fail' : ''}>
            {g.id}: {g.status}
          </span>
          {g.reason && <span style={{ fontSize: '12px', color: 'var(--muted-color)' }}>({g.reason})</span>}
        </div>
      ))}
    </div>
  );
};

const RunRow = ({ run }: { run: Run }) => {
  const [expanded, setExpanded] = useState(false);
  const isFailed = run.status !== 'completed';
  
  return (
    <React.Fragment>
      <tr onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer', opacity: isFailed ? 0.7 : 1 }}>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {run.repetition}
          </div>
        </td>
        <td>{run.laneId}</td>
        <td>{run.modelDisplayName}</td>
        <td>{formatScore(run.qualityScore)}</td>
        <td>{run.status}</td>
        <td>{formatTime(run.elapsedSeconds)}</td>
        <td>{formatCost(run.estimatedCostUsd)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <div className="run-details">
              <strong>Evidence Path:</strong> {run.evidencePath} <br />
              <strong>Run Data Kind:</strong> {run.dataKind} <br />
              <strong>Tool Calls:</strong> {run.toolCalls}
              
              <div style={{ marginTop: '12px' }}>
                <strong>Hard Gates:</strong>
                <HardGatesDisplay gates={run.hardGates} />
              </div>

              <div className="run-scores">
                <div>Functional Correctness: {formatScore(run.scores.functionalCorrectness)}</div>
                <div>Behavior Preservation: {formatScore(run.scores.behaviorPreservation)}</div>
                <div>Security Controls: {formatScore(run.scores.securityControls)}</div>
                <div>Maintainability: {formatScore(run.scores.maintainability)}</div>
                <div>Operability: {formatScore(run.scores.operability)}</div>
                <div>Scope Traceability: {formatScore(run.scores.scopeTraceability)}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

export default function App() {
  const [data] = useState<Report>(fixtureData as Report);
  const [viewMode, setViewMode] = useState<'executive' | 'engineering'>('executive');
  
  const [selectedEpisode, setSelectedEpisode] = useState<string>('all');
  const [selectedLane, setSelectedLane] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');

  const { metadata, overallClaim, episodes } = data;
  const isIllustrative = metadata.dataKind === 'illustrative';

  const filteredEpisodes = episodes.filter(e => selectedEpisode === 'all' || e.id === selectedEpisode);
  
  const allLanes = Array.from(new Set(episodes.flatMap(e => e.laneSummaries.map(l => l.laneId))));
  const allModels = Array.from(new Set(episodes.flatMap(e => e.laneSummaries.map(l => l.modelDisplayName))));

  return (
    <div>
      {isIllustrative && (
        <div className="illustrative-banner">
          ILLUSTRATIVE DATA ONLY - NOT FOR MEASUREMENT
        </div>
      )}
      <div className="dashboard-container">
        <header className="header">
          <div className="title-section">
            <h1>Benchmark Evidence Dashboard</h1>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={`badge ${isIllustrative ? 'illustrative' : 'measured'}`}>
                {metadata.dataKind.toUpperCase()}
              </span>
              <span className="badge measured">v{metadata.benchmarkVersion}</span>
              <span style={{ fontSize: '12px', color: 'var(--muted-color)' }}>
                Generated: {new Date(metadata.generatedAt).toLocaleString()}
              </span>
              {metadata.frozenInputs?.evaluatorSha256 && (
                <span style={{ fontSize: '12px', color: 'var(--muted-color)' }}>
                  Evaluator Hash: {metadata.frozenInputs.evaluatorSha256.substring(0,8)}...
                </span>
              )}
            </div>
          </div>
          
          <div className="view-toggle">
            <button 
              className={viewMode === 'executive' ? 'active' : ''} 
              onClick={() => setViewMode('executive')}
            >
              Executive View
            </button>
            <button 
              className={viewMode === 'engineering' ? 'active' : ''} 
              onClick={() => setViewMode('engineering')}
            >
              Engineering View
            </button>
          </div>
        </header>

        {selectedEpisode === 'all' && (
          <ClaimCard claim={overallClaim} title="Overall Roll-up" isOverall={true} />
        )}

        <div className="filters card">
          <div className="filter-group">
            <label htmlFor="episode-filter">Episode</label>
            <select id="episode-filter" value={selectedEpisode} onChange={e => setSelectedEpisode(e.target.value)}>
              <option value="all">All Episodes</option>
              {episodes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="lane-filter">Lane</label>
            <select id="lane-filter" value={selectedLane} onChange={e => setSelectedLane(e.target.value)}>
              <option value="all">All Lanes</option>
              {allLanes.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="model-filter">Model</label>
            <select id="model-filter" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
              <option value="all">All Models</option>
              {allModels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {filteredEpisodes.map(episode => {
          const epLanes = episode.laneSummaries.filter(l => 
            (selectedLane === 'all' || l.laneId === selectedLane) &&
            (selectedModel === 'all' || l.modelDisplayName === selectedModel)
          );

          const epRuns = episode.runs.filter(r => 
            (selectedLane === 'all' || r.laneId === selectedLane) &&
            (selectedModel === 'all' || r.modelDisplayName === selectedModel)
          );

          if (epLanes.length === 0) return null;

          return (
            <div key={episode.id} style={{ marginBottom: '40px' }}>
              <h2 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
                Episode: {episode.name}
              </h2>
              
              <ClaimCard claim={episode.claim} title={`${episode.name} Claim`} />
              
              <h3 style={{ marginTop: '24px' }}>Lane Scorecards</h3>
              <div className="lanes-grid">
                {epLanes.map(lane => (
                  <div key={`${lane.laneId}-${lane.modelDisplayName}`} className="lane-card">
                    <h3 data-testid="lane-header">{lane.laneId.toUpperCase()} <span style={{ fontWeight: 'normal', color: 'var(--muted-color)', fontSize: '14px' }}>({lane.modelDisplayName})</span></h3>
                    <div className="stat-row">
                      <span>Quality (Median)</span>
                      <span className="stat-value">{formatScore(lane.qualityMedian)}</span>
                    </div>
                    <div className="stat-row" style={{ color: 'var(--muted-color)', fontSize: '12px' }}>
                      <span>Range</span>
                      <span>{formatScore(lane.qualityMin)} - {formatScore(lane.qualityMax)}</span>
                    </div>
                    <div className="stat-row" style={{ marginTop: '12px' }}>
                      <span>Hard Gates (Pass/Fail)</span>
                      <span className="stat-value">{lane.hardGatePassCount} / {lane.hardGateFailCount}</span>
                    </div>
                    <div className="stat-row" style={{ marginTop: '12px' }}>
                      <span>Elapsed (Median)</span>
                      <span className="stat-value">{formatTime(lane.elapsedMedianSeconds)}</span>
                    </div>
                    <div className="stat-row" style={{ marginTop: '12px' }}>
                      <span>Cost (Median)</span>
                      <span className="stat-value">{formatCost(lane.costMedianUsd)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {viewMode === 'engineering' && (
                <div className="card">
                  <h3>Run Details</h3>
                  <table className="runs-table">
                    <thead>
                      <tr>
                        <th>Repetition</th>
                        <th>Lane</th>
                        <th>Model</th>
                        <th>Quality</th>
                        <th>Status</th>
                        <th>Elapsed</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {epRuns.map(run => <RunRow key={run.runId} run={run} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
