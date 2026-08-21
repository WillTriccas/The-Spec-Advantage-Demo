# Plain-English overview

## What was tested?

Two Financial Services software-engineering tasks were tested:

1. Modernize a legacy trade-reconciliation application.
2. Add an explainable maker-checker audit feature.

For each task, MAI Code 1.1 Flash and Claude Opus 5 were each tested with a raw
prompt and with an approved specification. Every combination ran three times,
giving 24 runs in total.

## What happened?

| Task and lane | Median quality | Hard-gate passes | Plain-English meaning |
| --- | ---: | ---: | --- |
| Modernization, MAI raw | 0 | 0/3 | Every run reached the 90-minute limit before producing an accepted result |
| Modernization, MAI + spec | 15 | 0/3 | Two runs completed with limited accepted behavior; one timed out; none met all critical requirements |
| Modernization, Opus raw | 100 | 3/3 | All three runs fully met the evaluator's requirements |
| Modernization, Opus + spec | 100 | 3/3 | All three runs fully met the evaluator's requirements |
| Audit feature, MAI raw | 0 | 0/3 | One run failed and two completed, but no result met all critical requirements |
| Audit feature, MAI + spec | 0 | 0/3 | All runs completed, but no result met all critical requirements |
| Audit feature, Opus raw | 0 | 0/3 | All runs completed, but no result met all critical requirements |
| Audit feature, Opus + spec | 0 | 0/3 | All runs completed, but no result met all critical requirements |

## What can we conclude?

The registered headline comparison was MAI with a specification versus Opus
with a raw prompt.

- On modernization, the comparison was 15 versus 100 at the median, with 0/3
  versus 3/3 hard-gate passes.
- On the audit feature, both medians were 0 and neither lane passed a hard gate.

Therefore, the claim that specification-guided MAI matched or beat raw-prompt
Opus was **not supported** by this experiment.

## What should we not conclude?

- This does not prove that specifications have no value. It tests two specific
  tasks, models, prompts, and an approved specification format.
- It does not prove that Opus can solve every audit task. Every audit lane failed
  this evaluator.
- It does not establish monetary savings because dated pricing was not frozen.
- The original 90-minute policy disproportionately truncated MAI modernization
  runs. A separate v1.1.0 experiment uses a symmetric 120-minute limit and must
  rerun the complete matrix rather than only the failed cells.
- Provider build IDs were not exposed, so the evidence is
  `bounded-measured`, not provider-build reproducible.

## Token usage

The 24 reported runs used 215,189,857 total tokens under the report's
consumption definition: uncached input, cached input, output, reasoning, and
amortized specification-authoring tokens where applicable. Cached-input tokens
make up much of this number, so it should be treated as a usage proxy rather
than a monetary cost.

