import fs from 'node:fs/promises';
import path from 'node:path';
import { TIMEOUTS_MS } from './constants.js';
import { spawnCommand } from './commands.js';
import { tryParseJson } from './json.js';
import { toPosixRelative } from './paths.js';

const TEXT_EXTENSIONS = new Set([
  '.cs',
  '.csproj',
  '.props',
  '.targets',
  '.json',
  '.js',
  '.ts',
  '.mjs',
  '.cjs',
  '.ps1',
  '.cmd',
  '.sh',
  '.yml',
  '.yaml',
  '.config',
  '.xml',
  '.md',
  '.txt'
]);

const SECRET_PATTERNS = [
  { id: 'private-key', severity: 'critical', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i },
  { id: 'github-token', severity: 'critical', regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { id: 'azure-storage-key', severity: 'critical', regex: /AccountKey=[A-Za-z0-9+/=]{40,}/i },
  { id: 'connection-string-password', severity: 'high', regex: /(Password|Pwd)\s*=\s*[^;\s]{8,}/i }
];

const UNSAFE_PATTERNS = [
  { id: 'binaryformatter', severity: 'critical', regex: /\bBinaryFormatter\b/ },
  { id: 'typenamehandling', severity: 'high', regex: /\bTypeNameHandling\s*\.\s*(All|Auto|Objects)\b/ },
  { id: 'process-start-shell', severity: 'high', regex: /\bProcess\.Start\s*\(|UseShellExecute\s*=\s*true/i },
  { id: 'command-shell-execution', severity: 'high', regex: /\b(cmd\.exe|powershell(?:\.exe)?|\/bin\/sh)\b/i },
  { id: 'node-eval-exec', severity: 'high', regex: /\b(eval|execSync|exec)\s*\(/ }
];

export async function runStaticChecks(candidateRoot, dotnetPath) {
  const findings = [];
  const files = await listTextFiles(candidateRoot);

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const relativePath = toPosixRelative(candidateRoot, file);
    for (const rule of [...SECRET_PATTERNS, ...UNSAFE_PATTERNS]) {
      if (rule.regex.test(content)) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          path: relativePath
        });
      }
    }
  }

  const dependencyAuditCommands = await runDependencyAuditCommands(candidateRoot, dotnetPath);
  const dependencyFindings = dependencyAuditCommands.flatMap((command) => parseDependencyFindings(command));
  findings.push(...dependencyFindings);
  const criticalFindings = findings.filter((finding) => finding.severity === 'critical').length;
  const blockingFindings = findings.filter((finding) => finding.severity === 'critical' || (finding.source === 'dependency-audit' && finding.severity === 'high')).length;
  return {
    blockingFindings,
    criticalFindings,
    findings: findings.sort((a, b) => `${a.severity}:${a.ruleId}:${a.path}`.localeCompare(`${b.severity}:${b.ruleId}:${b.path}`)),
    dependencyAuditCommands
  };
}

async function listTextFiles(root) {
  const result = [];
  await walk(root, result);
  return result;
}

async function walk(directory, result) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'bin' || entry.name === 'obj' || entry.name === 'node_modules') {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, result);
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      result.push(fullPath);
    }
  }
}

async function runDependencyAuditCommands(candidateRoot, dotnetPath) {
  const commands = [];
  const solutionOrProject = await findFirst(candidateRoot, (name) => name.endsWith('.sln') || name.endsWith('.csproj'));
  if (solutionOrProject) {
    const executable = dotnetPath || 'dotnet';
    const result = await spawnCommand(executable, ['list', solutionOrProject, 'package', '--vulnerable', '--include-transitive'], {
      cwd: candidateRoot,
      timeoutMs: TIMEOUTS_MS.scanner,
      scrubbers: [candidateRoot]
    });
    commands.push({
      id: 'dotnet-list-package-vulnerable',
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      kind: 'dotnet',
      stdout: result.stdout,
      stderr: result.stderr
    });
  }

  const packageLock = await findFirst(candidateRoot, (name) => name === 'package-lock.json');
  if (packageLock) {
    const result = await spawnCommand('npm', ['audit', '--json'], {
      cwd: path.dirname(packageLock),
      timeoutMs: TIMEOUTS_MS.scanner,
      scrubbers: [candidateRoot]
    });
    commands.push({
      id: 'npm-audit-json',
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      kind: 'npm',
      stdout: result.stdout,
      stderr: result.stderr
    });
  }

  return commands;
}

export function parseDependencyFindings(command) {
  if (!command || command.timedOut) {
    return [];
  }
  if (command.kind === 'npm' || command.id === 'npm-audit-json') {
    return parseNpmAuditFindings(command.stdout);
  }
  if (command.kind === 'dotnet' || command.id === 'dotnet-list-package-vulnerable') {
    return parseDotnetVulnerabilityFindings(command.stdout);
  }
  return [];
}

export function parseNpmAuditFindings(stdout) {
  const parsed = tryParseJson(stdout);
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const findings = [];
  if (parsed.vulnerabilities && typeof parsed.vulnerabilities === 'object') {
    for (const [packageName, vulnerability] of Object.entries(parsed.vulnerabilities)) {
      const severity = normalizeSeverity(vulnerability?.severity);
      if (isBlockingDependencySeverity(severity)) {
        findings.push({
          ruleId: 'npm-audit-vulnerability',
          severity,
          source: 'dependency-audit',
          package: packageName,
          path: 'package-lock.json',
          via: Array.isArray(vulnerability?.via) ? vulnerability.via.map((item) => typeof item === 'string' ? item : item?.title).filter(Boolean).sort() : []
        });
      }
    }
  }

  if (parsed.advisories && typeof parsed.advisories === 'object') {
    for (const advisory of Object.values(parsed.advisories)) {
      const severity = normalizeSeverity(advisory?.severity);
      if (isBlockingDependencySeverity(severity)) {
        findings.push({
          ruleId: 'npm-audit-advisory',
          severity,
          source: 'dependency-audit',
          package: advisory?.module_name ?? advisory?.name ?? 'unknown',
          path: 'package-lock.json',
          via: [advisory?.title].filter(Boolean)
        });
      }
    }
  }

  return dedupeFindings(findings);
}

export function parseDotnetVulnerabilityFindings(stdout) {
  const findings = [];
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const severityMatch = line.match(/\b(Critical|High|Moderate|Low)\b/i);
    if (!severityMatch) {
      continue;
    }
    const severity = normalizeSeverity(severityMatch[1]);
    if (!isBlockingDependencySeverity(severity)) {
      continue;
    }
    const packageMatch = line.match(/^\s*[>\s]*(?:Top-level|Transitive)?\s*([A-Za-z0-9_.-]+)\s+/i);
    findings.push({
      ruleId: 'dotnet-vulnerable-package',
      severity,
      source: 'dependency-audit',
      package: packageMatch?.[1] ?? 'unknown',
      path: 'dotnet-package-reference'
    });
  }
  return dedupeFindings(findings);
}

function normalizeSeverity(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isBlockingDependencySeverity(severity) {
  return severity === 'critical' || severity === 'high';
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = JSON.stringify(finding);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function findFirst(directory, predicate) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'bin' || entry.name === 'obj' || entry.name === 'node_modules') {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && predicate(entry.name)) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const nested = await findFirst(fullPath, predicate);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}
