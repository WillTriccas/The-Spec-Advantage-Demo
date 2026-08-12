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

  // Spec authors must be identified separately from the benchmark's hidden
  // evaluator authors, so an independent third party can confirm no single
  // person wrote both the spec and the rubric that later scores it.
  if (!(bundle.signoff.authors ?? []).length) {
    errors.push('Sign-off "authors" must list at least one spec author');
  }

  // Blindness attestation gate: approval must record that the spec authors
  // attested they had no access to the benchmark's hidden evaluator rubric,
  // evaluator JSON schema, or scoring weights while authoring the spec. An
  // unattested (or explicitly false) attestation blocks approval outright --
  // this is a critical block, not merely a missing-field structural error,
  // because a spec authored with sight of the rubric would invalidate the
  // benchmark's raw-vs-spec comparison.
  const attestation = bundle.signoff.blindnessAttestation;
  if (attestation?.attested !== true) {
    criticalBlocks.push(
      "Sign-off blindnessAttestation.attested must be true: spec authors must attest they had no access to the hidden evaluator rubric before approval"
    );
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
