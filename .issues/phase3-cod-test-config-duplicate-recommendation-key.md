# Phase3 cod-test config fails to parse (duplicated YAML key: `recommendation`)

## Repro
From repo root:

```bash
node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose
```

## Expected
Pipeline loads config and runs Phase 3 report scripts.

## Actual
Fails before running any scripts (config parse error):

```
❌ Pipeline failed: Failed to parse config file: duplicated mapping key (130:3)

 129 |   # Recommendation is Phase 3 onl ...
 130 |   recommendation:
---------^
```

Exit code: `1`

## Root cause
`configs/cod-test-phase3.yaml` contains *two* `recommendation:` keys under the same mapping (under `ai:`):

- first at ~line **108**
- second at ~line **130**

See:

```yaml
  recommendation:   # line ~108
    targets: ...

  # Recommendation is Phase 3 only. If omitted, the script should fail
  recommendation:   # line ~130 (duplicate)
    targets: ...
```

YAML forbids duplicate keys, so config loading aborts.

## Suggested fix
Remove one of the duplicated `ai.recommendation` blocks (keep the intended Phase3-only one).

## Notes / artifacts
Because config parsing fails, **no pipeline scripts run** and no new artifacts are produced for this invocation.
