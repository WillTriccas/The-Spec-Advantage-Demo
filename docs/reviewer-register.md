# Reviewer independence register

Copy this template into the versioned freeze record and replace every placeholder before measured runs begin.

| Role | Named reviewer | Independence requirement | Attestation |
|---|---|---|---|
| Scenario maintainer | Unassigned | Did not score model outputs | Pending |
| Spec author | Unassigned | Could not access hidden evaluator source or expected results | Pending |
| Spec reviewer | Unassigned | Could not access hidden evaluator source or expected results | Pending |
| Evaluator author | Unassigned | Did not edit approved specs after seeing hidden checks | Pending |
| Security rules reviewer | Unassigned | Pins scanner, ruleset, and severity mapping before runs | Pending |
| Claim adjudicator | Unassigned | Did not author scored model output and cannot alter frozen weights | Pending |

## Required attestations

Each named person records:

- Corporate identity or stable reviewer identifier.
- Role.
- Review timestamp in UTC.
- Git commit reviewed.
- Exact artifact hashes reviewed.
- Conflicts of interest.
- A statement that excluded artifacts were not accessed.
- Approval, rejection, or conditional approval with reasons.

One person may hold more than one role only when the freeze record explains why and the spec-author/evaluator-author boundary remains intact.

## Change handling

Any change to a baseline, raw brief, approved spec, hidden evaluator, scoring configuration, claim rule, model build, agent build, or execution policy invalidates affected approvals. The new freeze version must identify the changed artifacts and obtain fresh approval before measured runs resume.

