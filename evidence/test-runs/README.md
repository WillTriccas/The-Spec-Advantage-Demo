# Test-run catalog

Each independent execution of the demo receives one folder named:

```text
YYYY-MM-DD-<benchmark-version-or-experiment-name>
```

Every folder should contain:

- `README.md`: plain-English entry point and headline outcome.
- `manifest.json`: dates, policy, status counts, and canonical artifact paths.
- `episodes/`: business-task explanations.
- `rounds/`: one explanation for each repetition across all lanes.
- `results/`: links to reports, dashboards, and immutable evidence.

Do not overwrite an earlier folder when the demo is run again. Create a new
dated folder, even when the benchmark version is unchanged. This keeps separate
executions distinguishable and prevents favorable or unfavorable reruns from
silently replacing previous evidence.

## Available runs

| Test run | What it tested | Result |
| --- | --- | --- |
| [2026-08-18 SpecForge FSI v1.0.0](2026-08-18-specforge-fsi-v1.0.0/README.md) | Efficient/raw, efficient/spec, frontier/raw, and frontier/spec across modernization and audit-feature tasks | Claim not supported |

