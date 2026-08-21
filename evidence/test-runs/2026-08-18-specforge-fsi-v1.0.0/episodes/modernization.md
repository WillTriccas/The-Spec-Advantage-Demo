# Episode: platform modernization

## Plain-English result

The frontier model clearly outperformed the efficient model on this legacy
modernization task.

| Lane | Repetition scores | Median | Hard-gate passes | Execution outcome |
| --- | --- | ---: | ---: | --- |
| MAI raw | 0, 0, 0 | 0 | 0/3 | All three timed out |
| MAI + spec | 15, 15, 0 | 15 | 0/3 | Two completed; one timed out |
| Opus raw | 100, 100, 100 | 100 | 3/3 | All completed |
| Opus + spec | 100, 100, 100 | 100 | 3/3 | All completed |

The specification helped MAI produce some accepted behavior in two
repetitions, but it did not close the quality gap or satisfy every critical
gate. Opus achieved full evaluator scores with and without the specification.

The original 90-minute limit matters when interpreting this episode: four MAI
runs were truncated, while no Opus run timed out. The published v1.0.0 scores
must remain unchanged, but a separately versioned 120-minute experiment is
needed to test whether the result persists with more execution time.

## Detailed rounds

- [Round 1](../rounds/round-1.md)
- [Round 2](../rounds/round-2.md)
- [Round 3](../rounds/round-3.md)

