# Evaluator compatibility view

The frozen sealed evaluator and frozen report scorer used different field
shapes:

- the evaluator emitted `dimensions` and `gates`;
- the scorer consumed `scores` and `hardGates`.

The original output for every run is preserved unchanged as
`evidence/sealed-evaluator.json`. The adjacent `evidence/evaluator.json` is a
deterministic compatibility view used by report generation:

- a passed dimension maps to `100`;
- a failed dimension maps to `0`;
- `gates.<id>.passed` maps directly to `hardGates.<id>`;
- the sealed evaluator's blindness attestation supplies the scorer's
  independence attestation.

The compatibility view embeds the complete sealed output and records the
mapping rule and source path. It does not reinterpret findings, rerun a
candidate, or alter a gate result.
