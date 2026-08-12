import { STAGES } from "./stages.js";

/**
 * Structural + cross-stage validation for a spec bundle.
 *
 * Returns { errors, criticalBlocks } where:
 *  - `errors` are structural problems (missing stage, missing field) that
 *    must be fixed before the bundle is even scorable.
 *  - `criticalBlocks` are content-level findings that must block approval
 *    per the spec factory contract: unresolved critical ambiguities and
 *    untestable requirements/acceptance criteria.
 */
export function validateBundle(bundle) {
  const errors = [];
  const criticalBlocks = [];

  for (const stage of STAGES) {
    const data = bundle[stage.id];
    if (!data) {
      errors.push(`Missing stage file: ${stage.file} (${stage.title})`);
      continue;
    }
    for (const key of stage.requiredKeys) {
      if (data[key] === undefined || data[key] === null) {
        errors.push(`Stage "${stage.id}" is missing required field "${key}"`);
      }
    }
  }

  if (errors.length > 0) {
    // Cross-stage checks assume required fields are present; bail early.
    return { errors, criticalBlocks };
  }

  // Critical ambiguity gate.
  const unresolvedCritical = (bundle.ambiguities.items ?? []).filter(
    (item) => item.severity === "critical" && item.status !== "resolved"
  );
  for (const item of unresolvedCritical) {
    criticalBlocks.push(
      `Unresolved critical ambiguity "${item.id}": ${item.description}`
    );
  }

  // Untestable requirement gate.
  const untestableRequirements = (bundle.requirements.items ?? []).filter(
    (req) => req.testable !== true
  );
  for (const req of untestableRequirements) {
    criticalBlocks.push(`Requirement "${req.id}" is marked untestable`);
  }

  // Untestable acceptance criteria gate.
  const untestableAcceptance = (bundle.acceptanceCriteria.items ?? []).filter(
    (ac) => ac.testable !== true
  );
  for (const ac of untestableAcceptance) {
    criticalBlocks.push(`Acceptance criterion "${ac.id}" is marked untestable`);
  }

  // Every requirement must trace to at least one acceptance criterion.
  const requirementIds = new Set((bundle.requirements.items ?? []).map((r) => r.id));
  const tracedRequirementIds = new Set(
    (bundle.traceability.links ?? []).map((link) => link.requirementId)
  );
  for (const id of requirementIds) {
    if (!tracedRequirementIds.has(id)) {
      errors.push(`Requirement "${id}" has no traceability link`);
    }
  }
  for (const link of bundle.traceability.links ?? []) {
    if (!requirementIds.has(link.requirementId)) {
      errors.push(`Traceability link references unknown requirement "${link.requirementId}"`);
    }
    if (!(link.acceptanceCriteriaIds ?? []).length) {
      errors.push(`Requirement "${link.requirementId}" has no linked acceptance criteria`);
    }
  }

  // Sign-off decision must be explicit.
  if (!["approved", "rejected"].includes(bundle.signoff.decision)) {
    errors.push('Sign-off "decision" must be "approved" or "rejected"');
  }

  return { errors, criticalBlocks };
}

export function isApprovable(bundle) {
  const { errors, criticalBlocks } = validateBundle(bundle);
  return (
    errors.length === 0 &&
    criticalBlocks.length === 0 &&
    bundle.signoff?.decision === "approved"
  );
}
