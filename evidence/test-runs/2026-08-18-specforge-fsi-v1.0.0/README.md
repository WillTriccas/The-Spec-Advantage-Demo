# 2026-08-18 SpecForge FSI benchmark

## Plain-English result

This experiment asked whether giving a strong specification to the cheaper MAI
Code 1.1 Flash model could produce modernization and audit-feature work as good
as giving only the task prompt to Claude Opus 5.

**The experiment did not support that claim.**

- For platform modernization, Opus with the raw prompt scored 100 in all three
  repetitions and passed every hard gate. MAI with the specification scored 15,
  15, and 0; none of those runs passed every hard gate.
- For the audit feature, no lane passed the required hard gates. Every lane had
  a median score of 0, so this task did not establish a winner.
- Nineteen of 24 runs completed within the policy, four reached the original
  90-minute limit, and one failed without a completed candidate.
- Six of 24 runs passed every applicable hard gate. They were the six Opus
  modernization runs: three raw and three specification-guided.

This is still a useful result. It shows that a specification alone did not
compensate for model capability on these tasks, and that the audit evaluator was
strict enough that neither model produced an acceptable solution.

## How to read this test run

1. Read the [overall explanation](results/plain-english-overview.md).
2. Read the business-task explanations:
   [modernization](episodes/modernization.md) and
   [audit feature](episodes/audit-feature.md).
3. Compare individual repetitions:
   [round 1](rounds/round-1.md),
   [round 2](rounds/round-2.md), and
   [round 3](rounds/round-3.md).
4. Open the [results index](results/README.md) for the dashboard, measured
   report, and detailed evidence.

## Lane glossary

| Lane | Meaning |
| --- | --- |
| `efficient-raw` | MAI Code 1.1 Flash received only the task prompt |
| `efficient-spec` | MAI Code 1.1 Flash received the task prompt and approved specification |
| `frontier-raw` | Claude Opus 5 received only the task prompt |
| `frontier-spec` | Claude Opus 5 received the task prompt and approved specification |

Round means repetition number, not chronological execution order. The 24 runs
were actually executed in a randomized, interleaved order to reduce
time-of-day and infrastructure bias.

