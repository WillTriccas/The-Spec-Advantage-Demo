# Round 2

Round 2 contains repetition 2 from each of the eight episode/lane
combinations. It is a comparison grouping, not the chronological run order.

## Plain-English result

The modernization pattern repeated: both Opus runs scored 100 and passed,
while MAI raw timed out. MAI with the specification finished much faster in
this repetition, but still scored 15 and failed critical gates. All four audit
runs completed, yet none passed its evaluator gates.

- Execution: 7 completed, 1 timed out.
- Full hard-gate passes: 2 of 8.
- Reported token usage: 72,240,465.

| Task | Lane | Outcome | Score | Gates | Time | Tokens | Evidence |
| --- | --- | --- | ---: | --- | ---: | ---: | --- |
| Modernization | MAI raw | Timed out | 0 | Failed | 90.0 min | 10.20M | [run](../../../measured/runs/modernization-efficient-raw-r2/run.json) |
| Modernization | MAI + spec | Completed | 15 | Failed | 25.1 min | 6.23M | [run](../../../measured/runs/modernization-efficient-spec-r2/run.json) |
| Modernization | Opus raw | Completed | 100 | Passed | 84.1 min | 13.24M | [run](../../../measured/runs/modernization-frontier-raw-r2/run.json) |
| Modernization | Opus + spec | Completed | 100 | Passed | 70.4 min | 9.40M | [run](../../../measured/runs/modernization-frontier-spec-r2/run.json) |
| Audit feature | MAI raw | Completed | 0 | Failed | 87.7 min | 8.83M | [run](../../../measured/runs/audit-feature-efficient-raw-r2/run.json) |
| Audit feature | MAI + spec | Completed | 0 | Failed | 55.0 min | 6.51M | [run](../../../measured/runs/audit-feature-efficient-spec-r2/run.json) |
| Audit feature | Opus raw | Completed | 0 | Failed | 89.5 min | 9.06M | [run](../../../measured/runs/audit-feature-frontier-raw-r2/run.json) |
| Audit feature | Opus + spec | Completed | 0 | Failed | 81.6 min | 8.78M | [run](../../../measured/runs/audit-feature-frontier-spec-r2/run.json) |

