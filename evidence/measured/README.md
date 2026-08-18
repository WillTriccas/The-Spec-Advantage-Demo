# Measured evidence

This directory contains the 24 bounded-measured runs for
`specforge-fsi-v1.0.0`: imported run contracts, original transcripts,
canonical source patches and Git bundles, and independent sealed-evaluator
outputs.

The execution matrix contains 19 completed runs, four runs stopped at the
frozen 5,400-second boundary, and one incomplete run that produced no candidate
change. Non-completed runs retain their evidence and receive zero-score
treatment under the frozen policy.

Candidate repositories were originally created as history-isolated Git roots.
For publication, each exact binary baseline-to-candidate diff was applied to
the importer-prepared root so the frozen importer could generate a canonical
patch and bundle. `original-candidate.json` records the original measured
candidate and baseline commit IDs; `original-candidate.patch` preserves the
exact original tree delta.

The frozen evaluator and scorer exposed an integration mismatch in their JSON
field names. Original evaluator outputs are preserved unchanged, with a
deterministic scoring compatibility view documented in
`evaluator-compatibility.md`.

The evidence qualification is `bounded-measured`: GitHub Copilot exposed the
selected model IDs, agent version, and reasoning effort, but not immutable
provider model build IDs.
