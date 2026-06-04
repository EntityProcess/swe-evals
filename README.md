# swe-evals Day.js Harness

This directory contains the frozen v1 Day.js task pack plus the AgentV harness
for the public `swe-evals` companion project.

## What Runs

`evals/dayjs-v1.eval.yaml` runs three Multi-SWE-bench Day.js tasks. For each
test case, the setup hook:

1. clones `https://github.com/iamkun/dayjs` into `repo/`
2. checks out the task `previous_commit`
3. applies the reviewed Multi-SWE-bench `test_patch` from `patches/`
4. runs `npm install --no-audit --no-fund`
5. commits the prepared benchmark state so AgentV captures only agent changes

The code grader runs the focused Jest command for the task after the agent
finishes. The v1 score is deterministic: focused command green is pass, non-zero
is fail.

## Runtime Variants

The eval defines three target aliases:

- `baseline`
- `compound-engineering`
- `superpowers`

All three use the same selected task commits and delegate to `AGENT_TARGET`,
so Codex/Pi switching does not require editing eval YAML. The variants are
defined in the eval file's `execution.targets`; run the eval normally and set
`AGENT_TARGET` to choose the underlying provider:

```bash
cd swe-evals
AGENT_TARGET=codex GRADER_TARGET=azure bun ../agentv/apps/cli/src/cli.ts eval evals/dayjs-v1.eval.yaml
AGENT_TARGET=pi GRADER_TARGET=azure bun ../agentv/apps/cli/src/cli.ts eval evals/dayjs-v1.eval.yaml
```

Run all variants:

```bash
cd swe-evals
AGENT_TARGET=codex GRADER_TARGET=azure bun ../agentv/apps/cli/src/cli.ts eval evals/dayjs-v1.eval.yaml
```

Validate harness wiring without a live provider:

```bash
cd swe-evals
AGENT_TARGET=codex GRADER_TARGET=azure \
  bun ../agentv/apps/cli/src/cli.ts eval evals/dayjs-v1.eval.yaml \
    --test-id dayjs-year-format-leading-zeroes \
    --dry-run \
    --threshold 0
```

`--threshold 0` is intentional for dry-run validation: the mocked provider does
not edit Day.js, while the deterministic code grader still runs the focused
Jest command against the prepared red state.

## Secrets Boundary

The repository does not contain provider secrets, result-sync credentials, or
Bitwarden output. The setup and grading scripts run external Day.js
install/test commands with a minimal child-process environment containing only
`CI`, `HOME`, `PATH`, and npm cache/audit/fund settings.

## Source Selection

The v1 pack uses Multi-SWE-bench Day.js tasks rather than ad hoc examples.
Day.js was selected because it is public, small enough for local demo checkouts,
JavaScript-based, and has multiple benchmark rows with clear previous commits,
public issue statements, test patches, and focused fail-to-pass test files.

The frozen task metadata is in `tasks/dayjs-v1.yaml`. Do not change selected
task metadata unless validation proves it wrong.
