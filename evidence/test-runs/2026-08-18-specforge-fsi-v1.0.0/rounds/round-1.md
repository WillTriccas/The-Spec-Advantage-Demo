# Round 1

Round 1 contains repetition 1 from each of the eight episode/lane
combinations. It is a comparison grouping, not the chronological run order.

## Plain-English result

The two Opus modernization runs fully passed. MAI modernization with the
specification completed but scored only 15 and failed critical gates; MAI
without the specification timed out. No audit-feature run passed. The MAI raw
audit run failed early and produced no completed candidate.

- Execution: 6 completed, 1 timed out, 1 failed.
- Full hard-gate passes: 2 of 8.
- Reported token usage: 65,692,922.

| Task | Lane | Outcome | Score | Gates | Time | Tokens | Evidence |
| --- | --- | --- | ---: | --- | ---: | ---: | --- |
| Modernization | MAI raw | Timed out | 0 | Failed | 90.0 min | 7.84M | [run](../../../measured/runs/modernization-efficient-raw-r1/run.json) |
| Modernization | MAI + spec | Completed | 15 | Failed | 86.6 min | 10.59M | [run](../../../measured/runs/modernization-efficient-spec-r1/run.json) |
| Modernization | Opus raw | Completed | 100 | Passed | 89.7 min | 11.62M | [run](../../../measured/runs/modernization-frontier-raw-r1/run.json) |
| Modernization | Opus + spec | Completed | 100 | Passed | 75.6 min | 9.40M | [run](../../../measured/runs/modernization-frontier-spec-r1/run.json) |
| Audit feature | MAI raw | Failed | 0 | Failed | 55.3 min | 0.10M | [run](../../../measured/runs/audit-feature-efficient-raw-r1/run.json) |
| Audit feature | MAI + spec | Completed | 0 | Failed | 75.4 min | 7.75M | [run](../../../measured/runs/audit-feature-efficient-spec-r1/run.json) |
| Audit feature | Opus raw | Completed | 0 | Failed | 84.8 min | 8.79M | [run](../../../measured/runs/audit-feature-frontier-raw-r1/run.json) |
| Audit feature | Opus + spec | Completed | 0 | Failed | 87.7 min | 9.61M | [run](../../../measured/runs/audit-feature-frontier-spec-r1/run.json) |

