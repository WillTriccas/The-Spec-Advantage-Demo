import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BENCHMARK_ROOT = path.resolve(__dirname, "..");
export const REPO_ROOT = path.resolve(BENCHMARK_ROOT, "..");
export const CONFIG_DIR = path.join(BENCHMARK_ROOT, "config");
export const CONTRACTS_DIR = path.join(REPO_ROOT, "contracts");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function loadExperimentConfig() {
  return readJson(path.join(CONFIG_DIR, "experiment.json"));
}

export function loadScoringConfig() {
  return readJson(path.join(CONFIG_DIR, "scoring.json"));
}

export function loadCostsConfig() {
  return readJson(path.join(CONFIG_DIR, "costs.json"));
}

export function loadRunSchema() {
  return readJson(path.join(CONTRACTS_DIR, "run.schema.json"));
}

export function loadReportSchema() {
  return readJson(path.join(CONTRACTS_DIR, "report.schema.json"));
}
