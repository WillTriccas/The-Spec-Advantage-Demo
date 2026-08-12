import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TIMEOUTS_MS } from './constants.js';
import { runAdapterCommand } from './commands.js';
import { createBaseEvidence, failDimension, finalizeEvidence, passDimension, setGate } from './evidence.js';
import { AUDIT_SYNTHETIC_VALUES } from './fixtures.js';
import { tryParseJson } from './json.js';
import { resolveInside } from './paths.js';
import { validateAuditAdapter } from './schema.js';
import { runStaticChecks } from './static-checks.js';

export async function evaluateAuditFeature(candidateRoot, options) {
  const evidence = createBaseEvidence('audit-feature');
  const adapterPath = path.join(candidateRoot, 'audit-adapter.json');

  let adapter;
  try {
    adapter = JSON.parse(await fs.readFile(adapterPath, 'utf8'));
  } catch (error) {
    evidence.adapterValidation.errors.push(`Unable to read audit-adapter.json: ${error.message}`);
    return finalizeEvidence(evidence);
  }

  const validationErrors = validateAuditAdapter(adapter);
  evidence.adapterValidation = {
    passed: validationErrors.length === 0,
    errors: validationErrors
  };
  if (validationErrors.length > 0) {
    return finalizeEvidence(evidence);
  }

  let workingDirectory;
  try {
    workingDirectory = resolveInside(candidateRoot, adapter.workingDirectory, 'workingDirectory');
  } catch (error) {
    evidence.adapterValidation.passed = false;
    evidence.adapterValidation.errors.push(error.message);
    return finalizeEvidence(evidence);
  }

  evidence.staticChecks = await runStaticChecks(candidateRoot, options.dotnetPath);
  setGate(evidence, 'no-critical-security-findings', evidence.staticChecks.criticalFindings === 0, `${evidence.staticChecks.criticalFindings} critical static finding(s)`);
  setGate(evidence, 'build', true, 'audit adapter is command-based and schema-valid');

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sealed-audit-'));
  const stateDirectory = path.join(tempRoot, 'state');
  const exportPath = path.join(tempRoot, 'export.json');
  await fs.mkdir(stateDirectory, { recursive: true });

  const baseSubstitutions = {
    stateDirectory,
    exportPath,
    accountSentinel: AUDIT_SYNTHETIC_VALUES.accountSentinel,
    amountSentinel: AUDIT_SYNTHETIC_VALUES.amountSentinel,
    proposer: AUDIT_SYNTHETIC_VALUES.proposer,
    approver: AUDIT_SYNTHETIC_VALUES.approver,
    otherApprover: AUDIT_SYNTHETIC_VALUES.otherApprover,
    businessDate: AUDIT_SYNTHETIC_VALUES.date,
    fromDate: '2026-02-01',
    toDate: '2026-02-28',
    reason: AUDIT_SYNTHETIC_VALUES.reason,
    evidence: AUDIT_SYNTHETIC_VALUES.evidence,
    requestId: '',
    decision: ''
  };

  try {
    const commands = [
      ['initialize', adapter.initialize, {}],
      ['propose-main', adapter.propose, { requestId: 'REQ-A', reason: AUDIT_SYNTHETIC_VALUES.reason, evidence: AUDIT_SYNTHETIC_VALUES.evidence }],
      ['self-approve', adapter.decide, { requestId: 'REQ-A', decision: 'approve', approver: AUDIT_SYNTHETIC_VALUES.proposer }],
      ['checker-approve', adapter.decide, { requestId: 'REQ-A', decision: 'approve', approver: AUDIT_SYNTHETIC_VALUES.approver }],
      ['checker-approve-idempotent', adapter.decide, { requestId: 'REQ-A', decision: 'approve', approver: AUDIT_SYNTHETIC_VALUES.approver }],
      ['propose-reject', adapter.propose, { requestId: 'REQ-B', reason: AUDIT_SYNTHETIC_VALUES.reason, evidence: AUDIT_SYNTHETIC_VALUES.evidence }],
      ['checker-reject', adapter.decide, { requestId: 'REQ-B', decision: 'reject', approver: AUDIT_SYNTHETIC_VALUES.otherApprover }],
      ['propose-missing-reason', adapter.propose, { requestId: 'REQ-MISSING', reason: '', evidence: '' }],
      ['propose-conflict', adapter.propose, { requestId: 'REQ-C', reason: AUDIT_SYNTHETIC_VALUES.reason, evidence: AUDIT_SYNTHETIC_VALUES.evidence }]
    ];

    const results = [];
    for (const [id, command, overrides] of commands) {
      const result = await runAdapterCommand({
        id,
        command,
        cwd: workingDirectory,
        candidateRoot,
        substitutions: { ...baseSubstitutions, ...overrides },
        dotnetPath: options.dotnetPath,
        timeoutMs: TIMEOUTS_MS.auditCommand
      });
      evidence.commands.push(result);
      results.push(result);
    }

    const [approveConflict, rejectConflict] = await Promise.all([
      runAdapterCommand({
        id: 'conflict-approve',
        command: adapter.decide,
        cwd: workingDirectory,
        candidateRoot,
        substitutions: { ...baseSubstitutions, requestId: 'REQ-C', decision: 'approve', approver: AUDIT_SYNTHETIC_VALUES.approver },
        dotnetPath: options.dotnetPath,
        timeoutMs: TIMEOUTS_MS.auditCommand
      }),
      runAdapterCommand({
        id: 'conflict-reject',
        command: adapter.decide,
        cwd: workingDirectory,
        candidateRoot,
        substitutions: { ...baseSubstitutions, requestId: 'REQ-C', decision: 'reject', approver: AUDIT_SYNTHETIC_VALUES.otherApprover },
        dotnetPath: options.dotnetPath,
        timeoutMs: TIMEOUTS_MS.auditCommand
      })
    ]);
    evidence.commands.push(approveConflict, rejectConflict);

    const exportResult = await runAdapterCommand({
      id: 'export-date-range',
      command: adapter.export,
      cwd: workingDirectory,
      candidateRoot,
      substitutions: baseSubstitutions,
      dotnetPath: options.dotnetPath,
      timeoutMs: TIMEOUTS_MS.auditCommand
    });
    evidence.commands.push(exportResult);

    let exported = null;
    try {
      exported = tryParseJson(await fs.readFile(exportPath, 'utf8'));
    } catch {
      exported = tryParseJson(exportResult.stdout);
    }

    const checks = evaluateAuditResults(evidence.commands, exported);
    setGate(evidence, 'essential-business-invariants', checks.essential.length === 0, checks.essential.join('; ') || 'audit workflow command contract passed');
    setGate(evidence, 'maker-checker-separation', checks.makerChecker.length === 0, checks.makerChecker.join('; ') || 'self-approval was prevented and different checker decisions were accepted');
    setGate(evidence, 'audit-integrity', checks.integrity.length === 0, checks.integrity.join('; ') || 'history was append-only, exportable, and sentinel-safe');

    if (checks.all.length === 0 && evidence.staticChecks.criticalFindings === 0) {
      passDimension(evidence, 'functionalCorrectness', 'Synthetic audit workflow passed hidden command checks.');
      passDimension(evidence, 'behaviorPreservation', 'Audit feature preserved core reconciliation exception resolution invariants.');
      passDimension(evidence, 'securityControls', 'No critical pinned static findings and no sentinel values were exposed in command output.');
      passDimension(evidence, 'maintainability', 'Candidate exposed a schema-valid audit adapter with explicit lifecycle commands.');
      passDimension(evidence, 'operability', 'State-directory lifecycle initialized, proposed, decided, and exported deterministically.');
      passDimension(evidence, 'scopeTraceability', 'Maker-checker and audit-integrity gates map to the audit-feature prompt.');
    } else {
      failDimension(evidence, 'functionalCorrectness', checks.all.join('; ') || 'critical static findings detected');
      failDimension(evidence, 'behaviorPreservation', 'required audit behavior was not fully preserved');
      failDimension(evidence, 'securityControls', 'sentinel exposure or critical static findings were detected');
      failDimension(evidence, 'maintainability', 'audit adapter did not provide a complete lifecycle contract');
      failDimension(evidence, 'operability', 'audit commands did not complete deterministically');
      failDimension(evidence, 'scopeTraceability', 'audit prompt gates were not fully evidenced');
    }
  } catch (error) {
    evidence.dimensions.functionalCorrectness.findings.push(error.message);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  return finalizeEvidence(evidence);
}

function evaluateAuditResults(commands, exported) {
  const essential = [];
  const makerChecker = [];
  const integrity = [];
  const allOutput = commands.map((command) => `${command.stdout}\n${command.stderr}`).join('\n');

  require(essential, command(commands, 'initialize')?.passed, 'initialize failed');
  require(essential, command(commands, 'propose-main')?.passed, 'valid proposal failed');
  require(makerChecker, !isApproved(command(commands, 'self-approve')), 'proposer could approve their own request');
  require(makerChecker, command(commands, 'checker-approve')?.passed && isApproved(command(commands, 'checker-approve')), 'different approver could not approve');
  require(makerChecker, command(commands, 'checker-reject')?.passed && isRejected(command(commands, 'checker-reject')), 'different approver could not reject');
  require(essential, !command(commands, 'propose-missing-reason')?.passed || isRejected(command(commands, 'propose-missing-reason')), 'missing reason/evidence proposal was accepted');
  require(essential, command(commands, 'checker-approve-idempotent')?.passed, 'duplicate decision was not idempotently handled');
  require(integrity, conflictHandled(command(commands, 'conflict-approve'), command(commands, 'conflict-reject')), 'concurrent conflicting decisions were both accepted as final');
  require(integrity, Array.isArray(exported) || (exported && Array.isArray(exported.entries)), 'date-range export did not produce JSON history');
  require(integrity, exportHasHistory(exported, 'REQ-A') && exportHasHistory(exported, 'REQ-B'), 'export missing approved/rejected request history');
  require(integrity, !allOutput.includes(AUDIT_SYNTHETIC_VALUES.accountSentinel) && !allOutput.includes(AUDIT_SYNTHETIC_VALUES.amountSentinel), 'logs or command output exposed synthetic sentinel account/amount');
  require(integrity, exportLooksAppendOnly(exported), 'export lacks append-only or tamper-evident history metadata');

  return {
    essential,
    makerChecker,
    integrity,
    all: [...essential, ...makerChecker, ...integrity]
  };
}

function command(commands, id) {
  return commands.find((entry) => entry.id === id);
}

function commandJson(result) {
  return tryParseJson(result?.stdout) ?? {};
}

function isApproved(result) {
  const json = commandJson(result);
  return result?.passed && /approved/i.test(`${json.status ?? ''} ${json.decision ?? ''} ${result.stdout}`);
}

function isRejected(result) {
  const json = commandJson(result);
  return /rejected|forbidden|denied|invalid|conflict/i.test(`${json.status ?? ''} ${json.decision ?? ''} ${result?.stdout ?? ''} ${result?.stderr ?? ''}`) || result?.passed === false;
}

function conflictHandled(left, right) {
  const leftFinal = isApproved(left) || isRejected(left);
  const rightFinal = isApproved(right) || isRejected(right);
  return leftFinal && rightFinal && !(isApproved(left) && isApproved(right));
}

function exportEntries(exported) {
  if (Array.isArray(exported)) {
    return exported;
  }
  if (exported && Array.isArray(exported.entries)) {
    return exported.entries;
  }
  return [];
}

function exportHasHistory(exported, requestId) {
  return exportEntries(exported).some((entry) => JSON.stringify(entry).includes(requestId));
}

function exportLooksAppendOnly(exported) {
  const text = JSON.stringify(exported ?? {});
  return /hash|previous|append|sequence|version|timestamp|created/i.test(text);
}

function require(collection, condition, message) {
  if (!condition) {
    collection.push(message);
  }
}
