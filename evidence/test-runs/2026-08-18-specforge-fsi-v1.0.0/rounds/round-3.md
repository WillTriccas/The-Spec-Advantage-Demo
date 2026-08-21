# Round 3

Round 3 contains repetition 3 from each of the eight episode/lane
combinations. It is a comparison grouping, not the chronological run order.

## Plain-English result

Both MAI modernization runs timed out, including the specification-guided run.
Both Opus modernization runs again scored 100 and passed all gates. All four
audit runs completed but scored 0 and failed critical gates. This round
therefore reinforced the modernization gap and the absence of an acceptable
audit implementation.

- Execution: 6 completed, 2 timed out.
- Full hard-gate passes: 2 of 8.
- Reported token usage: 77,256,470.

| Task | Lane | Outcome | Score | Gates | Time | Tokens | Evidence |
| --- | --- | --- | ---: | --- | ---: | ---: | --- |
| Modernization | MAI raw | Timed out | 0 | Failed | 90.0 min | 9.75M | [run](../../../measured/runs/modernization-efficient-raw-r3/run.json) |
| Modernization | MAI + spec | Timed out | 0 | Failed | 90.0 min | 12.68M | [run](../../../measured/runs/modernization-efficient-spec-r3/run.json) |
| Modernization | Opus raw | Completed | 100 | Passed | 89.2 min | 9.15M | [run](../../../measured/runs/modernization-frontier-raw-r3/run.json) |
| Modernization | Opus + spec | Completed | 100 | Passed | 75.2 min | 7.66M | [run](../../../measured/runs/modernization-frontier-spec-r3/run.json) |
| Audit feature | MAI raw | Completed | 0 | Failed | 88.6 min | 8.63M | [run](../../../measured/runs/audit-feature-efficient-raw-r3/run.json) |
| Audit feature | MAI + spec | Completed | 0 | Failed | 80.8 min | 7.70M | [run](../../../measured/runs/audit-feature-efficient-spec-r3/run.json) |
| Audit feature | Opus raw | Completed | 0 | Failed | 82.8 min | 11.89M | [run](../../../measured/runs/audit-feature-frontier-raw-r3/run.json) |
| Audit feature | Opus + spec | Completed | 0 | Failed | 80.8 min | 9.80M | [run](../../../measured/runs/audit-feature-frontier-spec-r3/run.json) |

