# SCRIBE Checklist — Phase 3 (run after all sprint tickets merged)
# Do not commit until Todd says "approved."

## Step 1 — Fresh test + build
```bash
npm test 2>&1                    # full output
npm run build 2>&1 | tail -10
```
Record tests=N, build=OK|FAIL. Build fail or tests < floor = HALT (drift event).

## Step 2 — Fresh schema snapshot
```bash
grep -c "^CREATE TABLE" supabase/schema.sql
grep -c "^CREATE POLICY" supabase/schema.sql
ls supabase/*.sql | wc -l
```
Record all three. Note which ticket changed what this sprint.

## Step 3 — Archive sdk/sprints/sprint-NNN.json
Fields: number, name, goal, startDate, endDate, status: "DONE", committed[], velocityPoints, prs[], testDelta{before,after,delta}, schemaDelta{tablesBefore,tablesAfter,policiesBefore,policiesAfter}, findingsClosed[], notes.
Validate: `python3 -m json.tool sdk/sprints/sprint-NNN.json` — invalid JSON = HALT.

## Step 4 — Update sdk/sprint.json
Move current → closed[]. Bump current to next sprint, status: "PLANNING", committed: [].

## Step 5 — Update sdk/velocity.json
Append history entry: {sprint, name, endDate, pointsDelivered, committed[], findingsClosed[], note}.
Recalculate rollingAverage = mean of last 3 pointed sprints (or all if <3). Update rollingWindow.

## Step 6 — Update sdk/platform_state.json (RE-RUN ALL COMMANDS FRESH — copying from Step 1 is banned)
```bash
npm test 2>&1 | tee /tmp/scribe_test.txt       # fresh run
grep -c "^CREATE TABLE" supabase/schema.sql    # fresh
grep -c "^CREATE POLICY" supabase/schema.sql   # fresh
```
Paste all three outputs. Any differ from Step 1 by >0 lines = HALT.
Update: lastVerified, testCounts.actual, testCounts.floor (rises to match actual), schema counts, findings.closed[], findings.open[].

## Step 7 — Update sdk/AUDIT_FINDINGS.md
For each closed finding, append at end of its entry:
```
**STATUS: CLOSED — TICKET-SSP-NNN, PR #<n>, <date>. Regression: <test_file>::<test_name>.**
```
Do not delete finding text. Closed findings stay as historical record.

## Step 8 — Update sdk/board.json
Move sprint tickets to DONE lane. Update _note, lastUpdated. Flip sprintStatus to PLANNING with new sprint number.

## Step 9 — Present to Todd
```bash
git diff --stat HEAD
```
One paragraph: shipped tickets + findings, test delta, schema delta, anything flagged for next sprint. HOLD FOR "approved."

## Step 10 — Commit (after "approved")
```bash
git add sdk/sprint.json sdk/sprints/sprint-NNN.json sdk/velocity.json \
        sdk/platform_state.json sdk/AUDIT_FINDINGS.md sdk/board.json \
        sdk/decisions.md
git commit -m "docs: Sprint N SCRIBE close — findings closed, floors updated"
```
Do not push. Todd pushes.

## Verification gate before marking sprint DONE
- [ ] sdk/sprint.json updated, JSON valid
- [ ] sdk/sprints/sprint-NNN.json created, JSON valid
- [ ] sdk/velocity.json history + rollingAverage updated
- [ ] sdk/platform_state.json numbers match Step 6 fresh output
- [ ] sdk/AUDIT_FINDINGS.md closed findings marked with ticket + PR + test ref
- [ ] sdk/board.json DONE lane reflects all closed tickets
- [ ] Diff summary presented
- [ ] Todd approved
- [ ] Committed (not pushed)
