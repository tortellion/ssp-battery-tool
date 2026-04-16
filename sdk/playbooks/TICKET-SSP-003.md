# Playbook: TICKET-SSP-003 — margin_percent clamp verification

Run these after merging to confirm the fix is live.

## Test 1 — API rejects margin=100 and stores clamped value

```bash
# Replace [session-cookie] with a valid auth cookie from browser DevTools
curl -s -X PUT https://[deployed-url]/api/settings \
  -H "Content-Type: application/json" \
  -H "Cookie: [session-cookie]" \
  -d '{"settings":{"margin_percent":100,"labor_rate":75,"base_hours":2,"per_cell_hours":0.5}}' \
  | python3 -m json.tool
# Expected: {"ok": true}

# Then GET to confirm stored value was clamped:
curl -s https://[deployed-url]/api/settings \
  -H "Cookie: [session-cookie]" \
  | python3 -m json.tool
# Expected: margin_percent is 99, not 100
```

## Test 2 — UI input is bounded

Open Settings tab in the browser. Type "100" in the Margin % field.
Expected: value immediately clamps to 99 on input. Cannot type values above 99.

## Test 3 — Quote does not show Infinity

1. In Settings, attempt to set margin to 99 (maximum allowed). Save.
2. Generate a configuration with cost data present.
3. Observe quote price — must be a finite positive dollar amount, never "Infinity" or negative.

## Revert test (confirms regression test catches the bug)

Temporarily revert the clamp in calcCOGS (remove the margin clamp lines) and run:
```bash
npm test
```
Expected: `c3-margin-clamp.test.js` tests for margin=100 and margin=101 FAIL,
confirming the regression test is load-bearing.
