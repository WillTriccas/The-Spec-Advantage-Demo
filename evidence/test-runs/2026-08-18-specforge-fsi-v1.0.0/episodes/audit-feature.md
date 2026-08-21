# Episode: explainable audit feature

## Plain-English result

This episode did not produce a winning lane. Eleven runs completed and one
failed, but every candidate scored 0 and failed at least one critical gate.

| Lane | Repetition scores | Median | Hard-gate passes | Execution outcome |
| --- | --- | ---: | ---: | --- |
| MAI raw | 0, 0, 0 | 0 | 0/3 | One failed; two completed |
| MAI + spec | 0, 0, 0 | 0 | 0/3 | All completed |
| Opus raw | 0, 0, 0 | 0 | 0/3 | All completed |
| Opus + spec | 0, 0, 0 | 0 | 0/3 | All completed |

The important message is not that the models were equal in general. It is that
the sealed evaluator did not accept any implementation as meeting the complete
maker-checker, audit-integrity, security, and business-invariant contract.
Because every lane failed, this episode cannot demonstrate that either model or
prompt treatment was superior.

## Detailed rounds

- [Round 1](../rounds/round-1.md)
- [Round 2](../rounds/round-2.md)
- [Round 3](../rounds/round-3.md)

