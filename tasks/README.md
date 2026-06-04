# SWE Task Pack: Day.js v1

The v1 task pack is frozen in `dayjs-v1.yaml`.

## Selected Shape

- Repository: `https://github.com/iamkun/dayjs`
- Dataset source: Multi-SWE-bench
- Pack size: 3 tasks
- Runtime posture: one public repo checkout and one npm dependency install can
  serve all selected tasks, but each task must run from its own disposable
  checkout at its own `previous_commit`.
- Verification posture: apply the benchmark test patch, run the focused test
  file, expect red on the previous commit, then expect green after a correct
  agent fix.

## Validated Command

Task `iamkun__dayjs-1470` was manually validated on 2026-06-04:

```bash
git clone --depth 1 https://github.com/iamkun/dayjs.git /tmp/agentv-swe-task-validation-dayjs-1470
cd /tmp/agentv-swe-task-validation-dayjs-1470
git fetch --depth 1 origin 0fdac93ff2531542301b76952be9b084b2e2dfa0
git checkout 0fdac93ff2531542301b76952be9b084b2e2dfa0
npm install --no-audit --no-fund
git apply /tmp/dayjs-1470-test.patch
npx jest test/plugin/updateLocale.test.js --runInBand --coverage=false
```

Observed red result:

- `test/plugin/updateLocale.test.js` ran.
- 1 benchmark-added test failed.
- Failure: expected `bad date`, received `Invalid Date`.

Observed green check after applying the Multi-SWE-bench fix patch:

- Same focused command passed.
- 5 tests passed in `test/plugin/updateLocale.test.js`.

`npm ci` was attempted first and rejected because this historical Day.js commit
does not contain a lockfile. The harness should use an isolated disposable
checkout with `npm install --no-audit --no-fund` unless a later task-specific
checkout proves a lockfile exists.

## Rejected Candidates

- SWE-bench Lite / SWE-bench Verified: canonical task format, but v1 public demo
  would inherit Python/Docker-heavy setup instead of a cheap source checkout.
- `expressjs/express`: recognizable, but the public Multi-SWE-bench file has
  only four JavaScript rows and needs separate validation for version-specific
  install/test behavior.
- `axios/axios`: recognizable, but selected rows need separate HTTP/client test
  setup review; not as cheap as Day.js for the first harness handoff.
- `darkreader/darkreader`: TypeScript candidate with a small dataset file, but
  fewer rows and likely browser/build tooling friction.
- Large repos such as `sveltejs/svelte`, `vuejs/core`, and `mui/material-ui`:
  rejected for v1 because install and test runtime would dominate the demo.

